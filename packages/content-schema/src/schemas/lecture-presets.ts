import { routeCatalogOf } from '../catalog/route-catalog';
import { storyIsReady, type Catalog } from '../catalog/schema';
import type { RouteQuest } from '../placement/route-seed';
import { StageKeySchema, type StageKey } from './heritage-card';
import {
  LECTURE_MAX_BLOCKS,
  LECTURE_PRESETS,
  LECTURE_REVISIT_CHAR_RE,
  LECTURE_TITLE_RE,
  WORD_REVIEW_MAX_QUESTS,
  WORD_REVIEW_MAX_WORDS,
  deckVersion,
  type LectureBlock,
  type LectureDeckInput,
  type LectureOptions,
  type LecturePreset,
} from './lecture';
import { QUEST_ID_RE } from './quest';
import type { JourneySummary } from './sync';
import { VocabIdSchema } from './vocab';

/**
 * Lecture presets (AMENDMENTS-LECTURE-V2 section 4): six ready-made lessons a
 * first-time presenter starts without picking items. A preset is a rule that turns what is
 * known (a plan, a Learning Route position, what this screen showed before, the
 * bundled catalogue) into ordinary deck blocks. One pure resolver for the
 * console, the presenter and the learner app: it reads only its arguments and
 * the catalogue, so the same preset, length and context give the same blocks on
 * every surface (section 4.3).
 *
 * Nothing here reads or returns a person: the context holds content ids,
 * compatibility jamo and two counts per learner (`classPosition`), every id is
 * checked against its grammar before it reaches a block, and a preset never adds
 * a `class-code` block (LV-D7). Deck titles are the caller's localized preset
 * names (`titleKey`) or, for N1 only, the plan's own title when the caller's
 * `planTitleOk` (the console's `titleProblem`) accepts it. Story time never uses
 * a story's own title.
 */

export type PresetMinutes = 10 | 20 | 30;

/** Section 4.1 "Default". */
export const PRESET_DEFAULT_MINUTES: Readonly<Record<LecturePreset, PresetMinutes>> = {
  'next-lesson': 20,
  'hangul-week-1': 20,
  'by-stage': 20,
  'story-time': 20,
  'word-review': 10,
  'warm-up': 10,
};

/** Section 4.1 "Length chips" (`warm-up` has one length and draws no chips). */
export const PRESET_LENGTHS: Readonly<Record<LecturePreset, readonly PresetMinutes[]>> = {
  'next-lesson': [10, 20, 30],
  'hangul-week-1': [10, 20, 30],
  'by-stage': [10, 20, 30],
  'story-time': [10, 20, 30],
  'word-review': [10, 20],
  'warm-up': [10],
};

/**
 * The presets in display order (section 4.1): the table order, except that with
 * nothing to follow (no plan, no position, no Recent lesson) `hangul-week-1` is
 * first and `next-lesson` is drawn last, with its fallback line under it.
 */
export function presetOrder(somethingToFollow: boolean): LecturePreset[] {
  if (somethingToFollow) return [...LECTURE_PRESETS];
  return [...LECTURE_PRESETS.filter((p) => p !== 'next-lesson'), 'next-lesson'];
}

/** The localized title a resolved deck takes (`console.lecture.presets.*` / `learner.presenter.presets.*`). */
export type PresetTitleKey =
  /** `next.title`: "Next lesson". */
  | 'next.title'
  /** `zero.short`: "Hangul week 1". */
  | 'zero.short'
  /** `stage.chip` with `stageNumber`: "Stage {n}". */
  | 'stage.chip'
  /** `words.title`: "Word review". */
  | 'words.title'
  /** `warmup.short`: "Quick warm-up". */
  | 'warmup.short'
  /** `story.title`: "Story time" (never a story's own title: those are English only and can pass 60 characters). */
  | 'story.title'
  /** The plan's own title, `planTitle` (N1, only when `planTitleOk` accepts it). */
  | 'plan';

/** Which `fallback.*` line the preview shows under a preset that could not build what it names. */
export type PresetFallback = 'zero' | 'warm-up' | 'restart';

