import { StageKeySchema, type Episode, type PlacementResult, type ProgressSnapshot, type StageKey, type Story } from '@hangul-route/content-schema';
import { gridEpisodes } from '../../content/episodes';

/**
 * When a story is offered (F-STORY-005 §3.4). Pure; nothing is stored.
 *
 * A story's `recommendedStage` is a hint, never a prerequisite: `StoryFit`
 * never hides or locks a story and is never shown to a learner as a label. It
 * only orders the story pick (`pickedForYou` / `next`, `story-pick.ts`):
 * stories that fit come first in shelf order, then the rest in shelf order.
 */

const FIRST_STAGE = 1;
const LAST_STAGE = StageKeySchema.options.length;

/** `'stage3'` -> 3. */
export function stageNumber(stage: StageKey): number {
  return StageKeySchema.options.indexOf(stage) + 1;
}

/**
 * 1..7: the highest stage with at least one completed quest in a grid
 * episode; at least 1. Shelf episodes are left out (a finished shelf story
 * never raises it), so callers may pass every episode. `placement`, the stage
 * number of the learner's level-check result (F-PLC-001 §3.7 consumer 8),
 * raises it and never lowers it.
 */
export function reachedStage(
  snapshot: Pick<ProgressSnapshot, 'quests'> | undefined,
  grid: readonly Episode[],
  placement?: number,
): number {
  const stageOfQuest = new Map<string, number>();
  for (const episode of gridEpisodes(grid)) {
    for (const questId of episode.questIds) stageOfQuest.set(questId, stageNumber(episode.stage));
  }
  let reached = FIRST_STAGE;
  for (const q of snapshot?.quests ?? []) {
    if (q.completedAt) reached = Math.max(reached, stageOfQuest.get(q.questId) ?? FIRST_STAGE);
  }
  if (placement !== undefined) reached = Math.max(reached, placement);
  return Math.min(Math.max(reached, FIRST_STAGE), LAST_STAGE);
}

export type StoryFit = 'ready' | 'stretch';

/** `'ready'` iff the story recommends at most one stage above the reached one. */
export function storyFit(recommendedStage: number, reached: number): StoryFit {
  return recommendedStage <= reached + 1 ? 'ready' : 'stretch';
}

/**
 * The `placement` floor of `reachedStage`: the stage of the learner's
 * effective level, the highest level any stored level-check result reached
 * (`effectiveRoute`, F-PLC-001). Undefined without a stored result.
 */
export function placementStageOf(placements: readonly Pick<PlacementResult, 'level'>[] | undefined): number | undefined {
  if (placements === undefined || placements.length === 0) return undefined;
  return Math.max(...placements.map((p) => stageNumber(p.level.stage)));
}

export interface StoryFitsInput {
  snapshot: Pick<ProgressSnapshot, 'quests'> | undefined;
  /** Every bundled episode; only grid episodes count. */
  episodes: readonly Episode[];
  /** The learner's stored level-check results (`ProgressSnapshot.placements`). */
  placements?: readonly Pick<PlacementResult, 'level'>[];
}

/** The `fits` the story pick is given (`StoryPickInput.fits`): true when the entry's story is `'ready'` for the learner. */
export function storyFitsFor(input: StoryFitsInput): (entry: { story: Pick<Story, 'recommendedStage'> }) => boolean {
  const reached = reachedStage(input.snapshot, input.episodes, placementStageOf(input.placements));
  return (entry) => storyFit(entry.story.recommendedStage, reached) === 'ready';
}
