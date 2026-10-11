import type { QuestStepKind } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

/**
 * The game launcher card and the Check's telemetry (F-QUEST-002 §3.3, §3.13).
 * Pure: `QuestPlayerScreen` renders what this returns and calls `track`. The words come from
 * the dictionary (`learner.quest.launcher`), passed in.
 */

export interface LauncherView {
  heading: string;
  body?: string;
  primaryLabel: string;
  /** The Check has no Skip: it is the only evidence the learner can decode what was just taught. */
  showSkip: boolean;
  skipLabel: string;
  /** The heading is said by a small Hoya (the Check card); the generic card is plain text. */
  hoya: boolean;
}

export function launcherView(kind: QuestStepKind, copy: Messages['learner']['quest']['launcher']): LauncherView {
  if (kind === 'check') {
    return {
      heading: copy.check.heading,
      primaryLabel: copy.check.go.cta,
      showSkip: false,
      skipLabel: copy.game.skip.cta,
      hoya: true,
    };
  }
  return {
    heading: copy.game.heading,
    body: copy.game.body,
    primaryLabel: copy.game.play.cta,
    showSkip: true,
    skipLabel: copy.game.skip.cta,
    hoya: false,
  };
}

/** `quest.discover_completed`: Continue on the last Discover page. */
export function discoverCompletedPayload(
  questId: string,
  result: { pages: number; heard: number },
): { questId: string; pages: number; heard: number } {
  return { questId, pages: result.pages, heard: result.heard };
}

export interface RunCounts {
  /** Rounds answered right on the first try so far in the run. */
  correct: number;
  /** Answers after a round's first one so far in the run. */
  retries: number;
}

/** `quest.check_completed`: the Check's own first-try count and retries (what `watchCheck` measured). */
export function checkCompletedPayload(
  questId: string,
  completed: { firstTryCorrect: number; retries: number },
): { questId: string; firstTryCorrect: number; retries: number } {
  return { questId, firstTryCorrect: completed.firstTryCorrect, retries: completed.retries };
}

/** Run totals at the moment the Check step opened. */
export interface CheckWatch extends RunCounts {
  index: number;
}

export interface CheckWatchInput extends RunCounts {
  stepIndex: number;
  kind: QuestStepKind | undefined;
}

export interface CheckWatchOut {
  watch: CheckWatch | null;
  /** Set once, when the player moves past the Check step. */
  completed: { firstTryCorrect: number; retries: number } | null;
}

/**
 * Called whenever the step index changes. The Check ends when the player
 * moves past it (all of its rounds answered, `markStepComplete`), so the
 * event rides the step change: no double firing when the learner leaves the
 * game and comes back to the launcher, none when the run is discarded.
 */
export function watchCheck(watch: CheckWatch | null, at: CheckWatchInput): CheckWatchOut {
  let completed: CheckWatchOut['completed'] = null;
  let current = watch;
  if (current && at.stepIndex > current.index) {
    completed = { firstTryCorrect: at.correct - current.correct, retries: at.retries - current.retries };
    current = null;
  } else if (current && at.stepIndex < current.index) {
    current = null;
  }
  if (current === null && at.kind === 'check') {
    current = { index: at.stepIndex, correct: at.correct, retries: at.retries };
  }
  return { watch: current, completed };
}
