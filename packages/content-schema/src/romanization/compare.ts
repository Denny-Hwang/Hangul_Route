/**
 * Romanization checker (F-CNT-002 §3.3). Pure functions that compare a stored
 * romanization with the Revised Romanization the converter produces and return
 * findings; callers (the data-reading suites of later PRs) add file and line.
 *
 * Rules: R1 romanization-mismatch, R2 romanization-hyphen, R3 romanization-spacing,
 * R4 romanization-missing, R5 romanization-inconsistent, R6 romanization-prose,
 * R7 jamo-value-unknown, R8 romanization-exception-stale, R9 romanization-gap
 * (AMENDMENTS-ROMANIZER-GAPS). R1 compares with the reviewed value (`romanizeReviewed`); R9
 * demands a reviewed entry for a word the detectors flag. romanization-unchecked
 * is a warning: the Korean holds a character the converter cannot read, so R1
 * could not run (reported instead of a false mismatch).
 */
import { extractProsePairs } from './extract';
import { JAMO_SOUND_VALUES, ROMANIZATION_EXCEPTIONS, type ReviewedEntry } from './exceptions';
import { JAMO_NAME_VALUES, entryWithNote, type ExceptionEntry } from './exception-notes';
import { GAP_ARTICLES, ROMANIZATION_GAPS, detectGaps, type RomanizationGap } from './gaps';
import { romanizeReviewed, wholeEntryKey } from './reviewed';
import { koTokens, romanize, syllableSplit } from './rr';

export type RomanizationRule =
  | 'romanization-mismatch'
  | 'romanization-hyphen'
  | 'romanization-spacing'
  | 'romanization-missing'
  | 'romanization-inconsistent'
  | 'romanization-prose'
  | 'jamo-value-unknown'
  | 'romanization-exception-stale'
  | 'romanization-gap'
  | 'romanization-unchecked';

export interface RomanizationIssue {
  rule: RomanizationRule;
  severity: 'error' | 'warning';
  message: string;
  /** The Korean string the finding is about, when there is one. */
  ko?: string;
  /** The romanization as stored. */
  given?: string;
}

export interface CheckContext {
  /**
   * The reviewed list; `ROMANIZATION_EXCEPTIONS` when omitted, `[]` for none. Slim entries (`{ ko, allowed }`) read their
   * note from `exception-notes.ts`; an entry that brings its own `reason` or `gap` keeps it.
   */
  exceptions?: readonly ExceptionEntry[];
}

/** One stored pair with a human-readable origin such as 'heritage-cards.ts:94'. */
export interface RomanizationEntry {
  ko: string;
  romanization: string;
  where: string;
}

/**
 * NFC, lower case, apostrophes removed, sentence punctuation and quotes stripped,
 * whitespace collapsed and trimmed. Hyphens are kept (rule R2 inspects them first).
 */