export interface PresetContext {
  /** `CATALOG`; both apps already import it. */
  catalog: Catalog;
  /** N1, W1 (console only): this week's plan outline (`planOutline`). */
  plan?: { title: string; blocks: readonly LectureBlock[] } | null;
  /**
   * N1 (console only): whether the plan title may be the deck title. The console
   * passes `(t) => titleProblem(t, roster) === null`, which rejects roster names
   * and banned words. Absent, the plan title is never used: the deck takes the
   * preset name, so a name in a plan title cannot reach the link (TD8).
   */
  planTitleOk?: (title: string) => boolean;
  /**
   * The quest to start at: N2 `classPosition` (console, with the class's stage S,
   * which also bounds Story time's levels), N3 `learnerPosition` (app).
   */
  position?: { questId: string; stage?: StageKey } | null;
  /** What this screen showed in the last 60 days (presenter Recent): N4, S, T. */
  shown?: { questIds: readonly string[]; storyIds: readonly string[] } | null;
  /** W1-W3: quest ids of recent lessons (newest first) and extra word ids. */
  recentWords?: { questIds: readonly string[]; vocabIds: readonly string[] } | null;
  /** U: letters to revisit (compatibility jamo). */
  revisitChars?: readonly string[] | null;
  /** S: the stage chip. */
  stage?: StageKey | null;
}

export interface ResolvedPreset {
  /** The preset that built the blocks: the asked one, or the one it fell back to. */
  preset: LecturePreset;
  /** The length the blocks were built for (the asked one when the preset offers it, else its default). */
  minutes: PresetMinutes;
  blocks: LectureBlock[];
  titleKey: PresetTitleKey;
  /** `titleKey: 'stage.chip'`. */
  stageNumber?: number;
  /** `titleKey: 'plan'`. */
  planTitle?: string;
  fallback: PresetFallback | null;
}

// ---- minutes (section 4.2 m(block), rule 12 as amended in 4.4) ---------------------------------

/** The letters U uses with nothing to revisit, and tops up from: the first six letters of Hangul week 1. */
export const WARM_UP_DEFAULT_CHARS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㅏ', 'ㅓ', 'ㅗ'] as const;

/** The sound quiz a `revisit` block ends with: `min(4, letters)` rounds (F-TCH-004 section 3.3 rule 3). */
const REVISIT_QUIZ_ROUNDS = 4;

/**
 * The most word cards a `word-review` block shows: 10 with 5 quiz rounds (10 min), 20 with
 * 10 (20 min), so under rule 12 a full word review is exactly its length (section 4.2 W).
 */
export const wordReviewCardCap = (rounds: number): number => (rounds <= 5 ? 10 : 20);

const half = (slides: number): number => Math.ceil(slides / 2);

/**
 * About-minutes of one block from the catalogue (section 4.2 m(block)): catalogue
 * minutes for a quest, episode or story, an activity's own minutes, 1 per quiz
 * round, and `ceil(slides / 2)` for the non-quiz slides of `revisit`, `jamo-set`,
 * `cards` and `word-review` (rule 12 amendment, section 4.4). A `word-review`
 * counts its card cap (only the presenter's bundle knows how many words its quests
 * teach; fewer words give a shorter deck, never a longer one). An id the catalogue
 * does not know counts 0.
 */
export function presetBlockMinutes(block: LectureBlock, catalog: Catalog): number {
  switch (block.kind) {
    case 'quest':
      return catalog.quests.find((q) => q.id === block.id)?.minutes ?? 0;
    case 'episode':
      return catalog.cells.find((c) => c.episodeId === block.id)?.minutes ?? 0;
    case 'story':
      return catalog.stories.find((s) => s.id === block.storyId)?.minutes ?? 0;
    case 'vocab':
      return catalog.topics.find((t) => `vocab-topic:${t.key}` === block.topicId)?.minutes ?? 0;
    case 'jamo-set':
      return half(block.jamoIds.length);
    case 'cards':
      return half(block.cardIds.length);
    case 'revisit':
      return half(block.chars.length) + Math.min(REVISIT_QUIZ_ROUNDS, block.chars.length);
    case 'word-review':
      return half(wordReviewCardCap(block.rounds)) + block.rounds;
    case 'quiz':
      return block.rounds;
    case 'activity':
      return block.minutes;
    case 'class-code':
      return 0;
  }
}

