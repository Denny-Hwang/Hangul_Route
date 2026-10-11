import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';

/**
 * The Journey cursor (F-QUEST-002 §3.5): the first quest, in content order of
 * the playable grid episodes, that the learner has not completed. Home's "New"
 * card and the Results "Next up" teaser both read it, so they cannot disagree.
 *
 * F-STORY-004 PR 4.1's `gridEpisodes` becomes the single owner of the
 * grid/shelf split; until a shelf episode exists the two lists are identical.
 */

/** Episodes a learner can actually open, in content order. */
export function playableEpisodes(episodes: readonly Episode[]): Episode[] {
  return episodes.filter((e) => e.status === 'shipped' || e.status === 'ready');
}

/**
 * Quests inside a playable episode, in quest order. A quest whose episode is
 * still a preview placeholder would route the learner into an unshipped
 * screen. `isEntitled(stageKey)` leaves out stages the learner cannot open;
 * omitted means every stage is open.
 */
export function offerableQuests(
  quests: readonly Quest[],
  episodes: readonly Episode[],
  isEntitled?: (stageKey: string) => boolean,
): Quest[] {
  const open = playableEpisodes(episodes).filter((e) => !isEntitled || isEntitled(e.stage));
  const openIds = new Set(open.flatMap((e) => e.questIds));
  return quests.filter((q) => openIds.has(q.id));
}

export interface NextQuestInput {
  snapshot: ProgressSnapshot;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  /** A quest completed by the write being shown; counted as done before the snapshot has it. */
  justCompleted?: string;
  /** `isStageEntitled(stageKey, tier)` for the current learner. */
  isEntitled?: (stageKey: string) => boolean;
}

/** The next incomplete offerable quest, or `undefined` when none is left. */
export function nextQuestAfter(input: NextQuestInput): Quest | undefined {
  const done = new Set(input.snapshot.quests.filter((q) => q.completedAt).map((q) => q.questId));
  if (input.justCompleted) done.add(input.justCompleted);
  return offerableQuests(input.quests, input.episodes, input.isEntitled).find((q) => !done.has(q.id));
}
