import type { UiLocale } from '@hangul-route/content-schema';
import type { ReviewItem } from '@hangul-route/content-schema/review-items';
import { episodeById, episodesAll, questsAll } from '../../content';
import { lessonContent } from '../../content/lessons';
import { journeyContent } from '../../content/sync-context';
import { useAudioStore } from '../../store/audio-store';
import { useProgressStore } from '../../store/progress-store';
import { currFlagOn } from '../../store/remote-config-store';
import { canPlayKorean } from '../audio/capability';
import { CONTENT_OVERLAYS } from '../content-locale';
import type { RoundAsked } from '../memory/asked';
import type { MemoryRow } from '../memory/memory-file';
import { buildLookup, cellOfEpisode } from '../memory/resolve';
import { routeOrder } from '../my-route/order';
import { localDay, vocabOf } from '../vocab/progress';
import { buildTryAgain, buildWarmup, engineStates, type EngineContext, type WarmupQuest } from './engine';
import { stageNumber } from './quest-review-gate';
import type { QuestReviewPlan } from './quest-review-session';
import { QUICK_MAX_RUNG, missedItemIds, planTryAgain, planWarmup, type GlossOf } from './quest-reviews';
import type { ReviewItemIndex } from './review-items-store';

/**
 * The quest warm-up and Try these again, planned for a learner (F-CURR-002 section 4.5, row CM-15). Part of the
 * memory store's chunk (`../memory/memory-chunk.ts`), with the review engine, and reached through the boot module
 * (`questReviewPlanner`), so the sessions' own chunk shares no module with it and the start bundle carries neither.
 */

/** The memory store's stored rows of a learner, and this build's review items; null when the store cannot be read. */
export type ReviewInputs = (profileId: string) => Promise<{ index: ReviewItemIndex; rows: Readonly<Record<string, MemoryRow>> } | null>;

/** An item's meaning in the UI language: the overlay its gloss key names (lesson glosses join as their cell loads). */
export function glossFor(locale: UiLocale, overlays = CONTENT_OVERLAYS): GlossOf {
  return (item: ReviewItem) => {
    if (locale === 'en') return item.en;
    const key = item.glossKey;
    if (key === undefined) return undefined;
    const at = key.indexOf('#');
    return overlays[locale]?.[key.slice(0, at)]?.[key.slice(at + 1)];
  };
}

/** The engine's view of this learner now: the stored rows with the topic words, the voice, what is visible (section 12.2). */
async function contextFor(read: ReviewInputs, profileId: string): Promise<EngineContext | null> {
  const inputs = await read(profileId);
  if (!inputs) return null;
  const snap = useProgressStore.getState().byProfile[profileId];
  const audio = useAudioStore.getState();
  return {
    index: inputs.index,
    states: engineStates(inputs.rows, snap ? vocabOf(snap) : undefined),
    today: localDay(new Date()),
    voice: canPlayKorean({ tts: audio.tts, clips: audio.clips, unlocked: audio.unlocked }) && !audio.muted,
    seed: String(Math.floor(Math.random() * 0x7fffffff)),
    visibility: {
      volumes: currFlagOn('volumes', profileId),
      topicPacks: currFlagOn('topicPacks', profileId),
      pack: (key) => currFlagOn(`pack.${key}`, profileId),
    },
  };
}

/** The lesson cells of these items, loaded so their glosses are in for the UI language; a failed load keeps the English. */
async function glossesIn(ctx: EngineContext, itemIds: readonly string[], locale: UiLocale): Promise<void> {
  // The English gloss is the item's own, so an English learner waits for no lesson cell.
  if (locale === 'en') return;
  const cells = new Set<string>();
  for (const id of itemIds) for (const cell of ctx.index.byId.get(id)?.cells ?? []) cells.add(cell);
  await lessonContent.ensureCells([...cells]).catch(() => undefined);
}

/** The grid cells in route order (F-ROUTE-001 section 3.2): each at the place of its first quest. */
export function routeCellRanks(): ReadonlyMap<string, number> {
  const rank = new Map<string, number>();
  for (const entry of routeOrder({ catalog: journeyContent.catalog, episodes: episodesAll, quests: questsAll })) {
    if (!rank.has(entry.episodeId)) rank.set(entry.episodeId, rank.size);
  }
  return rank;
}

/**
 * The warm-up's "earlier cells" (section 4.3, the CM-13 decision record): a cell before the quest's in route order,
 * so a replay of an early quest never warms up with what a later cell of its stage taught. A cell off the route (a
 * shelf story) counts as earlier when its stage is at most the quest's. A quest off the route keeps the engine's
 * stage rule (no predicate).
 */
export function earlierInRoute(
  questCell: string,
  stage: number,
  ranks: ReadonlyMap<string, number> = routeCellRanks(),
  stageOfCell: (cell: string) => number = (cell) => stageNumber(episodeById(cell.startsWith('story:') ? `episode:shelf-${cell.slice('story:'.length)}` : cell)?.stage),
): WarmupQuest['earlier'] {
  const at = ranks.get(questCell);
  if (at === undefined) return undefined;
  return (cell) => {
    const rank = ranks.get(cell);
    if (rank !== undefined) return rank < at;
    const cellStage = stageOfCell(cell);
    return cellStage > 0 && cellStage <= stage;
  };
}

export interface WarmupRequest {
  profileId: string;
  episodeId: string;
  locale: UiLocale;
}

/** The warm-up of a quest, or null when there is nothing to warm up with (the quest then starts as always). */
export async function planQuestWarmup(read: ReviewInputs, input: WarmupRequest): Promise<QuestReviewPlan | null> {
  const ctx = await contextFor(read, input.profileId);
  if (!ctx) return null;
  const cell = cellOfEpisode(input.episodeId);
  const stage = stageNumber(episodeById(input.episodeId)?.stage);
  const earlier = earlierInRoute(cell, stage);
  const quest: WarmupQuest = earlier ? { cell, stage, earlier } : { cell, stage };
  await glossesIn(ctx, buildWarmup({ ...ctx, maxRung: QUICK_MAX_RUNG }, quest).questions.map((q) => q.itemId), input.locale);
  const plan = planWarmup(ctx, quest, glossFor(input.locale));
  return plan.rounds.length > 0 ? plan : null;
}

export interface TryAgainRequest extends WarmupRequest {
  /** What each round of the play missed on the first try asked (`quest-run-store`), in order. */
  missed: readonly RoundAsked[];
}

/** Try these again for the play just finished, or null when none of its misses can be asked. */
export async function planQuestTryAgain(read: ReviewInputs, input: TryAgainRequest): Promise<QuestReviewPlan | null> {
  const ctx = await contextFor(read, input.profileId);
  if (!ctx) return null;
  const missed = missedItemIds(buildLookup(ctx.index.items, ctx.index.retired), cellOfEpisode(input.episodeId), input.missed);
  await glossesIn(ctx, buildTryAgain({ ...ctx, maxRung: QUICK_MAX_RUNG }, missed).questions.map((q) => q.itemId), input.locale);
  const plan = planTryAgain(ctx, missed, glossFor(input.locale));
  return plan.rounds.length > 0 ? plan : null;
}