export const presetMinutesOf = (blocks: readonly LectureBlock[], catalog: Catalog): number =>
  blocks.reduce((sum, b) => sum + presetBlockMinutes(b, catalog), 0);

// ---- the fill rule ------------------------------------------------------------------------------

/** Rule 2's review quiz: 4 rounds over what came before it. */
const REVIEW_QUIZ: LectureBlock = { kind: 'quiz', from: 'previous', rounds: 4 };
const REVIEW_QUIZ_MIN_LEFT = 5;
const ACTIVITY_MIN_LEFT = 2;
const ACTIVITY_MAX_MINUTES = 5;

/** Whether every taken content block is a Stage 1 quest or episode (then the class writes in the air); stories are not. */
function allStage1(blocks: readonly LectureBlock[], catalog: Catalog): boolean {
  return blocks.every((b) => {
    if (b.kind === 'quest') return catalog.quests.find((q) => q.id === b.id)?.stage === 'stage1';
    if (b.kind === 'episode') return catalog.cells.find((c) => c.episodeId === b.id)?.stage === 'stage1';
    return false;
  });
}

/**
 * Fill rule (section 4.2): take the candidates in order while they fit in `minutes`
 * (the first is always taken, so a lesson is never empty); with `review` and at
 * least 5 minutes left, a 4-round quiz over them; with at least 2 minutes left, one
 * activity (`air-write` when every taken block is Stage 1, else `copy-on-paper`) of
 * `min(5, left)` minutes. At most `LECTURE_MAX_BLOCKS` blocks, never a `class-code`.
 * The quiz does not count taught items (the catalogue cannot): the presenter skips a
 * quiz whose scope is too small, so the blocks are the same on every surface.
 */
export function fillToLength(candidates: readonly LectureBlock[], minutes: number, review: boolean, catalog: Catalog): LectureBlock[] {
  const taken: LectureBlock[] = [];
  let running = 0;
  for (const block of candidates) {
    if (taken.length >= LECTURE_MAX_BLOCKS) break;
    if (block.kind === 'class-code') continue;
    const m = presetBlockMinutes(block, catalog);
    if (taken.length > 0 && running + m > minutes) break;
    taken.push(block);
    running += m;
  }
  const content = [...taken];
  if (review && minutes - running >= REVIEW_QUIZ_MIN_LEFT && taken.length < LECTURE_MAX_BLOCKS) {
    taken.push(REVIEW_QUIZ);
    running += presetBlockMinutes(REVIEW_QUIZ, catalog);
  }
  if (minutes - running >= ACTIVITY_MIN_LEFT && taken.length < LECTURE_MAX_BLOCKS) {
    const preset = content.length > 0 && allStage1(content, catalog) ? 'air-write' : 'copy-on-paper';
    taken.push({ kind: 'activity', preset, minutes: Math.min(ACTIVITY_MAX_MINUTES, minutes - running) });
  }
  return taken;
}

// ---- route helpers ------------------------------------------------------------------------------

/** Route quests (section 4.2): lesson quests only, playable only, in route order. */
function routeQuests(catalog: Catalog): RouteQuest[] {
  return routeCatalogOf(catalog).quests.filter((q) => q.grid && q.playable);
}

const stageNumberOf = (stage: StageKey): number => StageKeySchema.options.indexOf(stage) + 1;

/** `quest:story-<slug>-read`, the Stage 5 book quests that play a story at the read level. */
const READ_QUEST_RE = /^quest:story-([a-z0-9]+(?:-[a-z0-9]+)*)-read$/;

