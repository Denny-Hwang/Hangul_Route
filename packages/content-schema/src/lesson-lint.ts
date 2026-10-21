import type { z } from 'zod';
import { hasEmoji, lintReviewMessages, newCopyProblems, reviewCopyMessage } from './lesson-lint-copy';
import {
  LESSON_FILE_RE,
  LessonBodySchema,
  PACK_FILE_RE,
  PACK_LEVEL_NAME_RE,
  STORY_FILE_RE,
  hasSoundChange,
  koStrings,
  normalizeKo,
  practiceCheckItems,
  pronunciationKey,
  questKnownAfter,
  questUnits,
  stageNumberOf,
  stepGameKind,
  type LessonBody,
  type LessonBodySource,
  type TaughtUnitKind,
} from './lesson-lint-items';
import type { StageKey } from './schemas/heritage-card';
import { LessonCellObjectSchema, LessonCellSchema, type LessonCell } from './schemas/lesson';
import { MIN_VERIFICATION_PASSES } from './schemas/story';
import { copiedRun, designationNumberIn } from './story-lint';
import { isAllowlistedHost } from './story-sources';

export * from './lesson-lint-copy';
export * from './lesson-lint-items';
export * from './lesson-lint-reports';

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

function lintNotes(cell: LessonCell, ctx: LessonLintContext, add: (rule: LessonRule, path: string, message: string) => void): void {
  cell.culture.forEach((note, i) => {
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
    if (cell.status === 'ready') {
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
  lintNotes(cell, ctx, add);
  const fields: Array<[string, string]> = [];
  englishFields(cell, '', fields);
  for (const [path, text] of fields) {
    const number = designationNumberIn(text);
    if (number !== undefined) add('lesson-national-treasure-number', path, `"${number}": write the name without the number`);
  }
  return findings;
}

// =====================================================================================================
// F-CURR-002 §9.3: the lint rules for Volume 2 cells, Topic Pack levels and new stories. Each is an
// error from day one for a file with `volume` >= 2 (or a `<theme>.v<k>.json` name), for every file
// under `content/packs/` and for a story that is not in SHIPPED_STORY_IDS; for Volume 1 cells and
// the shipped stories it is a warning, so `main` stays green until rows CM-3A re-author Volume 1
// and CM-3B turns the warnings into errors.
// =====================================================================================================

export type CurriculumRule =
  | 'lesson-new-load'
  | 'lesson-recycle'
  | 'lesson-check-variety'
  | 'lesson-culture-coverage'
  | 'culture-source'
  | 'items-stable-id'
  | 'pack-skeleton'
  | 'dictation-unambiguous'
  | 'story-order-text'
  | 'story-topic-unique'
  | 'review-copy';
/** Report-only rules: they print a share and never fail (lesson-lint-reports.ts). */
export type CurriculumReport = 'freq-coverage' | 'story-coverage';
export type CurriculumSeverity = 'error' | 'warning';

export interface CurriculumFinding {
  /** `lesson-schema` when a Volume 2 or pack file is not even a lesson body. */
  rule: CurriculumRule | 'lesson-schema';
  severity: CurriculumSeverity;
  file: string;
  path: string;
  message: string;
}

/**
 * What each rule enforces, as `validate-content.mjs` prints it for the multi-agent review (MAR).
 * `items-stable-id` is a stub here: its snapshot of frozen ids, aliases and retired ids comes with
 * row CM-10, which extracts the review items.
 */
export const CURRICULUM_RULES: Readonly<Record<CurriculumRule | CurriculumReport, string>> = {
  'lesson-new-load': 'At most 8 new items per quest: Discover items not taught earlier on the route, in the pack or in an earlier quest of the file (F-CURR-002 §9.3).',
  'lesson-recycle':
    'At least 30% of a Volume 2 or pack quest\'s Practice and Check items were taught in earlier quests of the route or the pack (§5.1, §6.4).',
  'lesson-check-variety':
    'Check rotation (§7.1): no game kind in more than 40% of a stage\'s Checks; from Stage 2 on every Check is a read-meaning or produce game; no two adjacent quests share their Practice, Apply and Check games.',
  'lesson-culture-coverage': 'At least 2 culture notes in each Volume 2 cell and at least 1 in each pack level (§5.1, §6.4).',
  'culture-source':
    'Every note has a source from the §6.6 allowlist, matched on the publisher\'s English or Korean name. MAR: check each institution\'s name as of the source\'s access date (the Korea Heritage Service was called the Cultural Heritage Administration before 2024-05-17; the lint knows this one rename), and use Ramsar sources for Ramsar site status only.',
  'items-stable-id': 'Review-item ids are frozen in a snapshot, with alias and retired lists (§4.2). Stub until row CM-10 adds the snapshot.',
  'pack-skeleton': 'A pack follows the template of §6.4: five levels at S2, S3, S4, S6, S7, three quests each, the new-item caps, the formats, three new realia in L4, the two pack cards and the Pack Check in L5.',
  'dictation-unambiguous':
    'An item asked by ear (Dictation, or a heard round whose options are spellings) has exactly one spelling among the taught items with its pronunciation, unless a picture or the gloss settles it; an item with a sound change stays out of Dictation until recordings A-9 and A-10 exist (§4.5).',
  'story-order-text': 'At least 1 Story Order round in 2 has captions only, or captions that settle the order on their own (`captionsSettleOrder: true`, checked by MAR) (§7.1 F5).',
  'story-topic-unique': 'A new story shares no topic tag and no source URL with another story in content/stories/ (§5.1).',
  'review-copy':
    'Learner review strings show no percentage and no "n of m" or "n/m" score; new learner copy has no age wording, no speaking UI and no emoji (§4.5, §9.3).',
  'freq-coverage':
    'Report only: the share of taught words on the NIKL 2003 learner vocabulary list, grade A. The list is read at build time from a local file outside the repo (HANGUL_ROUTE_NIKL_GRADE_A) and never bundled (§19 assumption 4).',
  'story-coverage': 'Report only: for each story tier, the share of its Korean tokens taught by the story\'s recommended stage; the authoring target is 95% (§4.7).',
};

/** Rules defined by name only, with no check yet. */
export const CURRICULUM_STUB_RULES: readonly CurriculumRule[] = ['items-stable-id'];

/** The stories on `main` when the rules landed (row CM-7): every other story is new, so its findings are errors. */
export const SHIPPED_STORY_IDS: ReadonlySet<string> = new Set([
  'story:angbuilgu-sundial',
  'story:cheugugi-rain-gauge',
  'story:chuseok-ganggangsullae',
  'story:dano-ssireum',
  'story:donguibogam',
  'story:gimjang-arirang',
  'story:hangeul-day',
  'story:ilseongnok-daily-reflection',
  'story:jagyeongnu-water-clock',
  'story:janggyeong-panjeon',
  'story:jikji-metal-type',
  'story:joseon-records-today',
  'story:kim-hongdo-genre-paintings',
  'story:nanjung-ilgi',
  'story:pansori-tales',
  'story:sejong-new-letters',
  'story:seollal-new-year',
  'story:seungjeongwon-ilgi-every-day',
  'story:shapes-of-hangeul',
  'story:sillok-mountain-archives',
  'story:sillok-royal-historians',
  'story:sun-and-moon',
  'story:tripitaka-koreana',
  'story:uigwe-royal-birthday',
]);

export const LESSON_NEW_ITEMS_MAX = 8;
export const LESSON_RECYCLE_MIN = 0.3;
export const CHECK_KIND_SHARE_MAX = 0.4;
export const VOLUME2_CULTURE_NOTES_MIN = 2;
export const PACK_CULTURE_NOTES_MIN = 1;
/** Sound-change items stay out of Dictation until the recordings of rows A-9 and A-10 exist (§4.5). */
export const SOUND_CHANGE_RECORDINGS_READY = false;

/** Check games that ask the learner to produce: type, build, take dictation or fill a gap (§4.3 rungs). */
export const PRODUCE_KINDS: ReadonlySet<string> = new Set([
  'type-hangul',
  'write-frame',
  'order-it',
  'build-letter',
  'syllable-build',
  'cloze-pick',
  'my-story',
]);
/** Check games that show the Korean and ask its meaning, a picture or a reply (§4.3 read rung). */
export const READ_MEANING_KINDS: ReadonlySet<string> = new Set([
  'read-pick-meaning',
  'pic-word-match',
  'realia-read',
  'tap-respond',
  'role-play',
  'story-order',
  'story-sequence',
]);

/** One institution of the §6.6 allowlist, by its English and Korean names. */
export interface SourceInstitution {
  name: string;
  ko: string;
  /** Other names that also identify it (a part of it, a common short form). */
  aliases?: readonly string[];
  /** Its earlier name, used for sources accessed before `until` (YYYY-MM-DD). */
  formerly?: { name: string; ko: string; until: string };
}

/** F-CURR-002 §6.6, the source allowlist of `culture-source`. */
export const CULTURE_SOURCE_ALLOWLIST: readonly SourceInstitution[] = [
  { name: 'National Hangeul Museum', ko: '국립한글박물관' },
  { name: 'National Institute of Korean Language', ko: '국립국어원' },
  { name: 'National Museum of Korea', ko: '국립중앙박물관' },
  { name: 'National Folk Museum of Korea', ko: '국립민속박물관' },
  {
    name: 'Korea Heritage Service',
    ko: '국가유산청',
    formerly: { name: 'Cultural Heritage Administration', ko: '문화재청', until: '2024-05-17' },
  },
  { name: 'National Gugak Center', ko: '국립국악원' },
  { name: 'Cheongju Early Printing Museum', ko: '청주고인쇄박물관' },
  { name: 'Korea Astronomy and Space Science Institute', ko: '한국천문연구원' },
  { name: 'Korea Meteorological Administration', ko: '기상청' },
  { name: 'Korea National Park Service', ko: '국립공원공단' },
  { name: 'National Institute of Biological Resources', ko: '국립생물자원관' },
  { name: 'National Institute of Ecology', ko: '국립생태원', aliases: ['National Wetlands Center', '국립습지센터'] },
  { name: 'Ramsar Convention Secretariat', ko: '람사르협약', aliases: ['Ramsar Convention'] },
  { name: 'Korea Tourism Organization', ko: '한국관광공사' },
  { name: 'Bank of Korea', ko: '한국은행' },
  { name: 'Ministry of Government Legislation', ko: '법제처' },
  { name: 'Kukkiwon', ko: '국기원' },
  { name: 'UNESCO', ko: '유네스코' },
];

export interface InstitutionMatch {
  institution: SourceInstitution;
  /** False when the publisher uses a name the institution did not have on the access date. */
  nameAsOfAccess: boolean;
}

/** The allowlisted institution a source's publisher names, judged by its access date. */
export function allowlistedInstitution(publisher: string, accessed: string): InstitutionMatch | undefined {
  const text = publisher.toLowerCase();
  const names = (...list: string[]): boolean => list.some((n) => text.includes(n.toLowerCase()));
  for (const institution of CULTURE_SOURCE_ALLOWLIST) {
    const current = names(institution.name, institution.ko, ...(institution.aliases ?? []));
    const former = institution.formerly !== undefined && names(institution.formerly.name, institution.formerly.ko);
    if (!current && !former) continue;
    if (institution.formerly === undefined) return { institution, nameAsOfAccess: true };
    const before = accessed < institution.formerly.until;
    return { institution, nameAsOfAccess: before ? former : current };
  }
  return undefined;
}

// ---- files and tiers --------------------------------------------------------------------------------

export type CurriculumTier = 'volume1' | 'volume2' | 'pack' | 'shipped-story' | 'new-story';
const STRICT_TIERS: ReadonlySet<CurriculumTier> = new Set(['volume2', 'pack', 'new-story']);
export const severityOf = (tier: CurriculumTier): CurriculumSeverity => (STRICT_TIERS.has(tier) ? 'error' : 'warning');


interface LessonEntry {
  file: string;
  tier: 'volume1' | 'volume2' | 'pack';
  stage: number;
  pack?: string;
  body: LessonBody;
  /** Everything the file shows as Korean, for the files that come after it. */
  known: string[];
}

interface StoryEntry {
  file: string;
  tier: 'shipped-story' | 'new-story';
  raw: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const pathOf = (...parts: Array<string | number>): string =>
  parts.map((p) => (typeof p === 'number' ? `[${p}]` : `.${p}`)).join('').replace(/^\./, '');
const share = (part: number, whole: number): string => `${Math.round((part / whole) * 100)} in 100`;

// ---- per-file rules ---------------------------------------------------------------------------------

type Add = (rule: CurriculumFinding['rule'], path: string, message: string) => void;

/**
 * What the route taught before a file: for a Volume 1 cell, the Volume 1 cells of lower stages;
 * for a Volume 2 cell, Volume 1 up to its stage and Volume 2 below it; for a pack level, Volume 1
 * up to its stage and the pack's lower levels. Stage 1 is hand-written TypeScript, outside the tree.
 */
function priorKnown(entry: LessonEntry, lessons: readonly LessonEntry[]): Set<string> {
  const before = (other: LessonEntry): boolean => {
    if (other === entry) return false;
    if (entry.tier === 'volume1') return other.tier === 'volume1' && other.stage < entry.stage;
    if (entry.tier === 'volume2') return (other.tier === 'volume1' && other.stage <= entry.stage) || (other.tier === 'volume2' && other.stage < entry.stage);
    return (other.tier === 'volume1' && other.stage <= entry.stage) || (other.pack === entry.pack && other.stage < entry.stage);
  };
  return new Set(lessons.filter(before).flatMap((o) => o.known));
}

function lintLoadAndRecycle(entry: LessonEntry, prior: Set<string>, add: Add): void {
  const known = new Set(prior);
  entry.body.quests.forEach((quest, qi) => {
    const fresh = questUnits(quest).filter((u) => !known.has(u.key));
    if (fresh.length > LESSON_NEW_ITEMS_MAX) {
      add('lesson-new-load', pathOf('quests', qi), `the quest teaches ${fresh.length} new items; at most ${LESSON_NEW_ITEMS_MAX}`);
    }
    if (entry.tier !== 'volume1') {
      const items = practiceCheckItems(quest);
      const recycled = items.filter((ko) => known.has(ko)).length;
      if (items.length > 0 && recycled / items.length < LESSON_RECYCLE_MIN) {
        add(
          'lesson-recycle',
          pathOf('quests', qi),
          `${recycled} of the ${items.length} Practice and Check items (${share(recycled, items.length)}) come from earlier quests; at least 30 in 100`,
        );
      }
    }
    for (const ko of questKnownAfter(quest)) known.add(ko);
  });
}

function lintQuestChecks(entry: LessonEntry, add: Add): void {
  const triples = entry.body.quests.map((q) => ['practice', 'apply', 'check'].map((k) => stepGameKind(q, k) ?? '-').join(' / '));
  entry.body.quests.forEach((quest, qi) => {
    const check = stepGameKind(quest, 'check');
    if (check !== undefined && entry.stage >= 2 && !PRODUCE_KINDS.has(check) && !READ_MEANING_KINDS.has(check)) {
      add('lesson-check-variety', pathOf('quests', qi), `the Check plays ${check}; from Stage 2 on a Check plays a read-meaning or produce game`);
    }
    if (qi > 0 && triples[qi] === triples[qi - 1]) {
      add('lesson-check-variety', pathOf('quests', qi), `quests ${qi} and ${qi + 1} both play ${triples[qi]}; adjacent quests differ in Practice, Apply or Check`);
    }
  });
}

function lintCultureCoverage(entry: LessonEntry, add: Add): void {
  const min = entry.tier === 'volume2' ? VOLUME2_CULTURE_NOTES_MIN : entry.tier === 'pack' ? PACK_CULTURE_NOTES_MIN : 0;
  const notes = entry.body.culture.filter((n) => n.kind === 'culture').length;
  if (notes < min) {
    const what = entry.tier === 'volume2' ? 'a Volume 2 cell' : 'a pack level';
    add('lesson-culture-coverage', 'culture', `${what} carries at least ${min} culture notes (has ${notes})`);
  }
}

function factSources(factRef: string, tree: ReadonlyMap<string, unknown>): LessonBodySource[] {
  const [slug, factId] = factRef.slice('story:'.length).split('#');
  const story = tree.get(`content/stories/${slug}.json`);
  const facts = isRecord(story) && Array.isArray(story.facts) ? story.facts : [];
  const fact = facts.find((f): f is Record<string, unknown> => isRecord(f) && f.id === factId);
  const sources = fact !== undefined && Array.isArray(fact.sources) ? fact.sources : [];
  return sources.filter(
    (s): s is LessonBodySource => isRecord(s) && typeof s.publisher === 'string' && typeof s.accessed === 'string' && typeof s.url === 'string',
  );
}

function lintCultureSource(entry: LessonEntry, tree: ReadonlyMap<string, unknown>, add: Add): void {
  entry.body.culture.forEach((note, ni) => {
    const sources = note.sources ?? (note.factRef !== undefined ? factSources(note.factRef, tree) : []);
    const matches = sources.map((s) => allowlistedInstitution(s.publisher, s.accessed));
    if (!matches.some((m) => m !== undefined)) {
      add('culture-source', pathOf('culture', ni, 'sources'), 'no source is from the F-CURR-002 §6.6 allowlist of public institutions');
    }
    matches.forEach((m, si) => {
      if (m === undefined || m.nameAsOfAccess || note.sources === undefined) return;
      const s = sources[si] as LessonBodySource;
      const expected = m.institution.formerly !== undefined && s.accessed < m.institution.formerly.until ? m.institution.formerly.name : m.institution.name;
      add('culture-source', pathOf('culture', ni, 'sources', si, 'publisher'), `on ${s.accessed} the institution was called the ${expected}`);
    });
  });
}

/** Spellings of the taught items, by pronunciation key. */
type Homophones = ReadonlyMap<string, ReadonlySet<string>>;

function homophonesOf(lessons: readonly LessonEntry[]): Homophones {
  const map = new Map<string, Set<string>>();
  for (const entry of lessons) {
    for (const quest of entry.body.quests) {
      for (const unit of questUnits(quest)) {
        for (const ko of unit.texts) {
          const key = pronunciationKey(ko);
          const set = map.get(key) ?? new Set<string>();
          set.add(ko);
          map.set(key, set);
        }
      }
    }
  }
  return map;
}

function otherSpellings(ko: string, homophones: Homophones, alsoHeard: readonly string[]): string[] {
  const key = pronunciationKey(ko);
  const spellings = new Set([...(homophones.get(key) ?? []), ...alsoHeard.filter((o) => pronunciationKey(o) === key)]);
  spellings.delete(ko);
  return [...spellings];
}

function lintDictation(entry: LessonEntry, homophones: Homophones, add: Add): void {
  entry.body.quests.forEach((quest, qi) => {
    quest.scopes.forEach((scope, si) => {
      const rounds = Array.isArray(scope.rounds) ? scope.rounds.filter(isRecord) : [];
      rounds.forEach((round, ri) => {
        const at = pathOf('quests', qi, 'scopes', si, 'rounds', ri);
        if (scope.kind === 'type-hangul' && round.mode === 'hear') {
          const target = isRecord(round.target) ? round.target : {};
          const ko = normalizeKo(String(target.ko ?? ''));
          const gloss = typeof target.en === 'string' ? target.en.toLowerCase() : undefined;
          const settled = round.pictureRef !== undefined || (gloss !== undefined && String(round.promptEn ?? '').toLowerCase().includes(gloss));
          const others = otherSpellings(ko, homophones, []);
          if (others.length > 0 && !settled) add('dictation-unambiguous', at, `${ko} sounds like ${others.join(', ')}; show a picture or the gloss, or ask it another way`);
          const flagged = round.soundChange === true || target.soundChange === true || hasSoundChange(ko);
          if (flagged && !SOUND_CHANGE_RECORDINGS_READY) add('dictation-unambiguous', at, `${ko} has a sound change; it stays out of Dictation until recordings A-9 and A-10 exist`);
        }
        if (scope.kind === 'listen-pick' && Array.isArray(round.options)) {
          const options = round.options.filter(isRecord);
          const answer = options.find((o) => o.id === round.answerId);
          if (answer === undefined || !isRecord(answer.text)) return;
          const ko = normalizeKo(String(answer.text.ko ?? ''));
          const heard = options.filter((o) => o !== answer).flatMap((o) => koStrings(o.text));
          const settled = answer.pictureRef !== undefined || answer.labelEn !== undefined;
          const others = otherSpellings(ko, homophones, heard);
          if (others.length > 0 && !settled) add('dictation-unambiguous', at, `${ko} sounds like ${others.join(', ')}; a heard round with spelling options needs one spelling per sound`);
        }
      });
    });
  });
}

/** Story Order rounds (row CM-34's `story-order` kind): at least half settle the order by text. */
export function storyOrderIssues(rounds: readonly unknown[]): string | undefined {
  const textual = rounds.filter((round) => {
    if (!isRecord(round)) return false;
    if (round.captionsOnly === true || round.captionsSettleOrder === true) return true;
    const panels = Array.isArray(round.panels) ? round.panels : [];
    return panels.length > 0 && panels.every((p) => isRecord(p) && p.pictureRef === undefined && p.art === undefined);
  }).length;
  const needed = Math.ceil(rounds.length / 2);
  return textual >= needed ? undefined : `${textual} of ${rounds.length} rounds settle the order by their captions; at least ${needed}`;
}

/** Every `story-order` object with rounds, anywhere under `value`. */
function lintStoryOrder(value: unknown, path: string, add: Add): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => lintStoryOrder(v, `${path}[${i}]`, add));
    return;
  }
  if (!isRecord(value)) return;
  if (value.kind === 'story-order' && Array.isArray(value.rounds)) {
    const issue = storyOrderIssues(value.rounds);
    if (issue !== undefined) add('story-order-text', path === '' ? '(root)' : path, issue);
  }
  for (const [key, child] of Object.entries(value)) lintStoryOrder(child, path === '' ? key : `${path}.${key}`, add);
}

/** Reference text a learner never reads: citations, review records, author notes. */
const LESSON_REFERENCE_KEYS = new Set(['sources', 'verification', 'review']);
const STORY_REFERENCE_KEYS = new Set(['facts', 'referenceDisplay', 'authorNotes', 'learningGoalsEn', 'verification', 'errata', 'review']);

function lintNewCopy(value: unknown, path: string, skip: ReadonlySet<string>, add: Add): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => lintNewCopy(v, `${path}[${i}]`, skip, add));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (skip.has(key)) continue;
    const at = path === '' ? key : `${path}.${key}`;
    if (typeof child !== 'string') {
      lintNewCopy(child, at, skip, add);
      continue;
    }
    // A gloss (`en`) names what a word means ("child"); it is not copy about the learner.
    const problems = key.endsWith('En') ? newCopyProblems(child) : hasEmoji(child) ? (['emoji'] as const) : [];
    for (const problem of problems) add('review-copy', at, reviewCopyMessage(problem));
  }
}

