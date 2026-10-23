import { create } from 'zustand';
import { tallyAnswer } from '../logic/first-try';
import type { RoundAsked } from '../logic/memory/asked';
import type { MinigameScope } from '../logic/minigame-config';
import type { StepTry } from '../logic/quest-flow/quest-adapt';
import { starsForAccuracy } from '../logic/score';

/** The first (scored) answer of a round, with what it asked (F-CURR-002 row CM-12). */
export interface FirstRoundAnswer {
  questId: string;
  episodeId: string;
  correct: boolean;
  asked: RoundAsked;
  at: Date;
  /** Answered with the hint showing (the scaffold round of F-CURR-002 section 4.6, row CM-24; Story Order's Show meanings, CM-34). */
  hinted?: boolean;
}

let firstAnswerListener: ((answer: FirstRoundAnswer) => void) | null = null;
/** The memory store listens here (`logic/memory/boot.ts`); null removes it. */
export function setFirstRoundAnswerListener(listener: ((answer: FirstRoundAnswer) => void) | null): void {
  firstAnswerListener = listener;
}

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
  /** What each round missed on the first try asked, in order: Try these again on the reward step (F-CURR-002 row CM-15). */
  missed: readonly RoundAsked[];
  /** Every first answer with its step, and what a miss asked: the adaptive pacing rules (F-CURR-002 section 4.6, row CM-24). */
  tries: readonly (StepTry & { asked?: RoundAsked })[];
  /** The Apply step that plays one round shorter in this run (a strong round earlier in the cell) and its scope, or null. */
  short: { step: number; scope: MinigameScope } | null;
}

interface Actions {
  /**
   * Start a run. `startStepIndex` (default 0) lets a resumed story quest open
   * on its `story-read` step (F-STORY-004 §3.8); anything that is not a whole
   * number of 0 or more starts at 0.
   */
  beginQuest: (questId: string, episodeId: string, startStepIndex?: number) => void;
  /**
   * Report one answer in a minigame round. Games call this on every answer;
   * only the first answer for a round key (within the current step) scores.
   */
  answerRound: (roundKey: string | number, correct: boolean, asked?: RoundAsked, hinted?: boolean) => void;
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
  missed: [],
  tries: [],
  short: null,
} satisfies State;

export const useQuestRunStore = create<State & Actions>((set, get) => ({
  ...blankRun,

  beginQuest: (questId, episodeId, startStepIndex = 0) =>
    set({
      ...blankRun,
      questId,
      episodeId,
      stepIndex: Number.isInteger(startStepIndex) && startStepIndex > 0 ? startStepIndex : 0,
    }),

  answerRound: (roundKey, correct, asked, hinted = false) => {
    const before = get();
    const first = !before.scoredRounds.includes(`${before.stepIndex}:${roundKey}`);
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
        ...(first && !correct && asked ? { missed: [...s.missed, asked] } : {}),
        ...(first ? { tries: [...s.tries, { step: s.stepIndex, correct, ...(correct || !asked ? {} : { asked }) }] } : {}),
      };
    });
    // The first answer of a round is its first try (F-001 section 3.2): only it reaches the memory store.
    if (first && asked && firstAnswerListener && before.questId && before.episodeId) {
      try {
        // A hinted answer (help shown, or a typed slip of one letter) is never wrong for the memory store, whatever it scored.
        firstAnswerListener({ questId: before.questId, episodeId: before.episodeId, correct: correct || hinted, asked, at: new Date(), ...(hinted ? { hinted: true } : {}) });
      } catch {
        // The round is scored; only the memory store misses the answer.
      }
    }
  },

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

/**
 * A round played beside the steps (the scaffold round, F-CURR-002 section 4.6): its first answer goes to the memory
 * store as every round's does, and is not scored, so the quest's stars are its own. A right answer carries the hint
 * flag; a wrong one is a plain miss (a hinted answer is never wrong, `logic/memory/spacing.ts`).
 */
export function answerAside(asked: RoundAsked, correct: boolean): void {
  const { questId, episodeId } = useQuestRunStore.getState();
  if (!firstAnswerListener || !questId || !episodeId) return;
  try {
    firstAnswerListener({ questId, episodeId, correct, asked, at: new Date(), ...(correct ? { hinted: true } : {}) });
  } catch {
    // Only the memory store misses the answer.
  }
}
