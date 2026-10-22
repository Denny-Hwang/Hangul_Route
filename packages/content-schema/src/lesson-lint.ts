import type { z } from 'zod';
import { lintDesignationNumbers, lintLessonNotes, type LessonRule } from './lesson-cell-lint';
import { hasEmoji, lintReviewMessages, localeCopyProblems, newCopyProblems, reviewCopyMessage } from './lesson-lint-copy';
import {
  LESSON_FILE_RE,
  LessonBodySchema,
  PACK_FILE_RE,
  PACK_LEVEL_NAME_RE,
  PACK_ORDER_FILE,
  STORY_FILE_RE,
  askedKo,
  hasSoundChange,
  koStrings,
  normalizeKo,
  practiceCheckItems,
  pronunciationKey,
  questKnownAfter,
  questUnits,
  stageNumberOf,
  scopeOfStep,
  stepGameKind,
  type LessonBody,
  type LessonBodyQuest,
  type LessonBodySource,
  type TaughtUnitKind,
} from './lesson-lint-items';
import type { StageKey } from './schemas/heritage-card';
import { LessonNoteSchema, LessonReviewSchema, isLessonSignedOff, type LessonNote } from './schemas/lesson';
import { Stage1TableSchema, reviewItemsOf, type Stage1Table } from './review-items/build';
import { REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE, lessonSourcesOfTree, storySourcesOfTree, vocabOfTree } from './review-items/sources';
import { StableIdSnapshotSchema, type StableIdIssue } from './review-items/stable-ids';

/*
 * The content lint, a build-time module (F-CURR-002 §9.3 and the F-CURR-001 lesson rules it
 * re-exports). The package barrel (index.ts) exports only lesson-cell-lint.ts, so the app bundle
 * never carries these rules, their allowlists or their schemas (§3 and §10: the start bundle must
 * not grow). Build-time callers import this file directly (`@hangul-route/content-schema/lint`,
 * or by path as scripts/validate-content.mjs does).
 */
export * from './lesson-cell-lint';
export * from './lesson-lint-copy';
export * from './lesson-lint-items';
export * from './lesson-lint-reports';
// F-CURR-002 §4.2 (row CM-10): review-item extraction and the frozen ids, build time only like the rules.
export * from './review-items/build';
export * from './review-items/extract';
export * from './review-items/sources';
export * from './review-items/stable-ids';

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
  /**
   * A §9.3 rule, or an F-CURR-001 lesson rule that lintCurriculum also runs on Volume 2 cells and
   * pack levels (`lesson-schema` when such a file, or a misnamed lesson file, is not a lesson body).
   */
  rule: CurriculumRule | LessonRule;
  severity: CurriculumSeverity;
  file: string;
  path: string;
  message: string;
}

/** What each rule enforces, as `validate-content.mjs` prints it for the multi-agent review (MAR). */
export const CURRICULUM_RULES: Readonly<Record<CurriculumRule | CurriculumReport, string>> = {
  'lesson-new-load': 'At most 8 new items per quest: Discover items not taught earlier on the route, in the pack or in an earlier quest of the file (F-CURR-002 §9.3).',
  'lesson-recycle':
    'At least 30% of a Volume 2 or pack quest\'s Practice and Check items were taught in earlier quests of the route or the pack (§5.1, §6.4).',
  'lesson-check-variety':
    'Check rotation (§7.1): no game kind in more than 40% of a stage\'s Checks; from Stage 2 on every Check has at least 1 read-meaning or produce round (a produce or read-meaning game, or a Listen & Pick round that shows its Korean prompt, `promptShown: true`, and whose options are meanings: pictures or English labels; a heard Listen & Pick is the recognize rung of §4.3 and does not count); no two adjacent quests share their Practice, Apply and Check games.',
  'lesson-culture-coverage': 'At least 2 culture notes in each Volume 2 cell and at least 1 in each pack level (§5.1, §6.4).',
  'culture-source':
    'Every note has a source from the §6.6 allowlist: the publisher names the institution (its whole English name, or its Korean name) and the URL is on a host the institution runs. MAR: check each institution\'s name as of the source\'s access date (the lint knows two renames: the Korea Heritage Service was the Cultural Heritage Administration, 문화재청, before 2024-05-17, and 국립공원공단 was 국립공원관리공단 before 2019-01-17), and use Ramsar sources for Ramsar site status only.',
  'items-stable-id':
    'Review-item ids are frozen (§4.2): every item taught by a ready cell, pack level, story or Stage 1 has its id in packages/content-schema/src/review-items/items-stable-id.json (node scripts/build-review-items.mjs --freeze adds new ones); a frozen id that is no longer taught needs an alias (the edited text\'s key -> the frozen id, so the item keeps its learner state) or its place on the retired list (removed from every round: never selected, state kept, out of mastery denominators); a retired id is never taught again; a homograph\'s gloss names one sense of content/vocab/_senses.json.',
  'pack-skeleton':
    'A pack follows the template of §6.4: pack.json lists its levels at S2, S3, S4, S6, S7 in that order (all five once the pack is ready), and each ready level has three quests, the new-item caps and its one new pattern, exchange or frame, the formats, three new realia in L4, the two pack cards and the Pack Check in L5. A draft level (the CM-50a scaffold) is checked for its ids, stage and file name only.',
  'dictation-unambiguous':
    'An item asked by ear (Dictation, or a heard round whose options are spellings) has exactly one spelling among the taught items with its pronunciation, unless the prompt shows a picture or the gloss that settles it (a label on the answer option alone does not, as it gives the answer away). Taught items are those met by that quest on the route or in the pack. An item with a sound change (tensification such as 학교 [학꾜] included) stays out of Dictation until recordings A-9 and A-10 exist (§4.5).',
  'story-order-text': 'At least 1 Story Order round in 2 has captions only, or captions that settle the order on their own (`captionsSettleOrder: true`, checked by MAR) (§7.1 F5).',
  'story-topic-unique':
    'A new story declares its topicTags, and shares no topic (a topic tag or a story slug, compared both ways) and no source URL with another story in content/stories/ (§5.1).',
  'review-copy':
    'Learner review strings show no percentage and no "n of m" or "n/m" score; new learner copy has no age wording, no speaking UI and no emoji (§4.5, §9.3).',
  'freq-coverage':
    'Report only: the share of taught words on the NIKL 2003 learner vocabulary list, grade A. Its licence is not yet checked, so the list is read at build time from a local file outside the repo (HANGUL_ROUTE_NIKL_GRADE_A), never committed and never bundled (§19 assumption 4).',
  'story-coverage': 'Report only: for each story tier, the share of its Korean tokens taught by the story\'s recommended stage; the authoring target is 95% (§4.7).',
};

