import { STORY_FILE_RE, lessonBodies, normalizeKo, questUnits } from './lesson-lint-items';

/**
 * The two report-only rules of F-CURR-002 §9.3. They print shares for the authors and the
 * multi-agent review and never fail a build. Both read taught Korean by exact text until row
 * CM-10 gives every taught item a stable id; Stage 1 is hand-written TypeScript and joins the
 * reports with that row.
 */

const HANGUL_WORD = /[가-힣]+/;

/**
 * The grade-A words of a local copy of the NIKL 2003 learner vocabulary list
 * (「한국어 학습용 어휘 목록」). Any text export works: each line's first Hangul run is the
 * word, so a homograph number (사과01) or the other columns are dropped. The list is never
 * committed or bundled (§19 assumption 4); `validate-content.mjs` reads it from the path in
 * HANGUL_ROUTE_NIKL_GRADE_A.
 */
export function parseGradeAList(text: string): Set<string> {
  const words = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const word = HANGUL_WORD.exec(line)?.[0];
    if (word !== undefined) words.add(word);
  }
  return words;
}

export interface FreqCoverageRow {
  stage: number;
  taught: number;
  onList: number;
}

/** `freq-coverage`: per stage, the distinct words that lessons and pack levels teach, and how many are grade A. */
export function freqCoverage(tree: ReadonlyMap<string, unknown>, gradeA: ReadonlySet<string>): FreqCoverageRow[] {
  const byStage = new Map<number, Set<string>>();
  for (const { stage, body } of lessonBodies(tree)) {
    const words = byStage.get(stage) ?? new Set<string>();
    for (const quest of body.quests) {
      for (const unit of questUnits(quest)) if (unit.kind === 'word' && HANGUL_WORD.test(unit.key)) words.add(unit.key);
    }
    byStage.set(stage, words);
  }
  return [...byStage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([stage, words]) => ({ stage, taught: words.size, onList: [...words].filter((w) => gradeA.has(w)).length }));
}

/** Endings a taught word may carry in a story line and still count as known (a particle or a polite ending). */
export const STORY_COVERAGE_ENDINGS: readonly string[] = [
  '이', '가', '을', '를', '은', '는', '에', '에서', '에게', '도', '와', '과', '의', '로', '으로', '하고', '랑', '이랑',
  '만', '까지', '부터', '요', '이에요', '예요', '이야', '야', '처럼',
];

const tokensOf = (ko: string): string[] =>
  normalizeKo(ko)
    .split(' ')
    .map((t) => t.replace(/[^가-힣]/g, ''))
    .filter((t) => t !== '');

const isKnown = (token: string, taught: ReadonlySet<string>): boolean =>
  taught.has(token) || STORY_COVERAGE_ENDINGS.some((e) => token.endsWith(e) && taught.has(token.slice(0, -e.length)));

export interface StoryCoverageRow {
  file: string;
  storyId: string;
  tier: string;
  recommendedStage: number;
  tokens: number;
  taught: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const koOf = (value: unknown): string | undefined => (isRecord(value) && typeof value.ko === 'string' ? value.ko : undefined);

/**
 * `story-coverage` (§4.7): for each story tier, its Korean tokens (each scene's line, else its
 * keyword) and how many are taught by the story's recommended stage: words the lessons of that
 * stage and below teach, and the story's own keywords. A token counts with a particle or polite
 * ending from STORY_COVERAGE_ENDINGS.
 */
export function storyCoverage(tree: ReadonlyMap<string, unknown>): StoryCoverageRow[] {
  const lessons = lessonBodies(tree);
  const rows: StoryCoverageRow[] = [];
  for (const [file, raw] of [...tree.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!STORY_FILE_RE.test(file) || !isRecord(raw) || typeof raw.id !== 'string' || !Array.isArray(raw.tiers)) continue;
    const stage = typeof raw.recommendedStage === 'number' ? raw.recommendedStage : 7;
    const taught = new Set<string>();
    for (const lesson of lessons) {
      if (lesson.stage > stage) continue;
      for (const quest of lesson.body.quests) for (const unit of questUnits(quest)) for (const text of [unit.key, ...unit.texts]) tokensOf(text).forEach((t) => taught.add(t));
    }
    for (const keyword of Array.isArray(raw.keywords) ? raw.keywords : []) tokensOf(koOf(keyword) ?? '').forEach((t) => taught.add(t));
    for (const tier of raw.tiers.filter(isRecord)) {
      const scenes = Array.isArray(tier.scenes) ? tier.scenes.filter(isRecord) : [];
      const tokens = scenes.flatMap((s) => tokensOf(koOf(s.line) ?? koOf(s.keyword) ?? ''));
      rows.push({
        file,
        storyId: raw.id,
        tier: String(tier.level),
        recommendedStage: stage,
        tokens: tokens.length,
        taught: tokens.filter((t) => isKnown(t, taught)).length,
      });
    }
  }
  return rows;
}
