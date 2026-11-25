import { create } from 'zustand';
import { tallyAnswer } from '../logic/first-try';
import type { RoundAsked } from '../logic/memory/asked';
import type { MinigameScope } from '../logic/minigame-config';
import type { StepTry } from '../logic/quest-flow/quest-adapt';
import { questOutcome } from '../logic/quest-outcome';
import type { QuestRunRestore } from '../logic/quest-flow/saved-run';
import { skipStarCap } from '../logic/quest-flow/skip-cap';

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
  /** [AU] ISO time the run began (AMENDMENTS-AUDIT-2026-11 row AU-12): a run resumed after a reload keeps its first start. */
  startedAt: string | null;
  stepIndex: number;
  /**
   * [QB] The furthest step this run reached (AMENDMENTS-QUEST-SOUND-BACK QB-2, QB-3). Previous lowers `stepIndex` and
   * never this, so a step with `stepIndex < furthestStep` is a revisit: a step shown again.
   */
  furthestStep: number;
  /** [QB] The step on screen was reached by Previous (QB-2): a Look and learn step then opens on its last page. */
  cameBack: boolean;
  /** Rounds answered right on the first try (logic/first-try). */
  correctCount: number;
  /** Rounds scored — one per round, whatever the number of taps. */
  totalCount: number;
  /** Answers after a round's first one — analytics only, never scored. */
  retryCount: number;
  /** `${stepIndex}:${roundKey}` of every round already scored this run. */
  scoredRounds: readonly string[];
  /**
   * [AU] The game steps this run skipped with Skip for now on the step's launcher (AMENDMENTS-AUDIT-2026-11 row AU-9).
   * They cap the run's stars (`quest-flow/skip-cap.ts`). A game ended from inside is a completed step, as before.
   */
  skippedSteps: readonly number[];
  /**
   * [QB] The step events already sent in this run, as `<event>:<step>` (QB-3): `quest.discover_completed`,
   * `quest.check_completed` and `minigame.finished` go out once per step per run, however often the step is shown.
   */
  reported: readonly string[];
  /**
   * [LR] Answers given in this run, every `answerRound` call counted: a first try, a retry, a hinted answer and an
   * answer on a revisit alike (AMENDMENTS-QUEST-LEAVE-RESUME LR-1, section 3.1). A game's back guard compares it with
   * the value when the game mounted, so it knows the game has progress. Never saved, scored or sent.
   */
  answersGiven: number;
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
   * [AU] `restore` (row AU-12): the run a reload interrupted goes on from its saved step with its tallies, the keys of
   * the rounds already scored (so none is scored twice) and its skipped steps; the step starts from its beginning.
   * [QB] The saved step is the furthest step the run reached (AMENDMENTS-QUEST-SOUND-BACK QB-4): the run opens there.
   */
  beginQuest: (questId: string, episodeId: string, startStepIndex?: number, restore?: QuestRunRestore) => void;
  /**
   * Report one answer in a minigame round. Games call this on every answer;
   * only the first answer for a round key (within the current step) scores.
   * `hinted`: answered with help (Dictation's hint or a one-letter slip, row CM-31; Story Order's Show meanings, row
   * CM-34, which passes it with a right answer only; Match Sound's right tap after the learner's own Show the letters,
   * AMENDMENTS-AUDIO-CANT-HEAR CH-1f): the memory store records it as a hinted right answer.
   * [QB] On a step shown again after Previous (AMENDMENTS-QUEST-SOUND-BACK QB-3) an answer changes nothing: no right
   * answer, no miss, no retry, nothing for Try these again or the pacing rules, and no event for the memory store. The
   * step was scored when it was first played. The one exception is a step that was skipped: it was never played, so
   * its rounds score as on a first play.
   */
  answerRound: (roundKey: string | number, correct: boolean, asked?: RoundAsked, hinted?: boolean) => void;
  /**
   * The game of the current step ended. [QB] A skipped step that is played to its end on a revisit is no longer a
   * skipped step (QB-3), so it stops capping the stars.
   */
  markStepComplete: () => void;
  /**
   * [QB] Whether `event` of `step` is sent now for the first time in this run (QB-3); it is noted as sent. With no run
   * in the store there is nothing to note and the answer is yes.
   */
  reportOnce: (event: string, step: number) => boolean;
  /** [AU] Skip for now on the current step's launcher (row AU-9): the step is noted as skipped; the caller moves on. */
  markStepSkipped: () => void;
  goNextStep: () => void;
  /**
   * [QB] Previous (QB-2): the step before, never under the first. Nothing tallied changes, the furthest step stays,
   * and a game's pending advance is dropped (the learner chose where to go).
   */
  goPrevStep: () => void;
  consumePendingAdvance: () => void;
  reset: () => void;
  /**
   * The run's stars. [AU] With the quest's steps, a skipped game step caps them (row AU-9); without, any noted skip
   * caps them at 2.
   */
  stars: (steps?: Parameters<typeof skipStarCap>[0]) => 0 | 1 | 2 | 3;
}