/** Rules defined by name only, with no check yet (none since row CM-10 added `items-stable-id`). */
export const CURRICULUM_STUB_RULES: readonly CurriculumRule[] = [];

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
/**
 * Check games that show the Korean and ask its meaning, a picture or a reply (§4.3 read rung).
 * Story Sequence is not here: its steps need only English labels, and their art can settle the
 * order. Listen & Pick is not here either: its prompt is heard (the Korean shows only when sound
 * cannot play), so hearing a word and picking its picture is the recognize rung. Read Pick
 * Meaning (the S2 default Check) counts by its rounds (isReadMeaningRound).
 */
export const READ_MEANING_KINDS: ReadonlySet<string> = new Set([
  'card-match',
  'pic-word-match',
  'realia-read',
  'tap-respond',
  'role-play',
  'story-order',
]);

/**
 * A Read Pick Meaning round: a Listen & Pick round that shows its Korean prompt
 * (`promptShown: true`) and whose every option is a picture or an English label, none a
 * spelling. `promptShown` is the contract for the row that adds Read Pick Meaning: a round
 * without it is heard, the recognize rung of §4.3, and is not a read-meaning round.
 */
export function isReadMeaningRound(round: unknown): boolean {
  if (typeof round !== 'object' || round === null) return false;
  const { options, promptShown } = round as Record<string, unknown>;
  return (
    promptShown === true &&
    Array.isArray(options) &&
    options.length > 0 &&
    options.every((o) => isRecord(o) && o.text === undefined && (o.pictureRef !== undefined || o.labelEn !== undefined))
  );
}

/** One institution of the §6.6 allowlist, by its English and Korean names and the hosts it runs. */
export interface SourceInstitution {
  name: string;
  ko: string;
  /** Other names that also identify it (a part of it, a common short form). */
  aliases?: readonly string[];
  /** Its earlier name, used for sources accessed before `until` (YYYY-MM-DD). */
  formerly?: { name: string; ko: string; until: string };
  /**
   * The domains it publishes on; a source counts only from one of them or a subdomain. An entry
   * with a path (`cheongju.go.kr/jikjiworld`) also needs the URL's path to start with it, for an
   * institution whose site is a section of a larger one.
   */
  hosts: readonly string[];
}

/** F-CURR-002 §6.6, the source allowlist of `culture-source`. */
export const CULTURE_SOURCE_ALLOWLIST: readonly SourceInstitution[] = [
  { name: 'National Hangeul Museum', ko: '국립한글박물관', hosts: ['hangeul.go.kr'] },
  { name: 'National Institute of Korean Language', ko: '국립국어원', hosts: ['korean.go.kr'] },
  { name: 'National Museum of Korea', ko: '국립중앙박물관', hosts: ['museum.go.kr'] },
  { name: 'National Folk Museum of Korea', ko: '국립민속박물관', hosts: ['nfm.go.kr'] },
  {
    name: 'Korea Heritage Service',
    ko: '국가유산청',
    formerly: { name: 'Cultural Heritage Administration', ko: '문화재청', until: '2024-05-17' },
    hosts: ['khs.go.kr', 'heritage.go.kr', 'cha.go.kr'],
  },
  { name: 'National Gugak Center', ko: '국립국악원', hosts: ['gugak.go.kr'] },
  { name: 'Cheongju Early Printing Museum', ko: '청주고인쇄박물관', hosts: ['cheongju.go.kr/jikjiworld'] },
  { name: 'Korea Astronomy and Space Science Institute', ko: '한국천문연구원', hosts: ['kasi.re.kr'] },
  { name: 'Korea Meteorological Administration', ko: '기상청', hosts: ['kma.go.kr', 'weather.go.kr'] },
  {
    name: 'Korea National Park Service',
    ko: '국립공원공단',
    // 국립공원관리공단 until the amended act took effect on 2019-01-17; the English name did not change.
    formerly: { name: 'Korea National Park Service', ko: '국립공원관리공단', until: '2019-01-17' },
    hosts: ['knps.or.kr'],
  },
  { name: 'National Institute of Biological Resources', ko: '국립생물자원관', hosts: ['nibr.go.kr'] },
  { name: 'National Institute of Ecology', ko: '국립생태원', aliases: ['National Wetlands Center', '국립습지센터'], hosts: ['nie.re.kr'] },
  { name: 'Ramsar Convention Secretariat', ko: '람사르협약', aliases: ['Ramsar Convention'], hosts: ['ramsar.org'] },
  { name: 'Korea Tourism Organization', ko: '한국관광공사', hosts: ['visitkorea.or.kr', 'knto.or.kr'] },
  { name: 'Bank of Korea', ko: '한국은행', hosts: ['bok.or.kr'] },
  { name: 'Ministry of Government Legislation', ko: '법제처', hosts: ['moleg.go.kr', 'law.go.kr'] },
  { name: 'Kukkiwon', ko: '국기원', hosts: ['kukkiwon.or.kr'] },
  { name: 'UNESCO', ko: '유네스코', hosts: ['unesco.org'] },
];

