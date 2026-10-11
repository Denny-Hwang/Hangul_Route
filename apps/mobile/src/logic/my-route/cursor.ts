import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { nextQuestAfter } from '../next-quest';
import { gridEpisodesOf } from './order';

/**
 * The My route cursor (F-ROUTE-001 section 3.5): a thin wrapper over the one
 * cursor, `nextQuestAfter`, over the grid episodes only (shelf stories are
 * never on the route). `skipQuestIds` (placed-out quests) is applied here by
 * leaving those quests out of the list until R-4a moves it into
 * `NextQuestInput`; Home and Results then pass the same set. Returns
 * `undefined` at rest.
 */
export interface CursorInput {
  snapshot: ProgressSnapshot;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  isEntitled?: (stageKey: string) => boolean;
  skipQuestIds?: ReadonlySet<string>;
}

export function routeCursor(input: CursorInput): Quest | undefined {
  const skip = input.skipQuestIds;
  return nextQuestAfter({
    snapshot: input.snapshot,
    quests: skip && skip.size > 0 ? input.quests.filter((q) => !skip.has(q.id)) : input.quests,
    episodes: gridEpisodesOf(input.episodes),
    isEntitled: input.isEntitled,
  });
}
