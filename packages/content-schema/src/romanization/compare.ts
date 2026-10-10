/**
 * Romanization checker (F-CNT-002 §3.3). Pure functions that compare a stored
 * romanization with the Revised Romanization the converter produces and return
 * findings; callers (the data-reading suites of later PRs) add file and line.
 *
 * Rules: R1 romanization-mismatch, R2 romanization-hyphen, R3 romanization-spacing,
 * R4 romanization-missing, R5 romanization-inconsistent, R6 romanization-prose,
 * R7 jamo-value-unknown, R8 romanization-exception-stale. romanization-unchecked
 * is a warning: the Korean holds a character the converter cannot read, so R1
 * could not run (reported instead of a false mismatch).
 */
import { extractProsePairs } from './extract';
import {
  JAMO_NAME_VALUES,
  JAMO_SOUND_VALUES,
  type RomanizationException,
} from './exceptions';
import { romanize, syllableSplit } from './rr';

export type RomanizationRule =
  | 'romanization-mismatch'
  | 'romanization-hyphen'
  | 'romanization-spacing'
  | 'romanization-missing'
  | 'romanization-inconsistent'
  | 'romanization-prose'
  | 'jamo-value-unknown'
  | 'romanization-exception-stale'
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
  exceptions?: readonly RomanizationException[];
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
  const rr = romanize(ko);
  if (rr.unknown.length > 0) {
    issues.push(
      issue(
        'romanization-unchecked',
        `${ko}: cannot be romanized by rule (${rr.unknown.join(' ')}), spelling not verified`,
        ko,
        given,
        'warning',
      ),
    );
  } else if (compact(given) !== compact(rr.text) && !isAllowed(ko, given, ctx)) {
    issues.push(
      issue(
        'romanization-mismatch',
        `${ko}: given "${given.trim()}", Revised Romanization is "${rr.text}"`,
        ko,
        given,
      ),
    );
  }
  return issues;
}

function isAllowed(ko: string, given: string, ctx: CheckContext | undefined): boolean {
  const exceptions = ctx?.exceptions ?? [];
  return exceptions.some((e) => e.ko === ko.trim() && e.allowed.some((a) => compact(a) === compact(given)));
}

/**
 * R8: an exception needs a reason and must match a Korean string in the scanned
 * sources (`seenKo`).
 */
export function checkExceptions(
  exceptions: readonly RomanizationException[],
  seenKo: readonly string[],
): RomanizationIssue[] {
  const issues: RomanizationIssue[] = [];
  for (const e of exceptions) {
    if (e.reason.trim() === '') {
      issues.push(issue('romanization-exception-stale', `exception ${e.ko} has no reason`, e.ko));
    }
    if (seenKo.indexOf(e.ko) < 0) {
      issues.push(issue('romanization-exception-stale', `exception ${e.ko} matched no source`, e.ko));
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