// ---- cross-file rules -------------------------------------------------------------------------------

function lintCheckShares(lessons: readonly LessonEntry[], push: (file: string, tier: CurriculumTier, f: Omit<CurriculumFinding, 'file' | 'severity'>) => void): void {
  const groups = new Map<string, LessonEntry[]>();
  for (const entry of lessons) {
    const key = `${entry.tier}:${entry.stage}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  for (const entries of groups.values()) {
    const kinds = entries.flatMap((e) => e.body.quests.map((q) => stepGameKind(q, 'check'))).filter((k) => k !== undefined);
    const counts = new Map<string, number>();
    for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
    // Lessons are collected in file order, so the group's first entry is its first file.
    const first = entries[0] as LessonEntry;
    const tierName = first.tier === 'volume1' ? 'Volume 1' : first.tier === 'volume2' ? 'Volume 2' : 'pack';
    for (const [kind, n] of counts) {
      if (n / kinds.length > CHECK_KIND_SHARE_MAX) {
        push(first.file, first.tier, {
          rule: 'lesson-check-variety',
          path: '(stage)',
          message: `${kind} is the game of ${n} of the ${kinds.length} stage${first.stage} ${tierName} Checks (${share(n, kinds.length)}); at most 40 in 100`,
        });
      }
    }
  }
}

/** The pack template of §6.4, one row per level. */
export interface PackLevelTemplate {
  stage: StageKey;
  quests: number;
  /** New items per quest by kind (the total is capped by `lesson-new-load`). */
  maxNew: Partial<Record<TaughtUnitKind, number>>;
  /** Practice and Apply games of the level's rotation. */
  formats: readonly string[];
  newRealia: number;
  cards: number;
  /** Items in the Pack Check that the L5 file declares (`packCheck.items`). */
  packCheckItems?: number;
}
export const PACK_TEMPLATE: readonly PackLevelTemplate[] = [
  { stage: 'stage2', quests: 3, maxNew: { word: 8 }, formats: ['pic-word-match', 'card-match', 'syllable-build'], newRealia: 0, cards: 0 },
  { stage: 'stage3', quests: 3, maxNew: { pattern: 1, word: 4 }, formats: ['order-it', 'cloze-pick'], newRealia: 0, cards: 0 },
  { stage: 'stage4', quests: 3, maxNew: { exchange: 1, word: 4 }, formats: ['role-play', 'tap-respond', 'story-order'], newRealia: 0, cards: 1 },
  { stage: 'stage6', quests: 3, maxNew: { word: 6 }, formats: ['realia-read', 'type-hangul'], newRealia: 3, cards: 0 },
  { stage: 'stage7', quests: 3, maxNew: { pattern: 1, word: 3 }, formats: ['write-frame', 'my-story'], newRealia: 0, cards: 1, packCheckItems: 10 },
];

/** The realia a level shows: its Discover realia and its Realia Read sheets. */
function realiaRefs(body: LessonBody): Set<string> {
  const refs = new Set<string>();
  for (const quest of body.quests) {
    for (const step of quest.steps) {
      for (const page of step.discover?.pages ?? []) {
        for (const item of page.items) if (typeof item.realiaRef === 'string') refs.add(item.realiaRef);
      }
    }
    for (const scope of quest.scopes) {
      if (isRecord(scope.realia) && typeof scope.realia.ref === 'string') refs.add(scope.realia.ref);
    }
  }
  return refs;
}

function lintPack(
  key: string,
  files: readonly string[],
  tree: ReadonlyMap<string, unknown>,
  lessons: readonly LessonEntry[],
  push: (file: string, f: Omit<CurriculumFinding, 'file' | 'severity'>) => void,
): void {
  const manifestFile = `content/packs/${key}/pack.json`;
  const issue = (file: string, path: string, message: string): void => push(file, { rule: 'pack-skeleton', path, message });
  for (const file of files) {
    const name = file.slice(`content/packs/${key}/`.length);
    if (name !== 'pack.json' && !PACK_LEVEL_NAME_RE.test(name)) issue(file, '(root)', `${name} is not part of a pack; a pack holds pack.json and stage-<n>.json for n = 2, 3, 4, 6, 7`);
  }
  const manifest = tree.get(manifestFile);
  if (!isRecord(manifest)) {
    issue([...files].sort()[0] as string, '(pack)', `${manifestFile} is missing or not an object`);
    return;
  }
  if (manifest.id !== `pack:${key}`) issue(manifestFile, 'id', `the pack in content/packs/${key}/ has id pack:${key}`);
  if (manifest.key !== key) issue(manifestFile, 'key', `the pack in content/packs/${key}/ has key ${key}`);
  const levels = Array.isArray(manifest.levels) ? manifest.levels : [];
  if (levels.length !== PACK_TEMPLATE.length) issue(manifestFile, 'levels', `a pack has ${PACK_TEMPLATE.length} levels (has ${levels.length})`);
  const seenRealia = new Set<string>();
  PACK_TEMPLATE.forEach((template, li) => {
    const n = stageNumberOf(template.stage);
    const level = levels[li];
    const episodeId = `episode:pack-${key}-s${n}`;
    if (!isRecord(level) || level.stage !== template.stage || level.episodeId !== episodeId) {
      issue(manifestFile, pathOf('levels', li), `level ${li + 1} is { stage: ${template.stage}, episodeId: ${episodeId} }`);
    }
    const file = `content/packs/${key}/stage-${n}.json`;
    const entry = lessons.find((e) => e.file === file);
    if (entry === undefined) {
      if (!tree.has(file)) issue(manifestFile, pathOf('levels', li), `${file} is missing`);
      return;
    }
    const { body } = entry;
    if (body.id !== episodeId) issue(file, 'id', `level ${li + 1} has id ${episodeId}`);
    if (body.stage !== template.stage) issue(file, 'stage', `level ${li + 1} is at ${template.stage}`);
    if (body.quests.length !== template.quests) issue(file, 'quests', `a pack level has ${template.quests} quests (has ${body.quests.length})`);
    body.quests.forEach((quest, qi) => {
      const questId = `quest:pack-${key}-s${n}-q${qi + 1}`;
      if (quest.id !== questId) issue(file, pathOf('quests', qi, 'id'), `quest ${qi + 1} of this level has id ${questId}`);
      const units = questUnits(quest);
      for (const [kind, max] of Object.entries(template.maxNew)) {
        const count = units.filter((u) => u.kind === kind).length;
        if (count > (max as number)) issue(file, pathOf('quests', qi), `level ${li + 1} teaches at most ${max} ${kind} item(s) a quest (has ${count})`);
      }
      for (const step of ['practice', 'apply']) {
        const kind = stepGameKind(quest, step);
        if (kind !== undefined && !template.formats.includes(kind)) {
          issue(file, pathOf('quests', qi), `the ${step} game of level ${li + 1} is one of ${template.formats.join(', ')}, not ${kind}`);
        }
      }
    });
    const refs = realiaRefs(body);
    const fresh = [...refs].filter((r) => !seenRealia.has(r)).length;
    for (const r of refs) seenRealia.add(r);
    if (fresh < template.newRealia) issue(file, 'quests', `level ${li + 1} shows ${template.newRealia} new realia (has ${fresh})`);
    if (body.rewardCardIds.length !== template.cards) issue(file, 'rewardCardIds', `level ${li + 1} gives ${template.cards} pack card(s) (has ${body.rewardCardIds.length})`);
    if (template.packCheckItems !== undefined) {
      const items = isRecord(body.packCheck) ? body.packCheck.items : undefined;
      if (items !== template.packCheckItems) issue(file, 'packCheck', `level ${li + 1} ships the Pack Check: packCheck.items is ${template.packCheckItems}`);
    }
  });
}

const normalizeUrl = (url: string): string => {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url.trim();
  }
};

function storyTopics(raw: Record<string, unknown>): Set<string> {
  const tags = Array.isArray(raw.topicTags) ? raw.topicTags.filter((t): t is string => typeof t === 'string') : [];
  return new Set([String(raw.id).replace(/^story:/, ''), ...tags]);
}

function storyUrls(raw: Record<string, unknown>): Set<string> {
  const facts = Array.isArray(raw.facts) ? raw.facts.filter(isRecord) : [];
  const sources = facts.flatMap((f) => (Array.isArray(f.sources) ? f.sources.filter(isRecord) : []));
  return new Set(sources.map((s) => s.url).filter((u): u is string => typeof u === 'string').map(normalizeUrl));
}

function lintStoryTopic(story: StoryEntry, stories: readonly StoryEntry[], add: Add): void {
  const tags = Array.isArray(story.raw.topicTags) ? story.raw.topicTags.filter((t): t is string => typeof t === 'string') : [];
  const urls = storyUrls(story.raw);
  for (const other of stories) {
    if (other === story) continue;
    const topics = storyTopics(other.raw);
    for (const tag of tags) if (topics.has(tag)) add('story-topic-unique', 'topicTags', `topic ${tag} is already the topic of ${String(other.raw.id)}`);
    for (const url of storyUrls(other.raw)) if (urls.has(url)) add('story-topic-unique', 'facts', `${url} is already a source of ${String(other.raw.id)}`);
  }
}

export interface CurriculumLintOptions {
  /** The stories whose findings stay warnings (default: SHIPPED_STORY_IDS). */
  shippedStoryIds?: ReadonlySet<string>;
}

/**
 * Every F-CURR-002 §9.3 finding over a content tree (`content/...` path -> parsed JSON), with
 * its severity: an error for Volume 2 cells, pack files and new stories, a warning for Volume 1
 * cells and shipped stories. Files outside lessons, packs and stories are ignored.
 */
export function lintCurriculum(tree: ReadonlyMap<string, unknown>, opts: CurriculumLintOptions = {}): CurriculumFinding[] {
  const shipped = opts.shippedStoryIds ?? SHIPPED_STORY_IDS;
  const findings: CurriculumFinding[] = [];
  const push = (file: string, tier: CurriculumTier, f: Omit<CurriculumFinding, 'file' | 'severity'>): void => {
    findings.push({ ...f, file, severity: severityOf(tier) });
  };
  const files = [...tree.keys()].sort();

  const lessons: LessonEntry[] = [];
  const packFiles = new Map<string, string[]>();
  for (const file of files) {
    const raw = tree.get(file);
    const lesson = LESSON_FILE_RE.exec(file);
    const pack = PACK_FILE_RE.exec(file);
    if (pack !== null) packFiles.set(pack[1] as string, [...(packFiles.get(pack[1] as string) ?? []), file]);
    const level = pack === null ? null : PACK_LEVEL_NAME_RE.exec(pack[2] as string);
    if (lesson === null && level === null) continue;
    const pathVolume = lesson?.[3] === undefined ? 1 : Number(lesson[3]);
    const rawVolume = isRecord(raw) && typeof raw.volume === 'number' ? raw.volume : 1;
    const tier = level !== null ? 'pack' : Math.max(pathVolume, rawVolume) >= 2 ? 'volume2' : 'volume1';
    const parsed = LessonBodySchema.safeParse(raw);
    if (!parsed.success) {
      if (tier !== 'volume1') {
        const first = parsed.error.issues[0] as z.ZodIssue;
        push(file, tier, { rule: 'lesson-schema', path: pathOf(...first.path) || '(root)', message: `not a lesson body: ${first.message}` });
      }
      continue;
    }
    const stage = Number((lesson ?? level)?.[1]);
    const body = parsed.data;
    lessons.push({ file, tier, stage, pack: pack?.[1], body, known: body.quests.flatMap(questKnownAfter) });
  }

  const stories: StoryEntry[] = files
    .filter((file) => STORY_FILE_RE.test(file))
    .map((file) => ({ file, raw: tree.get(file) }))
    .filter((s): s is { file: string; raw: Record<string, unknown> } => isRecord(s.raw) && typeof s.raw.id === 'string')
    .map((s) => ({ ...s, tier: shipped.has(String(s.raw.id)) ? 'shipped-story' : 'new-story' }));

  const homophones = homophonesOf(lessons);
  for (const entry of lessons) {
    const add: Add = (rule, path, message) => push(entry.file, entry.tier, { rule, path, message });
    lintLoadAndRecycle(entry, priorKnown(entry, lessons), add);
    lintQuestChecks(entry, add);
    lintCultureCoverage(entry, add);
    lintCultureSource(entry, tree, add);
    lintDictation(entry, homophones, add);
    lintStoryOrder(entry.body.quests, 'quests', add);
    lintNewCopy(entry.body, '', LESSON_REFERENCE_KEYS, add);
  }
  lintCheckShares(lessons, push);
  for (const [key, list] of packFiles) lintPack(key, list, tree, lessons, (file, f) => push(file, 'pack', f));
  for (const story of stories) {
    const add: Add = (rule, path, message) => push(story.file, story.tier, { rule, path, message });
    lintStoryOrder(story.raw, '', add);
    lintNewCopy(story.raw, '', STORY_REFERENCE_KEYS, add);
    if (story.tier === 'new-story') lintStoryTopic(story, stories, add);
  }
  return findings;
}

/**
 * `review-copy` on the review screens' UI strings: every learner review string of one locale's
 * `learner` messages (`packages/i18n/src/messages/<locale>/learner.ts`). These are always errors:
 * the Hangul Check shows no score today, and every review screen F-CURR-002 adds is new.
 */
export function lintReviewStrings(learner: unknown, file: string): CurriculumFinding[] {
  return lintReviewMessages(learner).map(({ path, problem }) => ({
    rule: 'review-copy' as const,
    severity: 'error' as const,
    file,
    path,
    message: reviewCopyMessage(problem),
  }));
}