const blankRun = {
  questId: null,
  episodeId: null,
  startedAt: null,
  stepIndex: 0,
  furthestStep: 0,
  cameBack: false,
  correctCount: 0,
  totalCount: 0,
  retryCount: 0,
  scoredRounds: [],
  skippedSteps: [],
  reported: [],
  answersGiven: 0,
  pendingAdvance: false,
  missed: [],
  tries: [],
  short: null,
} satisfies State;

export const useQuestRunStore = create<State & Actions>((set, get) => ({
  ...blankRun,

  beginQuest: (questId, episodeId, startStepIndex = 0, restore) => {
    const stepIndex = Number.isInteger(startStepIndex) && startStepIndex > 0 ? startStepIndex : 0;
    set({
      ...blankRun,
      questId,
      episodeId,
      startedAt: restore?.startedAt ?? new Date().toISOString(),
      stepIndex,
      furthestStep: stepIndex,
      ...(restore
        ? {
            correctCount: restore.correctCount,
            totalCount: restore.totalCount,
            retryCount: restore.retryCount,
            scoredRounds: restore.scoredRounds,
            skippedSteps: restore.skippedSteps,
            // [QB] The step events the run already sent (QB-3, QB-4): a resumed run does not send them again.
            reported: restore.reported ?? [],
          }
        : {}),
    });
  },

  answerRound: (roundKey, correct, asked, hinted = false) => {
    // [LR] Counted before QB-3's return for a revisit: an answer there is an answer, and a game that has one asks first.
    set((s) => ({ answersGiven: s.answersGiven + 1 }));
    const before = get();
    // [QB] A step played again scores nothing new (QB-3); a skipped step was never played, so it scores.
    if (before.stepIndex < before.furthestStep && !before.skippedSteps.includes(before.stepIndex)) return;
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
        // A hinted answer (help shown, or a typed slip of one letter) is never wrong for the memory store, whatever it
        // scored; a hint carried by the round asked (Role Play's Show meanings, row CM-35) counts with a right answer only.
        const help = hinted || (correct && asked.hinted === true);
        firstAnswerListener({ questId: before.questId, episodeId: before.episodeId, correct: correct || hinted, asked, at: new Date(), ...(help ? { hinted: true } : {}) });
      } catch {
        // The round is scored; only the memory store misses the answer.
      }
    }
  },

  markStepComplete: () =>
    set((s) => ({
      pendingAdvance: true,
      ...(s.skippedSteps.includes(s.stepIndex) ? { skippedSteps: s.skippedSteps.filter((step) => step !== s.stepIndex) } : {}),
    })),

  reportOnce: (event, step) => {
    const { questId, reported } = get();
    if (questId === null) return true;
    const key = `${event}:${step}`;
    if (reported.includes(key)) return false;
    set({ reported: [...reported, key] });
    return true;
  },

  markStepSkipped: () => set((s) => ({ skippedSteps: withStep(s.skippedSteps, s.stepIndex) })),

  goNextStep: () => set(stepForward),

  goPrevStep: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1), pendingAdvance: false, cameBack: s.stepIndex > 0 })),

  consumePendingAdvance: () => {
    const { pendingAdvance } = get();
    if (pendingAdvance) {
      set(stepForward);
    }
  },

  reset: () => set({ ...blankRun }),

  stars: (steps) => {
    const { correctCount, totalCount, skippedSteps } = get();
    const cap = steps ? skipStarCap(steps, skippedSteps) : skippedSteps.length > 0 ? 2 : 3;
    return questOutcome(correctCount, totalCount, cap).stars;
  },
}));

/** One step forward, from a first visit or a revisit alike; the furthest step only grows. */
function stepForward(s: State): Pick<State, 'stepIndex' | 'furthestStep' | 'pendingAdvance' | 'cameBack'> {
  const stepIndex = s.stepIndex + 1;
  return { stepIndex, furthestStep: Math.max(s.furthestStep, stepIndex), pendingAdvance: false, cameBack: false };
}

function withStep(steps: readonly number[], step: number): readonly number[] {
  return steps.includes(step) ? steps : [...steps, step];
}

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
