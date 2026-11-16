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
 */

/** How long after its start a saved run may be resumed. */
export const SAVED_RUN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StepLike {
  id: string;
  kind: QuestStepKind;
  minigameRef?: string;
}

/** The stored value (`hr:quest-run:<profileId>`). */
export interface SavedQuestRun {
  v: 1;
  questId: string;
  episodeId: string;
  /** The quest's step list when the run was saved (`stepsSignature`): a changed list discards the run. */
  steps: string;
  stepIndex: number;
  correctCount: number;
  totalCount: number;
  retryCount: number;
  scoredRounds: string[];
  skippedSteps: number[];
  /** ISO time the run began; a resumed run keeps it. */
  startedAt: string;
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
}

/** The run fields the saved value is made from (`quest-run-store`). */
export interface RunToSave {
  questId: string | null;
  episodeId: string | null;
  stepIndex: number;
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
    stepIndex: run.stepIndex,
    correctCount: run.correctCount,
    totalCount: run.totalCount,
    retryCount: run.retryCount,
    scoredRounds: [...run.scoredRounds],
    skippedSteps: [...run.skippedSteps],
    startedAt: run.startedAt,
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
  if (!Array.isArray(skippedSteps) || !skippedSteps.every((step) => isCount(step) && step < stepIndex)) return null;
  return {
    stepIndex,
    correctCount,
    totalCount,
    retryCount,
    scoredRounds: scoredRounds as string[],
    skippedSteps: [...new Set(skippedSteps as number[])],
    startedAt: run.startedAt,
  };
}
