import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { nextQuestAfter } from '../next-quest';
import { gridEpisodesOf } from './order';

/**
 * The My route cursor (F-ROUTE-001 section 3.5): a thin wrapper over the one
 * cursor, `nextQuestAfter`, over the grid episodes only (shelf stories are
 * never on the route). `isEntitled` and `skipQuestIds` (placed-out quests)
 * go straight into `NextQuestInput`, and the screen takes both from
 * `cursorContext`, as Home and Results do (R-4a). Returns `undefined` at rest.
 */
export interface CursorInput {
  snapshot: ProgressSnapshot;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  isEntitled?: (stageKey: string) => boolean;
  skipQuestIds?: ReadonlySet<string>;
}

export function routeCursor(input: CursorInput): Quest | undefined {
  return nextQuestAfter({
    snapshot: input.snapshot,
    quests: input.quests,
    episodes: gridEpisodesOf(input.episodes),
    isEntitled: input.isEntitled,
    skipQuestIds: input.skipQuestIds,
  });
}