export function normalizeRomanization(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/['’‘]/g, '')
    .replace(/[.,!?~·…"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comparison form: normalised, hyphens and spaces removed. */
function compact(s: string): string {
  return normalizeRomanization(s).replace(/[- ]/g, '');
}

function words(s: string): string[] {
  return s.split(/\s+/).filter((w) => w !== '');
}

function issue(
  rule: RomanizationRule,
  message: string,
  ko?: string,
  given?: string,
  severity: 'error' | 'warning' = 'error',
): RomanizationIssue {
  return { rule, severity, message, ko, given };
}

/**
 * Check one stored romanization against the converter. Returns R4 for an empty value,
 * otherwise R2, R3 and R1 as they apply (a hyphenated but correct value gives exactly
 * one finding, R2). Compound-spacing is compared by word count, never by the letters.
 */
export function checkRomanization(ko: string, given: string, ctx?: CheckContext): RomanizationIssue[] {
  const normalized = normalizeRomanization(given);
  if (normalized === '') {
    return [issue('romanization-missing', `${ko}: romanization is missing`, ko, given)];
  }
  const issues: RomanizationIssue[] = [];
  if (normalized.indexOf('-') >= 0) {
    issues.push(
      issue('romanization-hyphen', `${normalized}: remove hyphens → "${normalized.replace(/-/g, '')}"`, ko, given),
    );
  }
  const koWords = words(ko).length;
  const romWords = words(normalized).length;
  if (koWords !== romWords) {
    issues.push(
      issue(
        'romanization-spacing',
        `${ko} / ${normalized}: ${koWords} Korean word${koWords === 1 ? '' : 's'}, ${romWords} romanized`,
        ko,
        given,
      ),
    );
  }
  const exceptions = ctx?.exceptions ?? ROMANIZATION_EXCEPTIONS;
  const reviewed = romanizeReviewed(ko, exceptions);
  if (reviewed.unknown.length > 0) {
    issues.push(
      issue(
        'romanization-unchecked',
        `${ko}: cannot be romanized by rule (${reviewed.unknown.join(' ')}), spelling not verified`,
        ko,
        given,
        'warning',
      ),
    );
    return issues;
  }
  const gaps = uncoveredGaps(ko, exceptions);
  if (compact(given) !== compact(reviewed.text) && !isAllowed(ko, given, exceptions)) {
    const hint =
      gaps.length === 0
        ? ''
        : ` (converter gap: ${[...new Set(gaps.map((g) => g.gap))].join('/')}, AMENDMENTS-ROMANIZER-GAPS)`;
    issues.push(
      issue(
        'romanization-mismatch',
        `${ko}: given "${given.trim()}", Revised Romanization is "${reviewed.text}"${hint}`,
        ko,
        given,
      ),
    );
  } else {
    for (const { token, gap } of gaps) {
      issues.push(
        issue(
          'romanization-gap',
          `${token}: ${gap} (${GAP_ARTICLES[gap]}); the converter cannot tell. Check 표준국어대사전 and add { ko: '${token}', allowed: ['…'] } to ROMANIZATION_EXCEPTIONS (exceptions.ts) and { gap: '${gap}', reason: '…' } under '${token}' to ROMANIZATION_EXCEPTION_NOTES (exception-notes.ts)`,
          ko,
          given,
        ),
      );
    }
  }
  return issues;
}

/** The gaps the detectors name in the tokens of `ko` that no entry covers (a word entry, or a whole-string entry). */
function uncoveredGaps(ko: string, exceptions: readonly ReviewedEntry[]): Array<{ token: string; gap: RomanizationGap }> {
  const whole = wholeEntryKey(ko);
  if (exceptions.some((e) => wholeEntryKey(e.ko) === whole)) return [];
  return koTokens(ko).flatMap((token) =>
    exceptions.some((e) => e.ko === token) ? [] : detectGaps(token).map((gap) => ({ token, gap })),
  );
}

/** A frame's slot and the particle written after it: `___`, `___을/를`, `___에` (F-CURR-001 §3.4, §3.7). */
const KO_SLOT = /___(?:[가-힣]+(?:\/[가-힣]+)?)?/;
const ROMAN_SLOT = /___(?:[a-z]+(?:\/[a-z]+)?)?/;

/**
 * A sentence frame with slots (`저는 ___을/를 좋아해요` / `jeoneun ___eul/reul joahaeyo`):
 * the slots and their particles are not words, so the text between them is checked
 * piece by piece with `checkRomanization`, after the slot counts agree. A sentence mark
 * right after a slot (`___, 새해 복 많이 받으세요`, the name a card is written to) belongs
 * to the slot, not to the next word.
 */
export function checkFrameRomanization(ko: string, given: string, ctx?: CheckContext): RomanizationIssue[] {
  const koParts = ko.split(KO_SLOT);
  const romParts = normalizeRomanization(given).split(ROMAN_SLOT);
  if (koParts.length !== romParts.length) {
    return [issue('romanization-mismatch', `${ko}: ${koParts.length - 1} slot(s), the romanization has ${romParts.length - 1}`, ko, given)];
  }
  const afterSlot = (part: string, i: number): string => (i > 0 ? part.replace(/^[.,!?~·…]+/, '') : part).trim();
  return koParts.flatMap((part, i) => (/[가-힣]/.test(part) ? checkRomanization(afterSlot(part, i), (romParts[i] as string).trim(), ctx) : []));
}

function isAllowed(ko: string, given: string, exceptions: readonly ReviewedEntry[]): boolean {
  return exceptions.some((e) => e.ko === ko.trim() && e.allowed.some((a) => compact(a) === compact(given)));
}

/** What a detector-gap entry's reason must cite: an article of the rules, or the dictionary entry. */
const ARTICLE = /제\s*\d+\s*항|표준국어대사전/;
/** A predicate-h entry that keeps the ㅎ must say it is a noun. */
const NOUN_REASON = /체언|noun/;

/**
 * R8: an exception needs a reason and must match a Korean string in the scanned sources (`seenKo`:
 * a whole-string entry as a substring of a source, a word entry as a whole token of a checked string,
 * see `seenExceptionKo`). A detector-gap entry cites its article, a word entry holds exactly one
 * allowed value, and a `predicate-h` entry agrees with `romanize(ko, { predicateH: true })` (or is a
 * noun that keeps the ㅎ, as 북한산).
 */
export function checkExceptions(
  exceptions: readonly ExceptionEntry[],
  seenKo: readonly string[],
): RomanizationIssue[] {
  const issues: RomanizationIssue[] = [];
  const stale = (message: string, ko: string): void => {
    issues.push(issue('romanization-exception-stale', message, ko));
  };
  for (const e of exceptions.map(entryWithNote)) {
    if (e.reason.trim() === '') stale(`exception ${e.ko} has no reason`, e.ko);
    if (seenKo.indexOf(e.ko) < 0) stale(`exception ${e.ko} matched no source`, e.ko);
    if (!/\s/.test(e.ko.trim()) && e.allowed.length !== 1) {
      stale(`exception ${e.ko} is a word entry and must hold exactly one allowed value, not ${e.allowed.length}`, e.ko);
    }
    if (ROMANIZATION_GAPS.indexOf(e.gap as RomanizationGap) >= 0 && !ARTICLE.test(e.reason)) {
      stale(`exception ${e.ko} (${e.gap}) cites no article (표준 발음법 제N항, 로마자 표기법 제3장 제1항) or 표준국어대사전 entry`, e.ko);
    }
    if (e.gap === 'predicate-h') {
      const value = compact(e.allowed[0] ?? '');
      const asPredicate = compact(romanize(e.ko, { predicateH: true }).text);
      const asNoun = compact(romanize(e.ko).text);
      if (value !== asPredicate && !(value === asNoun && NOUN_REASON.test(e.reason))) {
        stale(
          `exception ${e.ko} (predicate-h) holds "${e.allowed[0] ?? ''}", the predicate reading is "${asPredicate}" (or the noun reading "${asNoun}" with a reason that says it is a noun, 체언)`,
          e.ko,
        );
      }
    }
  }
  return issues;
}

/**
 * R5: the same Korean string must have the same normalised romanization (hyphens
 * included) in every source. One finding per Korean string, citing the first two origins that disagree.
 */
export function checkConsistency(entries: readonly RomanizationEntry[]): RomanizationIssue[] {
  const first = new Map<string, RomanizationEntry>();
  const reported = new Set<string>();
  const issues: RomanizationIssue[] = [];
  for (const entry of entries) {
    const key = entry.ko.trim();
    const seen = first.get(key);
    if (seen === undefined) {
      first.set(key, entry);
    } else if (normalizeRomanization(seen.romanization) !== normalizeRomanization(entry.romanization) && !reported.has(key)) {
      reported.add(key);
      issues.push(
        issue(
          'romanization-inconsistent',
          `${key}: "${seen.romanization}" (${seen.where}) vs "${entry.romanization}" (${entry.where})`,
          key,
          entry.romanization,
        ),
      );
    }
  }
  return issues;
}

/**
 * R6: English prose that spells a registered Korean word with syllable hyphens
 * (`gang-a-ji` for 강아지), or holds a `romanized (한글)` / `한글 (romanized)` pair
 * whose romanization fails R1 or R2. `registry` lists the Korean words to watch.
 */
export function checkProse(text: string, registry: readonly string[]): RomanizationIssue[] {
  const issues: RomanizationIssue[] = [];
  const flagged = new Set<string>();
  for (const pair of extractProsePairs(text)) {
    const failures = checkRomanization(pair.ko, pair.romanization).filter(
      (f) => f.rule === 'romanization-mismatch' || f.rule === 'romanization-hyphen',
    );
    if (failures.length > 0) {
      flagged.add(normalizeRomanization(pair.romanization));
      issues.push(
        issue(
          'romanization-prose',
          `"${pair.romanization}" (${pair.ko}) in prose: ${failures.map((f) => f.message).join('; ')}`,
          pair.ko,
          pair.romanization,
        ),
      );
    }
  }
  for (const ko of registry) {
    const split = syllableSplit(ko);
    if (split === null || split.indexOf('-') < 0 || flagged.has(split)) continue;
    if (new RegExp(`(^|[^A-Za-z-])${split}(?![A-Za-z-])`, 'i').test(text)) {
      issues.push(issue('romanization-prose', `"${split}" in prose (use "${split.replace(/-/g, '')}")`, ko, split));
    }
  }
  return issues;
}

/** True when `map` has `key` as its own property (jamo are looked up by arbitrary strings). */
function has<T>(map: Readonly<Record<string, T>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key);
}

/**
 * R7: a jamo `romanization` must be a listed sound value for its character, and an
 * optional name suffix, as in 'g (giyeok)', must be the standard RR letter name.
 */
export function checkJamoRomanization(char: string, romanization: string): RomanizationIssue[] {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(romanization);
  const value = (m === null ? romanization : (m[1] as string)).trim();
  const name = m === null ? undefined : (m[2] as string).trim();
  if (!has(JAMO_SOUND_VALUES, char)) {
    return [issue('jamo-value-unknown', `${char}: not a listed jamo`, char, romanization)];
  }
  const issues: RomanizationIssue[] = [];
  const allowed = JAMO_SOUND_VALUES[char] as readonly string[];
  if (allowed.indexOf(value) < 0) {
    issues.push(
      issue('jamo-value-unknown', `${char}: "${value}" is not a listed value (${allowed.join(', ')})`, char, romanization),
    );
  }
  if (name !== undefined && !(has(JAMO_NAME_VALUES, char) && JAMO_NAME_VALUES[char] === name)) {
    issues.push(
      issue('jamo-value-unknown', `${char}: "${name}" is not the standard letter name`, char, romanization),
    );
  }
  return issues;
}