/** A route quest as a block: a quest block, or (Stage 5, `by-stage`) its story at the read level. */
function questBlock(quest: RouteQuest, catalog: Catalog, asStory: boolean): LectureBlock {
  const slug = asStory ? READ_QUEST_RE.exec(quest.id)?.[1] : undefined;
  if (slug !== undefined && catalog.stories.some((s) => s.id === `story:${slug}`)) {
    return { kind: 'story', storyId: `story:${slug}`, level: 'read', checks: true };
  }
  return { kind: 'quest', id: quest.id };
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];
const questIdsOf = (values: readonly string[] | undefined): string[] =>
  unique((values ?? []).filter((id) => typeof id === 'string' && QUEST_ID_RE.test(id) && id.length <= 64));

// ---- the presets --------------------------------------------------------------------------------

type Built = Omit<ResolvedPreset, 'minutes'>;

function hangulWeek1(minutes: PresetMinutes, ctx: PresetContext, fallback: PresetFallback | null): Built {
  const { catalog } = ctx;
  const cell = catalog.cells.find((c) => c.episodeId === 'episode:stage1-letters');
  const known = new Set(catalog.quests.map((q) => q.id));
  const candidates: LectureBlock[] = (cell?.questIds ?? []).filter((id) => known.has(id)).map((id) => ({ kind: 'quest', id }));
  // Unreachable with the shipped catalogue (the cell is ready): the warm-up, named as the warm-up.
  if (candidates.length === 0) return warmUp(ctx, fallback);
  return { preset: 'hangul-week-1', blocks: fillToLength(candidates, minutes, true, catalog), titleKey: 'zero.short', fallback };
}

/** A warm-up holds at least this many different letters, so its sound quiz always has 4 questions. */
export const WARM_UP_MIN_LETTERS = 4;

/**
 * U's letters (section 4.2): the letters to revisit (compatibility jamo, de-duplicated,
 * at most 6); none gives the six defaults; 1 to 3 are topped up to 4 with the next
 * default letters not already there, in order.
 */
