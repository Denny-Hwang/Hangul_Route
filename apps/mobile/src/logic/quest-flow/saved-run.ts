import type { QuestStepKind } from '@hangul-route/content-schema';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-12 (audit FUNC-3): a quest left by a reload continues where it stopped.
 *
 * The run in `quest-run-store` is memory only, so a reload or a discarded tab in the middle of a quest lost it. The
 * learner's quest player now keeps, per profile and on this device only, the least it needs to go on: the quest, the
 * step, the tallies with the keys of the rounds already scored, the skipped game steps (row AU-9) and when the run
 * started. Starting the same quest again within 24 hours of that start opens the saved step; the step itself starts
 * from its beginning, and a round scored before the reload is not scored again (its key is kept).
 *
 * Pure rules: what is stored, and whether a stored value may be resumed. `store/quest-run-saved.ts` reads and writes.
 * Not kept: what each missed round asked (Try these again offers the misses made after the resume), the adaptive
 * pacing's tries and its shorter Apply, and a pending advance.
 *
 * [QB] AMENDMENTS-QUEST-SOUND-BACK row QB-4: the step that is stored is the furthest step the run reached, not the step
 * on screen, so a reload after Previous resumes at the furthest step, not behind it. The step events already sent
 * (row QB-3) are stored with it, so a resumed run does not send them a second time.
 */

/** How long after its start a saved run may be resumed. */
export const SAVED_RUN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StepLike {
  id: string;
  kind: QuestStepKind;
  minigameRef?: string;
  /** [LR] Only the `story-read` step is told apart (a story quest resumes through Keep reading, never from Home). */
  minigameKind?: string;
}

/** The stored value (`hr:quest-run:<profileId>`). */
export interface SavedQuestRun {
  v: 1;
  questId: string;
  episodeId: string;
  /** The quest's step list when the run was saved (`stepsSignature`): a changed list discards the run. */
  steps: string;
  /** [QB] The furthest step the run reached (row QB-4): the step a resumed run opens on. */
  stepIndex: number;
  correctCount: number;
  totalCount: number;
  retryCount: number;
  scoredRounds: string[];
  skippedSteps: number[];
  /** ISO time the run began; a resumed run keeps it. */
  startedAt: string;
  /** [QB] The step events already sent, as `<event>:<step>` (row QB-3). Left out while there is none (and in a value stored before the row). */
  reported?: string[];
}

/** What `quest-run-store.beginQuest` restores. */
export interface QuestRunRestore {
  stepIndex: number;
  correctCount: number;
  totalCount: number;
  retryCount: number;
  scoredRounds: readonly string[];
  skippedSteps: readonly number[];
  startedAt: string;
  /** [QB] The step events already sent (row QB-3). */
  reported?: readonly string[];
}

/** The run fields the saved value is made from (`quest-run-store`). */
export interface RunToSave {
  questId: string | null;
  episodeId: string | null;
  stepIndex: number;
  /** [QB] The furthest step reached (row QB-4); absent, the step on screen is the furthest. */
  furthestStep?: number;
  /** [QB] The step events already sent (row QB-3). */
  reported?: readonly string[];
  correctCount: number;
  totalCount: number;
  retryCount: number;
  scoredRounds: readonly string[];
  skippedSteps: readonly number[];
  startedAt: string | null;
}

/** The step list as one string: each step's id, kind and game. A step added, removed, moved or changed changes it. */
export function stepsSignature(steps: readonly StepLike[]): string {
  return steps.map((step) => `${step.id}:${step.kind}:${step.minigameRef ?? ''}`).join('|');
}

