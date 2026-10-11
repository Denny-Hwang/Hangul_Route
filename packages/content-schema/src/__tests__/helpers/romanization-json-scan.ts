/**
 * Class A scanner (F-CNT-002 §3.4): reads `content/**\/*.json` and runs the
 * romanization rules over every Korean/romanization pair it finds. Test support;
 * `romanization-content.test.ts` runs it over the repo and over temp-dir fixtures.
 *
 * Pairing (the same shape F-CNT-001 already requires of a Korean `ko` field):
 *  - an object with a `ko` that holds a Hangul syllable block and a sibling
 *    `romanization` (or its alias `rr`, the story and vocab drafts use it): R1 to R3;
 *  - the same object with no romanization, or an empty one: R4 (a warning inside a
 *    story whose top-level `state` is `draft`);
 *  - a jamo record (`id` starts with `jamo:`): `romanization` such as `g/k (giyeok)` is
 *    checked as a sound value plus letter name (R7), not as a word;
 *  - a bare isolated jamo in another object (`ko: 'ㄱ'`) is not a word and is skipped (C6);
 *  - English prose fields: R6 against the registry of every Korean word seen.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KNOWN_STORY_FINDINGS, type KnownFinding } from './romanization-baseline';
import {
  ROMANIZATION_EXCEPTIONS,
  checkConsistency,
  checkJamoRomanization,
  checkProse,
  checkRomanization,
  formatRomanizationFinding,
  type RomanizationEntry,
  type RomanizationException,
  type RomanizationIssue,
} from '../../index';

const HANGUL_SYLLABLE = /[가-힣]/;
const JAMO_ID = /^jamo:/;
/**
 * Top-level keys of a shipped story file that hold grown-up and reviewer text (F-STORY-001 §3.8,
 * the same set as scripts/validate-content.mjs): source titles read "English title (한글 title)",
 * which is a translation, not a romanization, so the prose rule (R6) skips them. The Korean target
 * objects inside still go through R1 to R4.
 */
const REFERENCE_ZONE_KEYS = new Set(['facts', 'referenceDisplay', 'authorNotes', 'learningGoalsEn', 'verification', 'errata']);
const PROSE_KEY = /^(en|blurb|fact|title|[a-z]+En|[a-z_]+_en)$/;

export interface ScanResult {
  /** `::error …` lines; the suite fails when this is not empty. */
  errors: string[];
  /** `::warning …` lines; reported, never failing. */
  warnings: string[];
  /** Findings listed in the baseline (KNOWN_STORY_FINDINGS): reported, not failing. */
  known: string[];
  /** Every Korean string seen with a romanization, for R5 across sources. */
  entries: RomanizationEntry[];
  /** Every Korean string seen (R6 registry and R8). */
  koSeen: string[];
}

interface Located {
  file: string;
  line: number | undefined;
  issue: RomanizationIssue;
}

function lineAfter(source: string, token: string, cursor: { at: number }): number | undefined {
  let idx = source.indexOf(token, cursor.at);
  if (idx < 0) idx = source.indexOf(token);
  if (idx < 0) return undefined;
  cursor.at = idx + token.length;
  return source.slice(0, idx).split('\n').length;
}

export function scanContentFiles(
  root: string,
  files: readonly string[],
  exceptions: readonly RomanizationException[] = ROMANIZATION_EXCEPTIONS,
  baseline: readonly KnownFinding[] = KNOWN_STORY_FINDINGS,
): ScanResult {
  const found: Located[] = [];
  const entries: RomanizationEntry[] = [];
  const koSeen: string[] = [];
  const proseFields: Array<{ file: string; line: number | undefined; text: string }> = [];

  for (const file of files) {
    let source: string;
    let parsed: unknown;
    try {
      source = readFileSync(join(root, file), 'utf8');
      parsed = JSON.parse(source);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      found.push({ file, line: undefined, issue: { rule: 'romanization-missing', severity: 'error', message: `cannot read ${file}: ${message}` } });
      continue;
    }
    const draft = typeof parsed === 'object' && parsed !== null && (parsed as { state?: unknown }).state === 'draft';
    const cursor = { at: 0 };

    const isStory = file.startsWith('content/stories/');
    const visit = (value: unknown, inZone = false): void => {
      if (Array.isArray(value)) {
        value.forEach((v) => visit(v, inZone));
        return;
      }
      if (typeof value !== 'object' || value === null) return;
      const obj = value as Record<string, unknown>;
      const ko = obj.ko;
      const rom = typeof obj.romanization === 'string' ? obj.romanization : typeof obj.rr === 'string' ? obj.rr : undefined;
      if (typeof ko === 'string') {
        const line = lineAfter(source, `"ko": ${JSON.stringify(ko)}`, cursor) ?? lineAfter(source, JSON.stringify(ko), cursor);
        if (typeof obj.id === 'string' && JAMO_ID.test(obj.id)) {
          for (const issue of checkJamoRomanization(ko, rom ?? '')) found.push({ file, line, issue });
        } else if (HANGUL_SYLLABLE.test(ko)) {
          koSeen.push(ko);
          if (rom === undefined || rom.trim() === '') {
            found.push({
              file,
              line,
              issue: {
                rule: 'romanization-missing',
                severity: draft ? 'warning' : 'error',
                message: `"${ko}" has no romanization${draft ? ' (draft story)' : ''}`,
                ko,
              },
            });
          } else {
            entries.push({ ko, romanization: rom, where: `${file}:${line ?? 0}` });
            for (const issue of checkRomanization(ko, rom, { exceptions })) found.push({ file, line, issue });
          }
        }
      }
      for (const [key, child] of Object.entries(obj)) {
        const zone = inZone || (isStory && value === parsed && REFERENCE_ZONE_KEYS.has(key));
        if (!zone && typeof child === 'string' && PROSE_KEY.test(key)) {
          proseFields.push({ file, line: lineAfter(source, `"${key}": ${JSON.stringify(child)}`, { at: 0 }), text: child });
        }
        visit(child, zone);
      }
    };
    visit(parsed);
  }

  for (const issue of checkConsistency(entries)) found.push({ file: 'content', line: undefined, issue });
  const registry = [...new Set(koSeen)];
  for (const p of proseFields) {
    // {kw:heo-jun} and {target} are story tokens (keyword ids), not romanized prose
    for (const issue of checkProse(p.text.replace(/\{[a-z]+(?::[^}]*)?\}/g, ' '), registry)) found.push({ file: p.file, line: p.line, issue });
  }

  const format = (f: Located): string => formatRomanizationFinding(f.file, f.line, f.issue);
  const matches = (k: KnownFinding, f: Located): boolean => k.file === f.file && k.rule === f.issue.rule && k.ko === f.issue.ko;
  const failing = found.filter((f) => f.issue.severity === 'error');
  const known = failing.filter((f) => baseline.some((k) => matches(k, f)));
  const stale = baseline.filter((k) => files.includes(k.file) && !known.some((f) => matches(k, f)));
  return {
    errors: [
      ...failing.filter((f) => !known.includes(f)).map(format),
      ...stale.map((k) =>
        formatRomanizationFinding(k.file, undefined, {
          rule: 'romanization-exception-stale',
          severity: 'error',
          message: `baseline entry for ${k.ko} (${k.rule}) matched no finding; remove it from romanization-baseline.ts`,
        }),
      ),
    ],
    known: known.map(format),
    warnings: found.filter((f) => f.issue.severity === 'warning').map(format),
    entries,
    koSeen,
  };
}