export function warmUpChars(chars: readonly string[]): string[] {
  const picked = unique(chars.filter((c) => typeof c === 'string' && LECTURE_REVISIT_CHAR_RE.test(c))).slice(0, 6);
  if (picked.length === 0) return [...WARM_UP_DEFAULT_CHARS];
  for (const c of WARM_UP_DEFAULT_CHARS) {
    if (picked.length >= WARM_UP_MIN_LETTERS) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}

function warmUpBlocks(chars: readonly string[]): LectureBlock[] {
  return [
    { kind: 'revisit', chars: warmUpChars(chars) },
    { kind: 'activity', preset: 'air-write', minutes: 3 },
  ];
}

function warmUp(ctx: PresetContext, fallback: PresetFallback | null): Built {
  return { preset: 'warm-up', blocks: warmUpBlocks(ctx.revisitChars ?? []), titleKey: 'warmup.short', fallback };
}

/** N: the plan (N1), else the position (N2, N3), else after the furthest quest this screen showed (N4), else Hangul week 1. */
function nextLesson(minutes: PresetMinutes, ctx: PresetContext): Built {
  const { catalog } = ctx;
  const planBlocks = (ctx.plan?.blocks ?? []).filter((b) => b.kind !== 'class-code');
  if (ctx.plan && planBlocks.length > 0) {
    const blocks = fillToLength(planBlocks, minutes, true, catalog);
    const title = ctx.plan.title.trim();
    if (isDeckTitle(title) && ctx.planTitleOk?.(title) === true) return { preset: 'next-lesson', blocks, titleKey: 'plan', planTitle: title, fallback: null };
    return { preset: 'next-lesson', blocks, titleKey: 'next.title', fallback: null };
  }

  const route = routeQuests(catalog);
  let from = -1;
  if (ctx.position) from = route.findIndex((q) => q.id === ctx.position?.questId);
  if (from < 0) {
    const shown = new Set(questIdsOf(ctx.shown?.questIds));
    let furthest = -1;
    route.forEach((q, i) => {
      if (shown.has(q.id)) furthest = i;
    });
    if (furthest >= 0) from = furthest + 1;
  }
  const candidates = from >= 0 ? route.slice(from).map((q) => questBlock(q, catalog, false)) : [];
  if (candidates.length === 0) return hangulWeek1(minutes, ctx, 'zero');
  return { preset: 'next-lesson', blocks: fillToLength(candidates, minutes, true, catalog), titleKey: 'next.title', fallback: null };
}

/** S: the chosen stage from the first lesson this context has not had, through that stage only. */
function byStage(minutes: PresetMinutes, ctx: PresetContext): Built {
  const { catalog } = ctx;
  // Every surface draws only the chips of stages with a ready cell, so a missing or
  // unknown stage, or a stage with no route quest, is not reachable from a chip:
  // Stage 1, or Hangul week 1, keeps the lesson from being empty.
  const stage = ctx.stage ?? 'stage1';
  const ofStage = routeQuests(catalog).filter((q) => q.stage === stage);
  if (ofStage.length === 0) return hangulWeek1(minutes, ctx, 'zero');
  const shown = new Set(questIdsOf(ctx.shown?.questIds));
  let from = ctx.position ? ofStage.findIndex((q) => q.id === ctx.position?.questId) : -1;
  if (from < 0) from = ofStage.findIndex((q) => !shown.has(q.id));
  if (from < 0) from = 0;
  const candidates = ofStage.slice(from).map((q) => questBlock(q, catalog, stage === 'stage5'));
  return {
    preset: 'by-stage',
    blocks: fillToLength(candidates, minutes, true, catalog),
    titleKey: 'stage.chip',
    stageNumber: stageNumberOf(stage),
    fallback: null,
  };
}

/**
 * T: ready stories by `order`, first the ones this context has not shown, then the
 * shown ones; a story is never twice in one deck. The console (a position with the
 * class's stage S) never takes a story recommended more than one stage above S.
 * Filled to the length like every other preset; the restart line shows when every
 * candidate was shown before.
 */
function storyTime(minutes: PresetMinutes, ctx: PresetContext): Built {
  const { catalog } = ctx;
  const ready = catalog.stories.filter(storyIsReady).sort((a, b) => a.order - b.order);
  if (ready.length === 0) return hangulWeek1(minutes, ctx, 'zero');
  const classStage = ctx.position?.stage !== undefined ? StageKeySchema.safeParse(ctx.position.stage) : undefined;
  const levelOk = classStage?.success === true ? ready.filter((s) => s.recommendedStage <= stageNumberOf(classStage.data) + 1) : ready;
  // Unreachable with the shipped catalogue (Stage 1 stories are always in range): any ready story.
  const pool = levelOk.length > 0 ? levelOk : ready;
  const shown = new Set(ctx.shown?.storyIds ?? []);
  const unseen = pool.filter((s) => !shown.has(s.id));
  const ordered = [...unseen, ...pool.filter((s) => shown.has(s.id))];
  const candidates: LectureBlock[] = ordered.map((s) => ({ kind: 'story', storyId: s.id, checks: minutes >= 20 }));
  return {
    preset: 'story-time',
    blocks: fillToLength(candidates, minutes, true, catalog),
    titleKey: 'story.title',
    fallback: unseen.length === 0 ? 'restart' : null,
  };
}

/** W: one v2 `word-review` block over recent quests and words, else the warm-up. */
function wordReview(minutes: PresetMinutes, ctx: PresetContext): Built {
  const known = new Set(ctx.catalog.quests.map((q) => q.id));
  const questIds = questIdsOf(ctx.recentWords?.questIds).filter((id) => known.has(id)).slice(0, WORD_REVIEW_MAX_QUESTS);
  const vocabIds = unique((ctx.recentWords?.vocabIds ?? []).filter((id) => VocabIdSchema.max(48).safeParse(id).success)).slice(0, WORD_REVIEW_MAX_WORDS);
  if (questIds.length + vocabIds.length === 0) return warmUp(ctx, 'warm-up');
  return {
    preset: 'word-review',
    blocks: [{ kind: 'word-review', questIds, vocabIds, rounds: minutes === 10 ? 5 : 10 }],
    titleKey: 'words.title',
    fallback: null,
  };
}

/** The length the preset builds: the asked one when the preset offers it, else its default. */
export function presetLength(preset: LecturePreset, minutes: number): PresetMinutes {
  const offered = PRESET_LENGTHS[preset];
  return offered.includes(minutes as PresetMinutes) ? (minutes as PresetMinutes) : PRESET_DEFAULT_MINUTES[preset];
}

/**
 * Resolves a preset to deck blocks (section 4.2). Pure: the same preset, length and
 * context give the same result on the console, the presenter and the learner app.
 */
export function resolvePreset(preset: LecturePreset, minutes: number, ctx: PresetContext): ResolvedPreset {
  const length = presetLength(preset, minutes);
  const built = ((): Built => {
    switch (preset) {
      case 'next-lesson':
        return nextLesson(length, ctx);
      case 'hangul-week-1':
        return hangulWeek1(length, ctx, null);
      case 'by-stage':
        return byStage(length, ctx);
      case 'story-time':
        return storyTime(length, ctx);
      case 'word-review':
        return wordReview(length, ctx);
      case 'warm-up':
        return warmUp(ctx, null);
    }
  })();
  return { ...built, minutes: built.preset === 'warm-up' ? PRESET_DEFAULT_MINUTES['warm-up'] : length };
}

// ---- N2: the class position ---------------------------------------------------------------------

/**
 * N2 (section 4.2): where a class or family is on the Learning Route, from the
 * roster rows' `summary.journey`. Learners with a readable `here` stage count;
 * S = the stage most of them are in (a tie goes to the earlier stage); p = the
 * smallest `done + known` of their entries for S (a missing entry counts 0). The
 * result is the route quest at index p of stage S, or the first route quest of a
 * later stage when p is past S. `stage` is S itself (Story time's level bound),
 * even when the quest is in the next stage. Only those two numbers are read: no
 * learner is named, compared or counted. Null with no usable summary.
 */
export function classPosition(
  rows: readonly { journey?: JourneySummary | null }[],
  catalog: Catalog,
): { questId: string; stage: StageKey } | null {
  const here: { stage: StageKey; reached: number }[] = [];
  for (const row of rows) {
    const journey = row.journey;
    if (!journey || journey.v !== 1 || !Array.isArray(journey.stages)) continue;
    const stage = StageKeySchema.safeParse(journey.here);
    if (!stage.success) continue;
    const entry = journey.stages.find((s) => s.stage === stage.data);
    const count = (n: unknown): number => (typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0);
    here.push({ stage: stage.data, reached: entry ? count(entry.done) + count(entry.known) : 0 });
  }
  if (here.length === 0) return null;

  const tally = new Map<StageKey, number>();
  for (const h of here) tally.set(h.stage, (tally.get(h.stage) ?? 0) + 1);
  // Stage order, so a tie keeps the earlier stage.
  let S = here[0]?.stage as StageKey;
  let most = 0;
  for (const stage of StageKeySchema.options) {
    const n = tally.get(stage) ?? 0;
    if (n > most) [S, most] = [stage, n];
  }
  const p = Math.min(...here.filter((h) => h.stage === S).map((h) => h.reached));

  const route = routeQuests(catalog);
  const first = route.findIndex((q) => q.stage === S);
  if (first < 0) return null;
  const ofStage = route.filter((q) => q.stage === S).length;
  const quest = p < ofStage ? route[first + p] : route.slice(first + ofStage)[0];
  return quest ? { questId: quest.id, stage: S } : null;
}

// ---- N3: the learner's place (the learner app) ------------------------------------------------

/**
 * N3 (section 4.2): the learner's `routeNext` quest when it is a route quest.
 * `routeNext` can return a homework or plan quest off the route; then the route
 * quest after the learner's furthest done route quest (by route order), or the
 * first route quest when none is done. Null past the end of the route.
 */
export function learnerPosition(nextQuestId: string | null, doneQuestIds: readonly string[], catalog: Catalog): { questId: string } | null {
  const route = routeQuests(catalog);
  if (nextQuestId !== null && route.some((q) => q.id === nextQuestId)) return { questId: nextQuestId };
  const done = new Set(doneQuestIds);
  let furthest = -1;
  route.forEach((q, i) => {
    if (done.has(q.id)) furthest = i;
  });
  const quest = route[furthest + 1];
  return quest ? { questId: quest.id } : null;
}

// ---- reading a stored deck (N4, S, W2, T) --------------------------------------------------------

/**
 * The one reading of a stored deck's quests (section 4.3): a `quest` block gives
 * its id, an `episode` block its cell's quests in cell order, every other kind
 * none; de-duplicated, first occurrence kept.
 */
export function questIdsOfBlocks(blocks: readonly LectureBlock[], catalog: Catalog): string[] {
  const ids: string[] = [];
  for (const block of blocks) {
    if (block.kind === 'quest') ids.push(block.id);
    else if (block.kind === 'episode') ids.push(...(catalog.cells.find((c) => c.episodeId === block.id)?.questIds ?? []));
  }
  return unique(ids);
}

/** A stored deck's shown stories (section 4.3): its `story` blocks' ids, de-duplicated. */
export const storyIdsOfBlocks = (blocks: readonly LectureBlock[]): string[] =>
  unique(blocks.flatMap((b) => (b.kind === 'story' ? [b.storyId] : [])));

// ---- W1: the console's recent words --------------------------------------------------------------

/** W1: the most `rollup.vocabRevisit` words a console word review adds. */
export const WORD_REVIEW_ROLLUP_MAX = 3;

/**
 * W1 (section 4.2): the quest ids of this week's then last week's plan items (at
 * most 12), plus up to 3 `rollup.vocabRevisit` words only when at least 2 learners
 * in the space carry `summary.vocab`, so a family or class of one never projects one
 * person's needs-practice list.
 */
export function consoleRecentWords(input: {
  thisWeek: readonly string[];
  lastWeek: readonly string[];
  vocabRevisit: readonly string[];
  vocabSummaries: number;
}): { questIds: string[]; vocabIds: string[] } {
  const questIds = questIdsOf([...input.thisWeek, ...input.lastWeek]).slice(0, WORD_REVIEW_MAX_QUESTS);
  const vocabIds =
    input.vocabSummaries >= 2
      ? unique(input.vocabRevisit.filter((id) => VocabIdSchema.max(48).safeParse(id).success)).slice(0, WORD_REVIEW_ROLLUP_MAX)
      : [];
  return { questIds, vocabIds };
}

// ---- the deck -----------------------------------------------------------------------------------

/** The deck schema's title rule (TD8): a plan title that fails it gives the preset name instead. */
const isDeckTitle = (title: string): boolean => title.length >= 1 && title.length <= 60 && LECTURE_TITLE_RE.test(title);

/**
 * A resolved preset as a deck the caller encodes. `title` is the caller's
 * localized title for `titleKey`. Only a deck holding a `word-review` block is v2,
 * and only it carries `preset` (LV-D6); every other preset gives an ordinary v1
 * deck that a presenter cached before v2 still opens.
 */
export function presetDeck(
  resolved: Pick<ResolvedPreset, 'blocks' | 'preset'>,
  meta: {
    id: string;
    title: string;
    createdAt: string;
    seed: number;
    options?: Partial<LectureOptions>;
    source: NonNullable<LectureDeckInput['source']>;
  },
): LectureDeckInput {
  const v = deckVersion(resolved);
  return {
    v,
    id: meta.id,
    title: meta.title,
    createdAt: meta.createdAt,
    seed: meta.seed,
    blocks: [...resolved.blocks],
    options: { ...meta.options },
    // The helper picker is gone (LV-H): a preset deck never names one.
    picker: null,
    source: meta.source,
    ...(v === 2 ? { preset: resolved.preset } : {}),
  };
}