/** The value to store for a run in progress, or null for a store that holds no run. */
export function savedRunOf(run: RunToSave, steps: readonly StepLike[]): SavedQuestRun | null {
  if (run.questId === null || run.episodeId === null || run.startedAt === null) return null;
  return {
    v: 1,
    questId: run.questId,
    episodeId: run.episodeId,
    steps: stepsSignature(steps),
    stepIndex: Math.max(run.stepIndex, run.furthestStep ?? run.stepIndex),
    correctCount: run.correctCount,
    totalCount: run.totalCount,
    retryCount: run.retryCount,
    scoredRounds: [...run.scoredRounds],
    skippedSteps: [...run.skippedSteps],
    startedAt: run.startedAt,
    ...(run.reported && run.reported.length > 0 ? { reported: [...run.reported] } : {}),
  };
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * What a stored value restores for `quest` at `now`, or null: the run starts fresh (and the stored value is replaced
 * by the new run's). Resumed only when the value is a saved run of this quest, its step list is the quest's list
 * today (a content update with another list discards it), it began at most 24 hours ago, and its numbers are a run's:
 * a step inside the quest, one scored-round key per scored round, no more right answers than rounds. Anything else is
 * not repaired, it is dropped.
 */
export function resumableRun(saved: unknown, quest: { id: string; steps: readonly StepLike[] }, now: number): QuestRunRestore | null {
  if (typeof saved !== 'object' || saved === null) return null;
  const run = saved as Partial<Record<keyof SavedQuestRun, unknown>>;
  if (run.v !== 1 || run.questId !== quest.id || run.steps !== stepsSignature(quest.steps)) return null;
  if (typeof run.startedAt !== 'string') return null;
  const started = Date.parse(run.startedAt);
  // A clock set back reads as a run from the future: within a day either way it is the same run.
  if (!Number.isFinite(started) || Math.abs(now - started) > SAVED_RUN_MAX_AGE_MS) return null;
  const { stepIndex, correctCount, totalCount, retryCount, scoredRounds, skippedSteps } = run;
  if (!isCount(stepIndex) || stepIndex >= quest.steps.length) return null;
  if (!isCount(correctCount) || !isCount(totalCount) || !isCount(retryCount) || correctCount > totalCount) return null;
  if (!Array.isArray(scoredRounds) || scoredRounds.length !== totalCount || !scoredRounds.every((key) => typeof key === 'string')) return null;
  if (new Set(scoredRounds).size !== scoredRounds.length) return null;
  // [QB] The stored step is the furthest one (row QB-4), and a step is skipped by moving past it: every skipped step is behind it.
  if (!Array.isArray(skippedSteps) || !skippedSteps.every((step) => isCount(step) && step < stepIndex)) return null;
  const { reported } = run;
  if (reported !== undefined && !(Array.isArray(reported) && reported.every((key) => typeof key === 'string'))) return null;
  return {
    stepIndex,
    correctCount,
    totalCount,
    retryCount,
    scoredRounds: scoredRounds as string[],
    skippedSteps: [...new Set(skippedSteps as number[])],
    startedAt: run.startedAt,
    ...(reported === undefined ? {} : { reported: [...new Set(reported as string[])] }),
  };
}

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-2 (section 3.2): whether Home's hero may say that its lesson goes on, from the
 * stored value alone, so a lesson's chunk is asked for only when the answer is yes. A run of this quest (`v` 1), begun
 * at most 24 hours ago either way (the rule of `resumableRun`), whose `stepIndex` is a whole number of 1 or more (a run
 * saved as it began has nothing to go on from), and a quest with no `story-read` step among the steps known so far
 * (a story quest resumes only through Keep reading, `learnerQuestSession`). The rest of `resumableRun` (the step list,
 * the tallies) is checked once the steps are in.
 */
export function resumeCandidate(saved: unknown, quest: { id: string; steps: readonly StepLike[] }, now: number): boolean {
  if (typeof saved !== 'object' || saved === null) return false;
  const run = saved as Partial<Record<keyof SavedQuestRun, unknown>>;
  if (run.v !== 1 || run.questId !== quest.id || typeof run.startedAt !== 'string') return false;
  const started = Date.parse(run.startedAt);
  if (!Number.isFinite(started) || Math.abs(now - started) > SAVED_RUN_MAX_AGE_MS) return false;
  if (!isCount(run.stepIndex) || run.stepIndex < 1) return false;
  return !quest.steps.some((step) => step.minigameKind === 'story-read');
}
