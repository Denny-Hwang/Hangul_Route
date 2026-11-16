import type { QuestStepKind } from '@hangul-route/content-schema';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-9 (audit FUNC-4): skipping a game caps the stars.
 *
 * Stars are first-try right answers over the rounds that were played, so a skipped game used to cost nothing: one
 * perfect game and two skips gave three stars. A run that skipped any game step now earns at most 2 stars, and a run
 * that skipped every game step at most 1. The cap only lowers what this run earns: what is saved is never lowered
 * (`recordBestQuest` keeps the best), and nothing earned is taken away.
 *
 * A game step here is a step with a game the learner can skip: not the Check (its launcher has no Skip,
 * `check-launcher.ts`), and not a story quest's Read the story step, which is reading, not a game (F-STORY-002
 * decision D3: no score on reading), so going past it never lowers the stars of the questions that follow.
 * It counts as skipped when the learner taps Skip for now on its launcher (`quest-run-store.markStepSkipped`).
 *
 * Not a skipped step: a game opened and then ended by its own Skip button (Build a Letter, Card Match, the tracing
 * games, Write Frame). That ends the step as it always did: the rounds answered so far are scored on the first try,
 * and the rounds not reached are in neither count. The run store cannot tell such an end from a game that scores no
 * round when played in full (the story reader without checkpoints), so it is not guessed at here.
 */

export type StarCap = 1 | 2 | 3;

interface StepLike {
  kind: QuestStepKind;
  minigameKind?: unknown;
  minigameRef?: unknown;
}

/** The indexes of the quest's game steps: every step with a game but the Check and the story reader. */
export function skippableGameSteps(steps: readonly StepLike[]): number[] {
  return steps.flatMap((step, i) => (step.kind !== 'check' && step.minigameKind && step.minigameKind !== 'story-read' && step.minigameRef ? [i] : []));
}

/**
 * The most stars a run may earn: 3 with no game step skipped, 2 with some skipped, 1 with all of them skipped. Only
 * skips of the quest's own game steps count, so a stale or unknown index never caps a run.
 */
export function skipStarCap(steps: readonly StepLike[], skippedSteps: readonly number[]): StarCap {
  const games = skippableGameSteps(steps);
  const skipped = games.filter((i) => skippedSteps.includes(i)).length;
  if (skipped === 0) return 3;
  return skipped >= games.length ? 1 : 2;
}