export interface InstitutionMatch {
  institution: SourceInstitution;
  /** False when the publisher uses a name the institution did not have on the access date. */
  nameAsOfAccess: boolean;
}

const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * True when `publisher` names `name`: a Latin name as whole words (so the National Museum of
 * Korea is not the National Museum of Korean Contemporary History), a Korean name as written.
 */
function namesInstitution(publisher: string, name: string): boolean {
  if (/[가-힣]/.test(name)) return publisher.includes(name);
  return new RegExp(`(?<![A-Za-z0-9-])${escapeRe(name)}(?![A-Za-z0-9-])`, 'i').test(publisher);
}

/** True when the URL is on `entry`: its domain or a subdomain, and under its path when it has one. */
const onHost = (url: URL, entry: string): boolean => {
  const slash = entry.indexOf('/');
  const domain = slash < 0 ? entry : entry.slice(0, slash);
  const prefix = slash < 0 ? '' : entry.slice(slash);
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  return (host === domain || host.endsWith(`.${domain}`)) && (prefix === '' || path === prefix || path.startsWith(`${prefix}/`));
};
const parseUrl = (url: string): URL | undefined => {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
};

/**
 * The allowlisted institution a source names, judged by its access date. With a `url`, the
 * source counts only when its host is one the institution runs, so neither a publisher string
 * on another site nor a body whose name contains an allowlisted one (the Korean National
 * Commission for UNESCO, the Export-Import Bank of Korea) passes.
 */
