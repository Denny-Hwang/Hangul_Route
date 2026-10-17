import type { Episode, PlacementResult, ProgressSnapshot, StageKey } from '@hangul-route/content-schema';
import { placementStageOf, stageNumber } from '../story/story-fit';

/**
 * Hoya's intro on an episode (cell) page when the learner has not done what it assumes (owner request
 * 2026-10-16, item 8). A few cell intros speak to a learner who came up the route ("You know 30 letters.",
 * "You can read words."); every cell is open, so a learner can start there first, and then Hoya would say
 * something untrue. Those cells name the stage their intro assumes; until the learner has done it, the page
 * shows the neutral line (`learner.episode.introFresh`) instead. Pure.
 */

/** The cells whose `hoyaIntroEn` assumes an earlier stage is done, and that stage. A content test keeps it whole. */
export const INTRO_ASSUMES: Readonly<Record<string, StageKey>> = {
  'episode:stage2-letters': 'stage1',
  'episode:stage2-life': 'stage1',
  'episode:stage3-letters': 'stage2',
};

/**
 * The learner has done `stage`: a quest of one of its grid episodes is complete, or a later stage's is, or the
 * level check placed them past it.
 */
export function stageDone(input: {
  stage: StageKey;
  snapshot: Pick<ProgressSnapshot, 'quests'> | undefined;
  episodes: readonly Pick<Episode, 'stage' | 'questIds' | 'placement'>[];
  placements?: readonly Pick<PlacementResult, 'level'>[];
}): boolean {
  const n = stageNumber(input.stage);
  const placed = placementStageOf(input.placements);
  if (placed !== undefined && placed > n) return true;
  const atOrAfter = new Set(
    input.episodes.filter((e) => (e.placement ?? 'grid') === 'grid' && stageNumber(e.stage) >= n).flatMap((e) => e.questIds),
  );
  return (input.snapshot?.quests ?? []).some((q) => q.completedAt !== undefined && atOrAfter.has(q.questId));
}

/** The intro to show: the cell's own, or `fresh` while what it assumes is not done. */
export function episodeIntro(input: {
  episode: Pick<Episode, 'id' | 'hoyaIntroEn'>;
  snapshot: Pick<ProgressSnapshot, 'quests' | 'placements'> | undefined;
  episodes: readonly Pick<Episode, 'stage' | 'questIds' | 'placement'>[];
  fresh: string;
}): string {
  const assumes = INTRO_ASSUMES[input.episode.id];
  if (assumes === undefined) return input.episode.hoyaIntroEn;
  const done = stageDone({ stage: assumes, snapshot: input.snapshot, episodes: input.episodes, placements: input.snapshot?.placements });
  return done ? input.episode.hoyaIntroEn : input.fresh;
}
