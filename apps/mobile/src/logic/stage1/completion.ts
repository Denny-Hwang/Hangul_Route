import type { Episode, ProgressSnapshot, StageKey } from '@hangul-route/content-schema';
import { isEpisodeComplete } from '../journey';
import { playableEpisodes } from '../next-quest';

/**
 * Stage completion (F-QUEST-002 §3.8). A stage is complete when every grid
 * episode of it is complete, i.e. every quest has a `completedAt`, at any star
 * count. Pure; the award engine (F-STORY-006) consumes the transition.
 */

export interface CompletionState {
  /** Completed grid episodes of the stage, in content order. */
  completedEpisodeIds: string[];
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
  const grid = playableEpisodes(episodes).filter((e) => e.stage === stage);
  const completed = grid.filter((e) => isEpisodeComplete(e, snapshot.quests));
  return {
    completedEpisodeIds: completed.map((e) => e.id),
    stageComplete: grid.length > 0 && completed.length === grid.length,
  };
}

export function isStageComplete(
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
