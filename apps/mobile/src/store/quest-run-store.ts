import { create } from 'zustand';
import { tallyAnswer } from '../logic/first-try';
import { starsForAccuracy } from '../logic/score';

/**
 * Ephemeral state for a single quest run.
 * Reset when a quest starts; consumed when results screen mounts.
 */

interface State {
  questId: string | null;
  episodeId: string | null;
  stepIndex: number;
  /** Rounds answered right on the first try (logic/first-try). */
  correctCount: number;
  /** Rounds scored — one per round, whatever the number of taps. */
  totalCount: number;
  /** Answers after a round's first one — analytics only, never scored. */
  retryCount: number;
  /** `${stepIndex}:${roundKey}` of every round already scored this run. */
  scoredRounds: readonly string[];
  pendingAdvance: boolean;
}

interface Actions {
  beginQuest: (questId: string, episodeId: string) => void;
  /**
   * Report one answer in a minigame round. Games call this on every answer;
   * only the first answer for a round key (within the current step) scores.
   */
  answerRound: (roundKey: string | number, correct: boolean) => void;
  markStepComplete: () => void;
  goNextStep: () => void;
  consumePendingAdvance: () => void;
  reset: () => void;
  stars: () => 0 | 1 | 2 | 3;
}

const blankRun = {
  questId: null,
  episodeId: null,
  stepIndex: 0,
  correctCount: 0,
  totalCount: 0,
  retryCount: 0,
  scoredRounds: [],
  pendingAdvance: false,
} satisfies State;

export const useQuestRunStore = create<State & Actions>((set, get) => ({
  ...blankRun,

  beginQuest: (questId, episodeId) => set({ ...blankRun, questId, episodeId }),

  answerRound: (roundKey, correct) =>
    set((s) => {
      const next = tallyAnswer(
        { correct: s.correctCount, total: s.totalCount, retries: s.retryCount, scored: s.scoredRounds },
        `${s.stepIndex}:${roundKey}`,
        correct,
      );
      return {
        correctCount: next.correct,
        totalCount: next.total,
        retryCount: next.retries,
        scoredRounds: next.scored,
      };
    }),

  markStepComplete: () => set({ pendingAdvance: true }),

  goNextStep: () => set((s) => ({ stepIndex: s.stepIndex + 1, pendingAdvance: false })),

  consumePendingAdvance: () => {
    const { pendingAdvance } = get();
    if (pendingAdvance) {
      set((s) => ({ stepIndex: s.stepIndex + 1, pendingAdvance: false }));
    }
  },

  reset: () => set({ ...blankRun }),

  stars: () => starsForAccuracy(get().correctCount, Math.max(1, get().totalCount)),
}));
