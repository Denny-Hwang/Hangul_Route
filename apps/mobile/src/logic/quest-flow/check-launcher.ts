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
  /**
   * [QB] The step is shown again after Previous (AMENDMENTS-QUEST-SOUND-BACK QB-2): the card's main button is the
   * quest's Continue (forward), `againLabel` (Play again) opens the game, and there is no Skip: the step is already
   * done or already skipped.
   */
  revisit: boolean;
  againLabel: string;
}

export function launcherView(kind: QuestStepKind, copy: Messages['learner']['quest']['launcher'], revisit = false): LauncherView {
  if (kind === 'check') {
    return {
      heading: copy.check.heading,
      primaryLabel: copy.check.go.cta,
      showSkip: false,
      skipLabel: copy.game.skip.cta,
      hoya: true,
      revisit,
      againLabel: copy.again.cta,
    };
  }
  return {
    heading: copy.game.heading,
    body: copy.game.body,
    primaryLabel: copy.game.play.cta,
    showSkip: !revisit,
    skipLabel: copy.game.skip.cta,
    hoya: false,
    revisit,
    againLabel: copy.again.cta,
  };
}

/**
 * `quest.discover_completed`: Continue on the last Discover page. [TC] AMENDMENTS-STAGE1-TRACE-COVERAGE OD-TC-8: `pages`
 * counts the trace page, `heard` the Hear it taps (a `write|` tap on the trace page included), `written` the letters traced
 * to the end on this visit and `writeSeconds` the whole seconds the trace page was shown in this mount (0 without one).
 */
export function discoverCompletedPayload(
  questId: string,
  result: { pages: number; heard: number; written: number; writeSeconds: number },
): { questId: string; pages: number; heard: number; written: number; writeSeconds: number } {
  return { questId, pages: result.pages, heard: result.heard, written: result.written, writeSeconds: result.writeSeconds };
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
  /**
   * [QB] The learner went back from the Check with Previous before it ended (AMENDMENTS-QUEST-SOUND-BACK QB-3): what
   * the Check had counted so far. The baseline is taken again when the Check is back on screen, so what is played on
   * the way (a skipped game, played after all) is not counted as the Check's.
   */
  away?: RunCounts;
}

export interface CheckWatchInput extends RunCounts {
  stepIndex: number;
  kind: QuestStepKind | undefined;
  /** [QB] The furthest step the run reached (`quest-run-store`). Absent: the step on screen is the furthest. */
  furthestStep?: number;
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
 * [QB] Nor when the Check is shown again after Previous (QB-3): a Check behind the furthest step has ended and is not
 * watched again, and a Check left by Previous before it ended keeps its counts until the learner is back on it.
 */
export function watchCheck(watch: CheckWatch | null, at: CheckWatchInput): CheckWatchOut {
  let completed: CheckWatchOut['completed'] = null;
  let current = watch;
  if (current && at.stepIndex > current.index) {
    completed = { firstTryCorrect: at.correct - current.correct, retries: at.retries - current.retries };
    current = null;
  } else if (current && at.stepIndex < current.index) {
    if ((at.furthestStep ?? at.stepIndex) >= current.index) {
      // Previous from the Check: its counts so far are kept (once: further steps back change nothing).
      current = current.away ? current : { ...current, away: { correct: at.correct - current.correct, retries: at.retries - current.retries } };
    } else {
      // The run started again from an earlier step.
      current = null;
    }
  } else if (current?.away && at.stepIndex === current.index) {
    current = { index: current.index, correct: at.correct - current.away.correct, retries: at.retries - current.away.retries };
  }
  const ended = at.furthestStep !== undefined && at.stepIndex < at.furthestStep;
  if (current === null && at.kind === 'check' && !ended) {
    current = { index: at.stepIndex, correct: at.correct, retries: at.retries };
  }
  return { watch: current, completed };
}
