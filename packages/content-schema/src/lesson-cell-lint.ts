import { LessonCellObjectSchema, LessonCellSchema, type LessonNote } from './schemas/lesson';
import { MIN_VERIFICATION_PASSES } from './schemas/story';
import { copiedRun, designationNumberIn } from './story-lint';
import { isAllowlistedHost } from './story-sources';

/**
 * The lesson rules of `scripts/validate-content.mjs` (F-CURR-001 §3.8, §3.9, section 5),
 * as one pure function over a parsed cell file. The validator loads this module through
 * `scripts/ts-loader.mjs`, so the rules have one implementation.
 *
 *   lesson-schema                   the file is not a LessonCell (each zod issue)
 *   lesson-no-speaking              a step plays voice-echo
 *   lesson-review-unsigned          a ready cell without both multi-agent review sign-offs
 *   lesson-unsourced-note           a note with neither sources nor a factRef (or both)
 *   lesson-factref-unknown          a factRef naming no fact of a story file
 *   lesson-source-shape             fewer than two sources, none from a Korean public institution,
 *                                   a URL that is not https or whose host is not allow-listed,
 *                                   an `accessed` date in the future
 *   lesson-copies-source            a note shares a run of words with one of its sources
 *   lesson-national-treasure-number a designation number in learner copy
 *   lesson-verification-passes      a note of a ready cell checked fewer than
 *                                   MIN_VERIFICATION_PASSES times, or not scoped 'lesson'
 */

export type LessonRule =
  | 'lesson-schema'
  | 'lesson-no-speaking'
  | 'lesson-review-unsigned'
  | 'lesson-unsourced-note'
  | 'lesson-factref-unknown'
  | 'lesson-source-shape'
  | 'lesson-copies-source'
  | 'lesson-national-treasure-number'
  | 'lesson-verification-passes';

export interface LessonFinding {
  rule: LessonRule;
  path: string;
  message: string;
}

export interface LessonLintContext {
  /** Today as YYYY-MM-DD (the validator passes the UTC date; no clock is read here). */
  today: string;
  /** Fact ids of each story file, by slug (`content/stories/<slug>.json`). */
  storyFacts: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * The hosts that count as a Korean public institution or a reference it publishes
 * (§3.9 bar): the government domain (the National Folk Museum, the Korea Heritage
 * Service, the National Institute of Korean Language and its dictionaries), the
 * Encyclopedia of Korean Culture, Korea.net and korea.kr, the Korea Tourism
 * Organization and the Korea National Park Service. A host must also be on
 * `SOURCE_HOST_ALLOWLIST`; adding one is a reviewed one-line PR.
 */
export const LESSON_PUBLIC_SOURCE_SUFFIXES: readonly string[] = [
  '.go.kr',
  'encykorea.aks.ac.kr',
  'korea.kr',
  'korea.net',
  'visitkorea.or.kr',
  'knps.or.kr',
];
export const LESSON_MIN_SOURCES = 2;

export function isLessonPublicHost(host: string): boolean {
  const lower = host.toLowerCase();
  return LESSON_PUBLIC_SOURCE_SUFFIXES.some((suffix) => {
    const domain = suffix.replace(/^\./, '');
    return lower === domain || lower.endsWith(`.${domain}`);
  });
}

const RULE_PREFIX = /^(lesson-[a-z-]+): /;

/** `SourceSchema` already requires a parseable URL. */
const hostOf = (url: string): { protocol: string; host: string } => {
  const u = new URL(url);
  return { protocol: u.protocol, host: u.hostname };
};

/** Every string field ending in `En` of the cell, outside the notes' sources and the review record. */
function englishFields(value: unknown, path: string, out: Array<[string, string]>): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => englishFields(v, `${path}[${i}]`, out));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'sources' || key === 'review' || key === 'verification') continue;
    const at = path === '' ? key : `${path}.${key}`;
    if (typeof child === 'string' && key.endsWith('En')) out.push([at, child]);
    else englishFields(child, at, out);
  }
}

export type LessonNoteAdd = (rule: LessonRule, path: string, message: string) => void;

/**
 * The note rules of one lesson file (sources, factRefs, copying, verification), over its parsed
 * notes by index; an index left undefined is skipped (a note that failed its schema). Shared with
 * the F-CURR-002 rules, which run them on Volume 2 cells and pack levels (lesson-lint.ts).
 */
