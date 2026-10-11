import type { Episode, ProgressSnapshot, StageKey } from '@hangul-route/content-schema';
import { completedEpisodes, gridEpisodes, isStageComplete } from './derive';

/**
 * Stage and episode completion transitions (F-STORY-006 §3.4, F-QUEST-002
 * §3.8). One stage rule: the award engine's. `logic/stage1/completion.ts`
 * re-exports these, so the Stage 1 ceremony and the stage cards can never
 * disagree. Pure.
 */

export interface CompletionState {
  /** Completed grid episodes of the stage, in content order (never a story shelf episode). */
  completedEpisodeIds: string[];
  /** Every grid episode of a fully shipped stage is complete (a stage with a placeholder never completes). */
  stageComplete: boolean;
}

export interface CompletionTransition {
  episodesJustCompleted: string[];
  stageJustCompleted: boolean;
}

export function completionState(
  stage: StageKey,
  episodes: readonly Episode[],
  snapshot: Pick<ProgressSnapshot, 'quests'>,
): CompletionState {
  const world = { episodes };
  const completed = completedEpisodes(world, snapshot);
  return {
    completedEpisodeIds: gridEpisodes(stage, world)
      .filter((e) => completed.has(e.id))
      .map((e) => e.id),
    stageComplete: isStageComplete(stage, world, completed).complete,
  };
}

/** F-QUEST-002's `isStageComplete(stage, episodes, snapshot)`, answered by the award engine. */
export function stageCompleteFor(
  stage: StageKey,
  episodes: readonly Episode[],
  snapshot: Pick<ProgressSnapshot, 'quests'>,
): boolean {
  return completionState(stage, episodes, snapshot).stageComplete;
}

/** What one write completed: compare the state before it with the state after. */
export function completionTransition(before: CompletionState, after: CompletionState): CompletionTransition {
  const had = new Set(before.completedEpisodeIds);
  return {
    episodesJustCompleted: after.completedEpisodeIds.filter((id) => !had.has(id)),
    stageJustCompleted: !before.stageComplete && after.stageComplete,
  };
}
