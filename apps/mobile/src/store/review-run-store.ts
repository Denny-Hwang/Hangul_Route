import { create } from 'zustand';
import type { ReviewAnswer } from '../logic/stage1/review-flow';
import type { MinigameHost } from '../screens/minigames/host';

/**
 * The Hangul Check run in progress (F-QUEST-002 §3.9). Ephemeral: it persists nothing and never
 * touches `quest-run-store`, a quest or a quest's stars. The first answer per item scores; later
 * answers are retries (F-001 §3.2). The result is written once, through
 * `progress-store.recordReview`, by the screen that finished the run; leaving resets it.
 */

interface State {
  itemIds: readonly string[];
  answers: Readonly<Record<string, ReviewAnswer>>;
}

interface Actions {
  begin: (itemIds: readonly string[]) => void;
  /** First answer per item scores; an id that is not in the run is ignored. */
  answer: (itemId: string, correct: boolean) => void;
  reset: () => void;
}

export const useReviewRunStore = create<State & Actions>((set, get) => ({
  itemIds: [],
  answers: {},
  begin: (itemIds) => set({ itemIds: [...itemIds], answers: {} }),
  answer: (itemId, correct) => {
    const { itemIds, answers } = get();
    if (!itemIds.includes(itemId)) return;
    const seen = answers[itemId];
    set({ answers: { ...answers, [itemId]: seen ? { ...seen, retries: seen.retries + 1 } : { first: correct, retries: 0 } } });
  },
  reset: () => set({ itemIds: [], answers: {} }),
}));

/**
 * The review `MinigameHost` (F-QUEST-002 §3.12) for Listen & Pick: an answer is credited to the
 * item named by `meta.itemId` (the round id is the item id), never to a round index; `complete`
 * hands the chunk back to the screen.
 */
export function reviewHost(onComplete: () => void): MinigameHost {
  return {
    mode: 'review',
    answer: (_roundKey, correct, meta) => {
      if (meta?.itemId) useReviewRunStore.getState().answer(meta.itemId, correct);
    },
    complete: onComplete,
  };
}