export function allowlistedInstitution(publisher: string, accessed: string, url?: string): InstitutionMatch | undefined {
  const parsed = url === undefined ? undefined : parseUrl(url);
  const names = (...list: string[]): boolean => list.some((n) => namesInstitution(publisher, n));
  for (const institution of CULTURE_SOURCE_ALLOWLIST) {
    const current = names(institution.name, institution.ko, ...(institution.aliases ?? []));
    const former = institution.formerly !== undefined && names(institution.formerly.name, institution.formerly.ko);
    if (!current && !former) continue;
    if (url !== undefined && (parsed === undefined || !institution.hosts.some((d) => onHost(parsed, d)))) continue;
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
  /** A pack level with `status: 'draft'` (the CM-50a scaffold): pack-skeleton checks its ids only. */
  draft: boolean;
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
function lessonsBefore(entry: LessonEntry, lessons: readonly LessonEntry[]): LessonEntry[] {
  const before = (other: LessonEntry): boolean => {
    if (other === entry) return false;
    if (entry.tier === 'volume1') return other.tier === 'volume1' && other.stage < entry.stage;
    if (entry.tier === 'volume2') return (other.tier === 'volume1' && other.stage <= entry.stage) || (other.tier === 'volume2' && other.stage < entry.stage);
    return (other.tier === 'volume1' && other.stage <= entry.stage) || (other.pack === entry.pack && other.stage < entry.stage);
  };
  return lessons.filter(before);
}

function priorKnown(entry: LessonEntry, lessons: readonly LessonEntry[]): Set<string> {
  return new Set(lessonsBefore(entry, lessons).flatMap((o) => o.known));
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

/** True when the Check holds at least 1 read-meaning or produce round (§7.1). */
function checkHasReadOrProduceRound(quest: LessonBodyQuest, kind: string): boolean {
  if (PRODUCE_KINDS.has(kind) || READ_MEANING_KINDS.has(kind)) return true;
  const rounds = scopeOfStep(quest, 'check')?.rounds;
  return kind === 'listen-pick' && Array.isArray(rounds) && rounds.some(isReadMeaningRound);
}

function lintQuestChecks(entry: LessonEntry, add: Add): void {
  const triples = entry.body.quests.map((q) => ['practice', 'apply', 'check'].map((k) => stepGameKind(q, k) ?? '-').join(' / '));
  entry.body.quests.forEach((quest, qi) => {
    const check = stepGameKind(quest, 'check');
    if (check !== undefined && entry.stage >= 2 && !checkHasReadOrProduceRound(quest, check)) {
      add('lesson-check-variety', pathOf('quests', qi), `the Check plays ${check} with no read-meaning or produce round; from Stage 2 on every Check has at least 1`);
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
    const matches = sources.map((s) => allowlistedInstitution(s.publisher, s.accessed, s.url));
    if (!matches.some((m) => m !== undefined)) {
      add('culture-source', pathOf('culture', ni, 'sources'), 'no source is from the F-CURR-002 §6.6 allowlist of public institutions, on a host the institution runs');
    }
    matches.forEach((m, si) => {
      if (m === undefined || m.nameAsOfAccess) return;
      const s = sources[si] as LessonBodySource;
      const { formerly } = m.institution;
      const expected = formerly !== undefined && s.accessed < formerly.until ? formerly : m.institution;
      // A note restating a story fact is reported on its factRef: the fact's source is fixed in the story.
      const at = note.sources === undefined ? pathOf('culture', ni, 'factRef') : pathOf('culture', ni, 'sources', si, 'publisher');
      add('culture-source', at, `on ${s.accessed} the institution was called the ${expected.name} (${expected.ko})`);
    });
  });
}

/** Spellings of the taught items, by pronunciation key. */
type Homophones = Map<string, Set<string>>;

/** Adds the spellings a quest's Discover units teach. */
function addTaught(map: Homophones, quest: LessonBodyQuest): void {
  for (const unit of questUnits(quest)) {
    for (const ko of unit.texts) {
      const key = pronunciationKey(ko);
      const set = map.get(key) ?? new Set<string>();
      set.add(ko);
      map.set(key, set);
    }
  }
}

function otherSpellings(ko: string, homophones: Homophones, alsoHeard: readonly string[]): string[] {
  const key = pronunciationKey(ko);
  const spellings = new Set([...(homophones.get(key) ?? []), ...alsoHeard.filter((o) => pronunciationKey(o) === key)]);
  spellings.delete(ko);
  return [...spellings];
}

/** True when the prompt shows the gloss as whole words ("day" is not shown by "today"). */
function glossShown(prompt: string, gloss: string): boolean {
  const g = gloss.trim();
  return g !== '' && new RegExp(`(?<![a-z0-9])${escapeRe(g)}(?![a-z0-9])`, 'i').test(prompt);
}

/**
 * `dictation-unambiguous`. The taught items are those the learner has met by the quest: what
 * the route or the pack taught before the file (the scope of lesson-new-load), the file's earlier
 * quests and the quest's own Discover pages. A later stage or another pack does not count.
 */
function lintDictation(entry: LessonEntry, lessons: readonly LessonEntry[], add: Add): void {
  const homophones: Homophones = new Map();
  for (const other of lessonsBefore(entry, lessons)) for (const quest of other.body.quests) addTaught(homophones, quest);
  entry.body.quests.forEach((quest, qi) => {
    addTaught(homophones, quest);
    quest.scopes.forEach((scope, si) => {
      const rounds = Array.isArray(scope.rounds) ? scope.rounds.filter(isRecord) : [];
      rounds.forEach((round, ri) => {
        const at = pathOf('quests', qi, 'scopes', si, 'rounds', ri);
        if (scope.kind === 'type-hangul' && round.mode === 'hear') {
          const target = isRecord(round.target) ? round.target : {};
          const ko = normalizeKo(String(target.ko ?? ''));
          const gloss = typeof target.en === 'string' ? target.en.toLowerCase() : undefined;
          const settled = round.pictureRef !== undefined || (gloss !== undefined && glossShown(String(round.promptEn ?? ''), gloss));
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
          // Only the prompt settles it: a picture on the round, or the gloss in its shown line. A label on
          // the answer option alone would give the answer away, so it does not count.
          const glosses = [isRecord(round.prompt) ? round.prompt.en : undefined, answer.text.en, answer.labelEn].filter((g): g is string => typeof g === 'string');
          const settled = round.pictureRef !== undefined || glosses.some((g) => glossShown(String(round.promptEn ?? ''), g));
          const others = otherSpellings(ko, homophones, heard);
          if (others.length > 0 && !settled) {
            add('dictation-unambiguous', at, `${ko} sounds like ${others.join(', ')}; a heard round with spelling options shows a picture (pictureRef) or the gloss (promptEn) on its prompt`);
          }
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
  /**
   * New items per quest by kind (the total is capped by `lesson-new-load`); a kind not listed
   * may not be new at that level. A frame (L5) is a `pattern` unit.
   */
  maxNew: Partial<Record<TaughtUnitKind, number>>;
  /** New items every quest of the level must bring: L2 its pattern, L3 its exchange, L5 its frame. */
  minNew?: Partial<Record<TaughtUnitKind, number>>;
  /** Practice and Apply games of the level's rotation. */
  formats: readonly string[];
  newRealia: number;
  cards: number;
  /** Items in the Pack Check that the L5 file declares (`packCheck.items`). */
  packCheckItems?: number;
}
export const PACK_TEMPLATE: readonly PackLevelTemplate[] = [
  { stage: 'stage2', quests: 3, maxNew: { word: 8 }, formats: ['pic-word-match', 'card-match', 'syllable-build'], newRealia: 0, cards: 0 },
  { stage: 'stage3', quests: 3, maxNew: { pattern: 1, word: 4 }, minNew: { pattern: 1 }, formats: ['order-it', 'cloze-pick'], newRealia: 0, cards: 0 },
  { stage: 'stage4', quests: 3, maxNew: { exchange: 1, word: 4 }, minNew: { exchange: 1 }, formats: ['role-play', 'tap-respond', 'story-order'], newRealia: 0, cards: 1 },
  { stage: 'stage6', quests: 3, maxNew: { word: 6 }, formats: ['realia-read', 'type-hangul'], newRealia: 3, cards: 0 },
  {
    stage: 'stage7',
    quests: 3,
    maxNew: { pattern: 1, word: 3 },
    minNew: { pattern: 1 },
    formats: ['write-frame', 'my-story'],
    newRealia: 0,
    cards: 1,
    packCheckItems: 10,
  },
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

const TAUGHT_UNIT_KINDS: readonly TaughtUnitKind[] = ['word', 'sentence', 'pattern', 'exchange'];

/**
 * `pack-skeleton` over one pack directory. pack.json lists the levels that exist, in template
 * order (1 to 5 while the pack is a draft, all 5 once it is ready). A level file with
 * `status: 'draft'` (the CM-50a scaffold) is checked for its ids, stage and file name only; a
 * ready level gets the template's content checks. A level missing from a draft pack is not an
 * error, so a pack can land one level PR at a time (§6.4, §9.1).
 */
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
  const ready = manifest.status === 'ready';
  if (!ready && manifest.status !== 'draft') issue(manifestFile, 'status', "a pack's status is 'draft' or 'ready'");
  const levels = Array.isArray(manifest.levels) ? manifest.levels : [];
  if (levels.length < 1 || levels.length > PACK_TEMPLATE.length) issue(manifestFile, 'levels', `a pack lists 1 to ${PACK_TEMPLATE.length} levels (has ${levels.length})`);
  else if (ready && levels.length !== PACK_TEMPLATE.length) issue(manifestFile, 'levels', `a ready pack has all ${PACK_TEMPLATE.length} levels (has ${levels.length})`);

  // Each listed level is a template row, in template order, with its episode id.
  const listed = new Map<number, number>();
  let lastRow = -1;
  const order = PACK_TEMPLATE.map((t) => t.stage).join(', ');
  levels.forEach((level, li) => {
    const row = isRecord(level) ? PACK_TEMPLATE.findIndex((t) => t.stage === level.stage) : -1;
    const template = PACK_TEMPLATE[row];
    if (template === undefined || row <= lastRow) {
      issue(manifestFile, pathOf('levels', li), `levels are listed once each, in the order ${order}`);
      return;
    }
    lastRow = row;
    listed.set(row, li);
    const episodeId = `episode:pack-${key}-s${stageNumberOf(template.stage)}`;
    if ((level as Record<string, unknown>).episodeId !== episodeId) issue(manifestFile, pathOf('levels', li), `the ${template.stage} level has episodeId ${episodeId}`);
  });

  const seenRealia = new Set<string>();
  PACK_TEMPLATE.forEach((template, row) => {
    const n = stageNumberOf(template.stage);
    const file = `content/packs/${key}/stage-${n}.json`;
    const li = listed.get(row);
    if (li === undefined) {
      if (tree.has(file)) issue(file, '(root)', `stage-${n}.json is not listed in ${manifestFile} levels`);
      return;
    }
    const entry = lessons.find((e) => e.file === file);
    if (entry === undefined) {
      // A file that is there but not a lesson body is reported as lesson-schema.
      if (!tree.has(file) && ready) issue(manifestFile, pathOf('levels', li), `${file} is missing`);
      return;
    }
    const { body } = entry;
    const level = `level ${row + 1}`;
    const episodeId = `episode:pack-${key}-s${n}`;
    if (body.id !== episodeId) issue(file, 'id', `${level} has id ${episodeId}`);
    if (body.stage !== template.stage) issue(file, 'stage', `${level} is at ${template.stage}`);
    body.quests.forEach((quest, qi) => {
      const questId = `quest:pack-${key}-s${n}-q${qi + 1}`;
      if (quest.id !== questId) issue(file, pathOf('quests', qi, 'id'), `quest ${qi + 1} of this level has id ${questId}`);
    });
    const refs = realiaRefs(body);
    const fresh = [...refs].filter((r) => !seenRealia.has(r)).length;
    for (const r of refs) seenRealia.add(r);
    if (entry.draft) {
      if (ready) issue(file, 'status', `a ready pack has ready levels; ${level} is a draft`);
      return;
    }
    if (body.quests.length !== template.quests) issue(file, 'quests', `a pack level has ${template.quests} quests (has ${body.quests.length})`);
    const known = priorKnown(entry, lessons);
    body.quests.forEach((quest, qi) => {
      const units = questUnits(quest).filter((u) => !known.has(u.key));
      for (const kind of TAUGHT_UNIT_KINDS) {
        const count = units.filter((u) => u.kind === kind).length;
        const max = template.maxNew[kind] ?? 0;
        const min = template.minNew?.[kind] ?? 0;
        if (count > max) issue(file, pathOf('quests', qi), `${level} brings at most ${max} new ${kind} item(s) a quest (has ${count})`);
        if (count < min) issue(file, pathOf('quests', qi), `every quest of ${level} brings ${min} new ${kind} item(s) (has ${count})`);
      }
      for (const ko of questKnownAfter(quest)) known.add(ko);
      for (const step of ['practice', 'apply']) {
        const kind = stepGameKind(quest, step);
        if (kind !== undefined && !template.formats.includes(kind)) {
          issue(file, pathOf('quests', qi), `the ${step} game of ${level} is one of ${template.formats.join(', ')}, not ${kind}`);
        }
      }
    });
    if (fresh < template.newRealia) issue(file, 'quests', `${level} shows ${template.newRealia} new realia (has ${fresh})`);
    if (body.rewardCardIds.length !== template.cards) issue(file, 'rewardCardIds', `${level} gives ${template.cards} pack card(s) (has ${body.rewardCardIds.length})`);
    if (template.packCheckItems !== undefined) {
      const items = isRecord(body.packCheck) ? body.packCheck.items : undefined;
      if (items !== template.packCheckItems) issue(file, 'packCheck', `${level} ships the Pack Check: packCheck.items is ${template.packCheckItems}`);
    }
  });
}

/** A source URL as compared by story-topic-unique: no scheme, no `www.`, no fragment, no trailing slash. */
const normalizeUrl = (url: string): string => {
  try {
    const u = new URL(url);
    return `${u.host.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url.trim();
  }
};

const topicTagsOf = (raw: Record<string, unknown>): string[] =>
  Array.isArray(raw.topicTags) ? raw.topicTags.filter((t): t is string => typeof t === 'string') : [];

/** A story's topics: its slug and its topicTags (`StoryObjectSchema.topicTags`). */
function storyTopics(raw: Record<string, unknown>): Set<string> {
  return new Set([String(raw.id).replace(/^story:/, ''), ...topicTagsOf(raw)]);
}

function storyUrls(raw: Record<string, unknown>): Set<string> {
  const facts = Array.isArray(raw.facts) ? raw.facts.filter(isRecord) : [];
  const sources = facts.flatMap((f) => (Array.isArray(f.sources) ? f.sources.filter(isRecord) : []));
  return new Set(sources.map((s) => s.url).filter((u): u is string => typeof u === 'string').map(normalizeUrl));
}

/**
 * `story-topic-unique` for a new story: it declares its topicTags, and none of its topics (its
 * slug and tags) is a topic of another story, compared both ways, and no source URL is shared.
 */
function lintStoryTopic(story: StoryEntry, stories: readonly StoryEntry[], add: Add): void {
  if (topicTagsOf(story.raw).length === 0) {
    add('story-topic-unique', 'topicTags', 'a new story declares its topicTags (1 to 5 topic slugs), so book 2 can be checked against the shipped stories');
  }
  const own = storyTopics(story.raw);
  const urls = storyUrls(story.raw);
  for (const other of stories) {
    if (other === story) continue;
    const topics = storyTopics(other.raw);
    for (const topic of own) {
      if (topics.has(topic)) add('story-topic-unique', 'topicTags', `topic ${topic} is already a topic of ${String(other.raw.id)}`);
    }
    for (const url of storyUrls(other.raw)) if (urls.has(url)) add('story-topic-unique', 'facts', `${url} is already a source of ${String(other.raw.id)}`);
  }
}

export interface CurriculumLintOptions {
  /** The stories whose findings stay warnings (default: SHIPPED_STORY_IDS). */
  shippedStoryIds?: ReadonlySet<string>;
  /** Today as YYYY-MM-DD, for the `accessed` dates of Volume 2 and pack sources (no clock is read here). */
  today?: string;
}

/** A pack key: lower-case letters and digits in hyphenated words (`numbers-time`). */
const PACK_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Any JSON file of an upper-stage directory; the lesson files of it are LESSON_FILE_RE. */
const UPPER_STAGE_FILE_RE = /^content\/episodes\/stage-[2-467]\/.+\.json$/;
/** A locale overlay of content (`content/i18n/<locale>/<domain>.json`, F-I18N-001 §3.7). */
const OVERLAY_FILE_RE = /^content\/i18n\/([a-z]{2})\/[^/]+\.json$/;

/** The story facts of a tree, by slug, for the factRef rule of Volume 2 and pack notes. */
function storyFactsOf(tree: ReadonlyMap<string, unknown>): Map<string, Set<string>> {
  const facts = new Map<string, Set<string>>();
  for (const [file, raw] of tree) {
    if (!STORY_FILE_RE.test(file) || !isRecord(raw) || !Array.isArray(raw.facts)) continue;
    const ids = raw.facts.filter(isRecord).map((f) => f.id).filter((id): id is string => typeof id === 'string');
    facts.set(file.slice('content/stories/'.length, -'.json'.length), new Set(ids));
  }
  return facts;
}

/**
 * The F-CURR-001 lesson rules of `lintLessonCell` that do not depend on the Volume 1 cell schema,
 * on a Volume 2 cell or a ready pack level, as errors: each note's schema and sources (two or more,
 * one public, https, an allow-listed host, not accessed in the future), factRefs, copying and
 * verification; no speaking step; both review sign-offs on a ready file; no designation numbers.
 * Rows CM-40 and CM-50a add the strict schemas of those files.
 */
function lintStrictLesson(entry: LessonEntry, ctx: { today: string; storyFacts: ReadonlyMap<string, ReadonlySet<string>> }, add: Add): void {
  const ready = entry.body.status === 'ready';
  const notes: Array<LessonNote | undefined> = entry.body.culture.map((raw, ni) => {
    const parsed = LessonNoteSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    for (const issue of parsed.error.issues) {
      const named = /^(lesson-[a-z-]+): /.exec(issue.message);
      const at = pathOf('culture', ni, ...issue.path);
      if (named !== null) add(named[1] as LessonRule, at, issue.message.slice(named[0].length));
      else add('lesson-schema', at, issue.message);
    }
    return undefined;
  });
  lintLessonNotes(notes, ready, ctx, add);
  entry.body.quests.forEach((quest, qi) => {
    quest.steps.forEach((step, si) => {
      if (step.minigameKind === 'voice-echo') add('lesson-no-speaking', pathOf('quests', qi, 'steps', si, 'minigameKind'), 'no lesson step records or asks for speech');
    });
    quest.scopes.forEach((scope, si) => {
      if (scope.kind === 'voice-echo') add('lesson-no-speaking', pathOf('quests', qi, 'scopes', si, 'kind'), 'no lesson step records or asks for speech');
    });
  });
  if (ready) {
    const review = LessonReviewSchema.safeParse(entry.body.review);
    if (!review.success || !isLessonSignedOff(review.data)) {
      add('lesson-review-unsigned', 'review', 'a ready file needs both multi-agent review sign-offs, reviewedBy and reviewedAt');
    }
  }
  lintDesignationNumbers(entry.body, add);
}

/** The ids a strict-tier file owns, whose overlay entries are new copy too. */
function strictEntityIds(entry: LessonEntry): string[] {
  return [entry.body.id, ...entry.body.quests.flatMap((q) => [q.id, ...q.scopes.map((s) => s.ref)])];
}

/** `review-copy` on the Spanish and Korean overlays of new content: age wording and emoji, by locale. */
function lintOverlayCopy(file: string, locale: string, raw: unknown, owned: ReadonlyMap<string, CurriculumTier>, push: Push): void {
  const entries = isRecord(raw) && isRecord(raw.entries) ? raw.entries : {};
  for (const [id, fields] of Object.entries(entries)) {
    const tier = owned.get(id);
    if (tier === undefined || !isRecord(fields)) continue;
    for (const [field, text] of Object.entries(fields)) {
      if (typeof text !== 'string') continue;
      for (const problem of localeCopyProblems(text, locale)) {
        push(file, tier, { rule: 'review-copy', path: `entries.${id}.${field}`, message: reviewCopyMessage(problem) });
      }
    }
  }
}

type Push = (file: string, tier: CurriculumTier, f: Omit<CurriculumFinding, 'file' | 'severity'>) => void;

/** The tier of the file an item was read from: its cell (an episode, a pack level, a story); Stage 1 is Volume 1. */
function tierOfCell(cell: string, shipped: ReadonlySet<string>): CurriculumTier {
  if (cell.startsWith('story:')) return shipped.has(cell) ? 'shipped-story' : 'new-story';
  if (cell.startsWith('episode:pack-')) return 'pack';
  return /-v[0-9]+$/.test(cell) ? 'volume2' : 'volume1';
}

/**
 * `items-stable-id` (§4.2, row CM-10), over the tree when it holds the frozen-id snapshot
 * (`REVIEW_SNAPSHOT_FILE`; validate-content.mjs adds it and the frozen Stage 1 table). An issue of an
 * item is reported on the file that teaches it, an issue of the snapshot itself (a frozen id no
 * longer taught, an alias or retirement that names no frozen id) on the snapshot. Only a new item
 * not frozen yet takes its file's severity (a warning for Volume 1 and a shipped story); every other
 * issue is an error whatever the file, as scripts/build-review-items.mjs (`isBlocking`) stops the
 * build, and with it `pnpm install` and the dev server, on it.
 */
function lintStableIds(tree: ReadonlyMap<string, unknown>, shipped: ReadonlySet<string>, push: Push): void {
  const raw = tree.get(REVIEW_SNAPSHOT_FILE);
  if (raw === undefined) return;
  const snapshot = StableIdSnapshotSchema.safeParse(raw);
  const stage1Raw = tree.get(REVIEW_STAGE1_FILE);
  const stage1 = stage1Raw === undefined ? undefined : Stage1TableSchema.safeParse(stage1Raw);
  for (const [file, parsed] of [[REVIEW_SNAPSHOT_FILE, snapshot], [REVIEW_STAGE1_FILE, stage1]] as const) {
    if (parsed === undefined || parsed.success) continue;
    const first = parsed.error.issues[0] as z.ZodIssue;
    push(file, 'volume2', { rule: 'items-stable-id', path: pathOf(...first.path) || '(root)', message: `not a valid frozen review-item file: ${first.message}` });
  }
  if (!snapshot.success || stage1?.success === false) return;
  const table: Stage1Table = stage1?.data ?? { schemaVersion: 1, symbols: [], occurrences: [] };
  const { issues } = reviewItemsOf({
    stage1: table,
    lessons: lessonSourcesOfTree(tree),
    stories: storySourcesOfTree(tree),
    ...vocabOfTree(tree),
    snapshot: snapshot.data,
  });
  for (const issue of issues) {
    const where = issueWhere(issue);
    const tier = issue.code === 'not-frozen' && issue.cell !== undefined ? tierOfCell(issue.cell, shipped) : 'volume2';
    push(where.file, tier, { rule: 'items-stable-id', path: where.path, message: issue.message });
  }
}

/** The file and path an issue points at: the occurrence's (`<file> <path>`), else the snapshot entry. */
function issueWhere(issue: StableIdIssue): { file: string; path: string } {
  if (issue.at !== undefined) {
    const space = issue.at.indexOf(' ');
    const head = space < 0 ? issue.at : issue.at.slice(0, space);
    // A Stage 1 occurrence is read from the frozen table (`quest:stage1-... steps[...]`).
    if (!head.includes('/')) return { file: REVIEW_STAGE1_FILE, path: issue.at };
    return { file: head, path: space < 0 ? '(root)' : issue.at.slice(space + 1) };
  }
  if (issue.code === 'retired-unknown') return { file: REVIEW_SNAPSHOT_FILE, path: `retired.${issue.id}` };
  if (issue.code === 'alias-target-unknown' || issue.code === 'alias-clash') return { file: REVIEW_SNAPSHOT_FILE, path: `alias.${issue.key}` };
  return { file: REVIEW_SNAPSHOT_FILE, path: `ids.${issue.key}` };
}

/**
 * Every F-CURR-002 §9.3 finding over a content tree (`content/...` path -> parsed JSON), with
 * its severity: an error for Volume 2 cells, pack files and new stories, a warning for Volume 1
 * cells and shipped stories. A file under `content/packs/` or an upper-stage directory whose path
 * no lesson or pack layout accepts is an error. Other files are ignored.
 */
export function lintCurriculum(tree: ReadonlyMap<string, unknown>, opts: CurriculumLintOptions = {}): CurriculumFinding[] {
  const shipped = opts.shippedStoryIds ?? SHIPPED_STORY_IDS;
  const findings: CurriculumFinding[] = [];
  const push: Push = (file, tier, f) => {
    findings.push({ ...f, file, severity: severityOf(tier) });
  };
  const files = [...tree.keys()].sort();

  const lessons: LessonEntry[] = [];
  const packFiles = new Map<string, string[]>();
  for (const file of files) {
    const raw = tree.get(file);
    if (file.startsWith('content/packs/') && file !== PACK_ORDER_FILE) {
      const [dir, ...rest] = file.slice('content/packs/'.length).split('/');
      const misplaced =
        rest.length === 0
          ? `${dir} sits directly in content/packs/; only order.json does, and a pack's files go in content/packs/<key>/`
          : !PACK_KEY_RE.test(dir as string)
            ? `${dir} is not a pack key (lower-case letters and digits in hyphenated words)`
            : rest.length > 1
              ? `${rest.join('/')} is nested; a pack holds pack.json and stage-<n>.json directly in its directory`
              : undefined;
      if (misplaced !== undefined) {
        push(file, 'pack', { rule: 'pack-skeleton', path: '(root)', message: misplaced });
        continue;
      }
    }
    const lesson = LESSON_FILE_RE.exec(file);
    const pack = PACK_FILE_RE.exec(file);
    if (pack !== null) packFiles.set(pack[1] as string, [...(packFiles.get(pack[1] as string) ?? []), file]);
    const level = pack === null ? null : PACK_LEVEL_NAME_RE.exec(pack[2] as string);
    if (lesson === null && level === null) {
      if (UPPER_STAGE_FILE_RE.test(file)) {
        push(file, 'volume2', { rule: 'lesson-schema', path: '(root)', message: 'a lesson file is content/episodes/stage-<n>/<theme>.json, or <theme>.v<k>.json for volume k >= 2, with theme letters, life, rites, nature or crafts' });
      }
      continue;
    }
    const pathVolume = lesson?.[3] === undefined ? 1 : Number(lesson[3]);
    if (lesson?.[3] !== undefined && pathVolume < 2) {
      push(file, 'volume2', { rule: 'lesson-schema', path: '(root)', message: `Volume ${pathVolume} has no .v${lesson[3]} file name; Volume 1 is <theme>.json and volume k >= 2 is <theme>.v<k>.json` });
      continue;
    }
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
    const draft = tier === 'pack' && body.status === 'draft';
    lessons.push({ file, tier, stage, pack: pack?.[1], draft, body, known: body.quests.flatMap(questKnownAfter) });
  }

  const stories: StoryEntry[] = files
    .filter((file) => STORY_FILE_RE.test(file))
    .map((file) => ({ file, raw: tree.get(file) }))
    .filter((s): s is { file: string; raw: Record<string, unknown> } => isRecord(s.raw) && typeof s.raw.id === 'string')
    .map((s) => ({ ...s, tier: shipped.has(String(s.raw.id)) ? 'shipped-story' : 'new-story' }));

  const strictCtx = { today: opts.today ?? '9999-12-31', storyFacts: storyFactsOf(tree) };
  // Content rules wait for a ready pack level; its ids are pack-skeleton's, its copy review-copy's.
  const content = lessons.filter((e) => !e.draft);
  for (const entry of lessons) {
    const add: Add = (rule, path, message) => push(entry.file, entry.tier, { rule, path, message });
    lintNewCopy(entry.body, '', LESSON_REFERENCE_KEYS, add);
    if (entry.draft) continue;
    lintLoadAndRecycle(entry, priorKnown(entry, lessons), add);
    lintQuestChecks(entry, add);
    lintCultureCoverage(entry, add);
    lintCultureSource(entry, tree, add);
    lintDictation(entry, lessons, add);
    lintStoryOrder(entry.body.quests, 'quests', add);
    if (entry.tier !== 'volume1') lintStrictLesson(entry, strictCtx, add);
  }
  lintCheckShares(content, push);
  for (const [key, list] of packFiles) lintPack(key, list, tree, lessons, (file, f) => push(file, 'pack', f));
  for (const story of stories) {
    const add: Add = (rule, path, message) => push(story.file, story.tier, { rule, path, message });
    lintStoryOrder(story.raw, '', add);
    lintNewCopy(story.raw, '', STORY_REFERENCE_KEYS, add);
    if (story.tier === 'new-story') lintStoryTopic(story, stories, add);
  }
  const owned = new Map<string, CurriculumTier>();
  for (const entry of lessons) if (entry.tier !== 'volume1') for (const id of strictEntityIds(entry)) owned.set(id, entry.tier);
  for (const story of stories) if (story.tier === 'new-story') owned.set(String(story.raw.id), story.tier);
  for (const file of files) {
    const overlay = OVERLAY_FILE_RE.exec(file);
    if (overlay !== null) lintOverlayCopy(file, overlay[1] as string, tree.get(file), owned, push);
  }
  lintStableIds(tree, shipped, push);
  return findings;
}

/**
 * `review-copy` on the review screens' UI strings: every learner review string of one locale's
 * `learner` messages (`packages/i18n/src/messages/<locale>/learner.ts`). These are always errors:
 * the Hangul Check shows no score today, and every review screen F-CURR-002 adds is new.
 */
export function lintReviewStrings(learner: unknown, file: string): CurriculumFinding[] {
  const locale = /\/messages\/([a-z]{2})\//.exec(file)?.[1] ?? 'en';
  return lintReviewMessages(learner, undefined, locale).map(({ path, problem }) => ({
    rule: 'review-copy' as const,
    severity: 'error' as const,
    file,
    path,
    message: reviewCopyMessage(problem),
  }));
}
