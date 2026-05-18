import { create } from 'zustand';
import { starsForAccuracy } from '../logic/score';

/**
 * Ephemeral state for a single quest run.
 * Reset when a quest starts; consumed when results screen mounts.
 */

interface State {
  questId: string | null;
  episodeId: string | null;
  stepIndex: number;
  correctCount: number;
  totalCount: number;
  attempts: number;
  pendingAdvance: boolean;
}

interface Actions {
  beginQuest: (questId: string, episodeId: string) => void;
  recordRound: (correct: boolean) => void;
  markStepComplete: () => void;
  goNextStep: () => void;
  consumePendingAdvance: () => void;
  reset: () => void;
  stars: () => 0 | 1 | 2 | 3;
}

export const useQuestRunStore = create<State & Actions>((set, get) => ({
  questId: null,
  episodeId: null,
  stepIndex: 0,
  correctCount: 0,
  totalCount: 0,
  attempts: 0,
  pendingAdvance: false,

  beginQuest: (questId, episodeId) =>
    set({ questId, episodeId, stepIndex: 0, correctCount: 0, totalCount: 0, attempts: 0, pendingAdvance: false }),

  recordRound: (correct) =>
    set((s) => ({
      correctCount: s.correctCount + (correct ? 1 : 0),
      totalCount: s.totalCount + 1,
      attempts: s.attempts + (correct ? 0 : 1),
    })),

  markStepComplete: () => set({ pendingAdvance: true }),

  goNextStep: () => set((s) => ({ stepIndex: s.stepIndex + 1, pendingAdvance: false })),

  consumePendingAdvance: () => {
    const { pendingAdvance } = get();
    if (pendingAdvance) {
      set((s) => ({ stepIndex: s.stepIndex + 1, pendingAdvance: false }));
    }
  },

  reset: () =>
    set({
      questId: null,
      episodeId: null,
      stepIndex: 0,
      correctCount: 0,
      totalCount: 0,
      attempts: 0,
      pendingAdvance: false,
    }),

  stars: () => starsForAccuracy(get().correctCount, Math.max(1, get().totalCount)),
}));
