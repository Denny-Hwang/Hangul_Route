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
 * The learner has done `stage`: the route latched it complete (`stageDoneAt`, F-ROUTE-001 section 3.3, which stays
 * whatever content ships later), every quest of its playable grid episodes is complete, or the level check placed them
 * past it. One finished lesson of the stage is not the stage ("You know 30 letters." after the first Stage 1 lesson
 * would be untrue), and a lesson of a later stage does not stand in for it either: every cell is open, so a learner
 * can start there first.
 */
export function stageDone(input: {
  stage: StageKey;
  snapshot: Pick<ProgressSnapshot, 'quests' | 'stageDoneAt'> | undefined;
  episodes: readonly Pick<Episode, 'stage' | 'questIds' | 'placement' | 'status'>[];
  placements?: readonly Pick<PlacementResult, 'level'>[];
}): boolean {
  const n = stageNumber(input.stage);
  const placed = placementStageOf(input.placements);
  if (placed !== undefined && placed > n) return true;
  if (input.snapshot?.stageDoneAt?.[input.stage] !== undefined) return true;
  const playable = (e: Pick<Episode, 'placement' | 'status'>): boolean => (e.placement ?? 'grid') === 'grid' && (e.status === 'shipped' || e.status === 'ready');
  const ofStage = new Set(input.episodes.filter((e) => playable(e) && stageNumber(e.stage) === n).flatMap((e) => e.questIds));
  if (ofStage.size === 0) return false;
  const done = new Set((input.snapshot?.quests ?? []).filter((q) => q.completedAt !== undefined).map((q) => q.questId));
  return [...ofStage].every((questId) => done.has(questId));
}

/** The intro to show: the cell's own, or `fresh` while what it assumes is not done. */
export function episodeIntro(input: {
  episode: Pick<Episode, 'id' | 'hoyaIntroEn'>;
  snapshot: Pick<ProgressSnapshot, 'quests' | 'placements' | 'stageDoneAt'> | undefined;
  episodes: readonly Pick<Episode, 'stage' | 'questIds' | 'placement' | 'status'>[];
  fresh: string;
}): string {
  const assumes = INTRO_ASSUMES[input.episode.id];
  if (assumes === undefined) return input.episode.hoyaIntroEn;
  const done = stageDone({ stage: assumes, snapshot: input.snapshot, episodes: input.episodes, placements: input.snapshot?.placements });
  return done ? input.episode.hoyaIntroEn : input.fresh;
}