export function lintLessonNotes(
  notes: ReadonlyArray<LessonNote | undefined>,
  ready: boolean,
  ctx: LessonLintContext,
  add: LessonNoteAdd,
): void {
  notes.forEach((note, i) => {
    if (note === undefined) return;
    const at = `culture[${i}]`;
    if (note.factRef !== undefined) {
      const [slug, fact] = note.factRef.slice('story:'.length).split('#') as [string, string];
      if (!(ctx.storyFacts.get(slug)?.has(fact) ?? false)) add('lesson-factref-unknown', `${at}.factRef`, `${note.factRef} names no fact of content/stories/${slug}.json`);
    }
    const sources = note.sources ?? [];
    if (note.sources !== undefined) {
      if (sources.length < LESSON_MIN_SOURCES) add('lesson-source-shape', `${at}.sources`, `a note needs at least ${LESSON_MIN_SOURCES} sources (has ${sources.length})`);
      if (!sources.some((s) => isLessonPublicHost(hostOf(s.url).host))) {
        add('lesson-source-shape', `${at}.sources`, 'at least one source is a Korean public institution or a reference it publishes');
      }
    }
    sources.forEach((source, j) => {
      const where = `${at}.sources[${j}]`;
      const url = hostOf(source.url);
      if (url.protocol !== 'https:') add('lesson-source-shape', `${where}.url`, `${source.url} is not an https URL`);
      else if (!isAllowlistedHost(url.host)) add('lesson-source-shape', `${where}.url`, `${url.host} is not on SOURCE_HOST_ALLOWLIST (adding a host is a reviewed one-line PR)`);
      if (source.accessed > ctx.today) add('lesson-source-shape', `${where}.accessed`, `accessed ${source.accessed} is in the future`);
    });
    const copied = copiedRun(note.textEn, sources.map((s) => s.quoteOrLocator));
    if (copied !== undefined) add('lesson-copies-source', `${at}.textEn`, `"${copied}" is copied from a source; restate it in your own words`);
    if (ready) {
      if (note.verification.passes < MIN_VERIFICATION_PASSES) {
        add('lesson-verification-passes', `${at}.verification.passes`, `a ready cell's note is checked at least ${MIN_VERIFICATION_PASSES} times (has ${note.verification.passes})`);
      }
      if (note.verification.scope !== 'lesson') add('lesson-verification-passes', `${at}.verification.scope`, `a lesson note's verification has scope 'lesson'`);
    }
  });
}

/** Every finding for one cell file (`raw` is the parsed JSON). */
export function lintLessonCell(raw: unknown, ctx: LessonLintContext): LessonFinding[] {
  const findings: LessonFinding[] = [];
  const add = (rule: LessonRule, path: string, message: string): void => {
    findings.push({ rule, path, message });
  };
  const report = (issues: readonly { path: (string | number)[]; message: string }[]): void => {
    for (const issue of issues) {
      const named = RULE_PREFIX.exec(issue.message);
      const path = issue.path.map((p) => (typeof p === 'number' ? `[${p}]` : `.${p}`)).join('').replace(/^\./, '') || '(root)';
      if (named) add(named[1] as LessonRule, path, issue.message.slice(named[0].length));
      else add('lesson-schema', path, issue.message);
    }
  };
  // The shape first: the source and copy rules need a well-formed cell; the cell rules
  // (ids, steps, refs, the Check, sign-offs, speech) are reported alongside them.
  const shaped = LessonCellObjectSchema.safeParse(raw);
  if (!shaped.success) {
    report(shaped.error.issues);
    return findings;
  }
  const refined = LessonCellSchema.safeParse(raw);
  if (!refined.success) report(refined.error.issues);
  const cell = shaped.data;
  lintLessonNotes(cell.culture, cell.status === 'ready', ctx, add);
  lintDesignationNumbers(cell, add);
  return findings;
}

/** `lesson-national-treasure-number` over every English field of a lesson file. */
export function lintDesignationNumbers(value: unknown, add: LessonNoteAdd): void {
  const fields: Array<[string, string]> = [];
  englishFields(value, '', fields);
  for (const [path, text] of fields) {
    const number = designationNumberIn(text);
    if (number !== undefined) add('lesson-national-treasure-number', path, `"${number}": write the name without the number`);
  }
}
