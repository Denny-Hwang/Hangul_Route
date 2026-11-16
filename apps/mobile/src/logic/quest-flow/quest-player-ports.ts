import type { Quest } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import { episodeReturn } from '../layout/quest-return';
import { questOutcome, type QuestOutcome } from '../quest-outcome';
import type { SessionOptions } from '../sessions/hold';
import type { Bookmark } from '../story/bookmarks';
import { questStartStep } from '../story/resume';
import { storyReadStep } from '../story/story-ref';
import { resumableRun, type QuestRunRestore } from './saved-run';
import { skipStarCap } from './skip-cap';

/**
 * The quest player's seam to the outside world (F-BROWSE-001 §4.7, BR-5a). `QuestPlayerView` plays
 * the steps; everything that touches a learner's record, the navigation stack or telemetry goes
 * through these ports. The learner app wires them to today's behaviour (this file); the All lessons
 * preview wires them to ports that save nothing (`previewQuestPorts`, BR-8).
 */
export interface QuestPlayerPorts {
  /**
   * Called once per mount (and again when the quest or the session changes). Returns the step the run
   * starts on, or `null` when no run may start (the learner app with no active profile: nothing begins).
   * [AU] Or the run a reload interrupted, to go on with (AMENDMENTS-AUDIT-2026-11 row AU-12): its step and tallies.
   */
  start(questId: string, episodeId: string): number | QuestRunRestore | null;
  /** The cleanup of `start`. */
  end(): void;
  /**
   * The last step is done. The run is still in `quest-run-store` when this is called (the learner's
   * Results reads it); a port that does not hand the run on (the preview) resets the store itself.
   */
  finish(result: QuestFinish): void;
  /** The player confirmed Leave; the run has already been discarded. */
  leave(): void;
  /** A quest telemetry event; the view never names a person (the ports add who, if anyone). */
  track(event: QuestPlayerEvent): void;
  /**
   * Whether the run's learner already holds a card, so the reward step tells the truth about the quest's card
   * (F-STORY-006 §3.1: 2 stars earn it; under 2 it comes later). Absent in the All lessons preview, which saves nothing
   * and keeps the quest's authored lines.
   */
  ownsCard?(cardId: string): boolean;
  /**
   * Whether finishing this quest finishes its episode (F-STORY-006 §3.1): the episode then brings the quest's card at any
   * stars, so the reward step must not call it waiting. Absent means no.
   */
  completesEpisode?(episodeId: string, questId: string): boolean;
}

/** The honest outcome of a run plus its retries (telemetry only, never scored). */
export interface QuestFinish extends QuestOutcome {
  retries: number;
}

export type QuestPlayerEvent = Omit<TelemetryEvent, 'profileId'>;

/** The counters of `quest-run-store` the finish reads. */
export interface QuestRunCounters {
  correctCount: number;
  totalCount: number;
  retryCount: number;
  /** [AU] The game steps the run skipped (AMENDMENTS-AUDIT-2026-11 row AU-9). */
  skippedSteps?: readonly number[];
}

/** The quest's steps, as the star cap reads them (`skip-cap.ts`). */
export type QuestRunSteps = Parameters<typeof skipStarCap>[0];

/**
 * Rounds are scored on the first try; a run with every game skipped is 0 / 0, not 5 / 5.
 * [AU] With the quest's `steps`, a skipped game step caps the stars (row AU-9): at most 2 with any skipped, at most 1
 * with every one skipped. The counts stay what was played.
 */
export function questFinish(run: QuestRunCounters, steps?: QuestRunSteps): QuestFinish {
  const cap = steps ? skipStarCap(steps, run.skippedSteps ?? []) : 3;
  return { ...questOutcome(run.correctCount, run.totalCount, cap), retries: run.retryCount };
}

/**
 * The view's start rule (the body of its start effect): the ports pick the first step or say that no
 * run may start. Returns the effect cleanup (`end`), or `undefined` when no run began, so `end` never
 * runs for a run that never started.
 */
export function runQuestStart(
  ports: Pick<QuestPlayerPorts, 'start' | 'end'>,
  begin: (questId: string, episodeId: string, startStep: number, restore?: QuestRunRestore) => void,
  questId: string,
  episodeId: string,
): (() => void) | undefined {
  const startStep = ports.start(questId, episodeId);
  if (startStep === null) return undefined;
  if (typeof startStep === 'number') begin(questId, episodeId, startStep);
  else begin(questId, episodeId, startStep.stepIndex, startStep);
  return () => ports.end();
}

/** The view's confirmed Leave: the run is discarded first, then the ports take the player back. */
export function runQuestLeave(reset: () => void, ports: Pick<QuestPlayerPorts, 'leave'>): void {
  reset();
  ports.leave();
}

/** The view's finish: the honest outcome of the run in the store, handed to the ports. */
export function runQuestFinish(run: QuestRunCounters, ports: Pick<QuestPlayerPorts, 'finish'>, steps?: QuestRunSteps): void {
  ports.finish(questFinish(run, steps));
}

export interface ResultsResetState {
  index: 1;
  routes: [
    { name: 'Main' },
    {
      name: 'Results';
      params: {
        questId: string;
        episodeId: string;
        stars: QuestOutcome['stars'];
        correct: number;
        total: number;
        retries: number;
      };
    },
  ];
}

/** The learner stack after a finished run: the tabs with Results on top. */
export function resultsReset(questId: string, episodeId: string, result: QuestFinish): ResultsResetState {
  const { stars, correct, total, retries } = result;
  return {
    index: 1,
    routes: [{ name: 'Main' }, { name: 'Results', params: { questId, episodeId, stars, correct, total, retries } }],
  };
}

export interface LearnerSessionDeps {
  profileId: string | null;
  resume: boolean | undefined;
  questById: (questId: string) => Quest | undefined;
  bookmarkOf: (profileId: string, storyId: string) => Bookmark | undefined;
  /**
   * Hold a session while the run is open (`store/learner-session`, F-REPORT-001 section 3.3.2):
   * returns its release. The quest player's session moves the streak (`streak: true`).
   */
  holdSession: (profileId: string, options: SessionOptions) => () => void;
  /**
   * [AU] The value stored for the profile's interrupted run (row AU-12, `store/quest-run-saved.ts`), as read. Absent
   * (the guest run, which reopens quest 1 from step 1, AMENDMENTS-GUEST-FIRST-LESSON GU-D12): every run starts fresh.
   */
  savedRun?: unknown;
  /** The clock the saved run's age is read against. */
  now?: () => number;
}

/**
 * The learner's `start` / `end`: a resumed story quest opens on its story-read step (F-STORY-004
 * §3.8); without a usable bookmark it starts at step 0. A study session owned by the quest
 * (`quest:<questId>`) runs for the active profile and moves the streak, as before (F-REPORT-001
 * section 3.3.2); `end` releases it once.
 *
 * [AU] Row AU-12: a run of this quest that a reload interrupted goes on from its saved step (`resumableRun`: the same
 * quest, the same step list, begun at most 24 hours ago). One session is held as for any start, so a resumed run adds
 * no session of its own. A story quest goes on from a saved run only when it was opened to keep reading (`resume`):
 * Start and Start over open it from its first step, as they say.
 */
export function learnerQuestSession(deps: LearnerSessionDeps): Pick<QuestPlayerPorts, 'start' | 'end'> {
  const { profileId } = deps;
  let release: (() => void) | null = null;
  // The stored run is what the device held when the player opened: it is read for the first start only, so a later
  // start of this session (another quest on the same screen) never goes back to it.
  let stored: { value: unknown } | null = deps.savedRun === undefined ? null : { value: deps.savedRun };
  const end = (): void => {
    const held = release;
    release = null;
    held?.();
  };
  return {
    start: (questId) => {
      if (profileId === null) return null;
      const quest = deps.questById(questId);
      const step = questStartStep(quest, deps.resume, (storyId) =>
        deps.bookmarkOf(profileId, storyId),
      );
      const held = stored;
      stored = null;
      const saved =
        quest && held !== null && (deps.resume === true || !storyReadStep(quest))
          ? resumableRun(held.value, { id: questId, steps: quest.steps }, (deps.now ?? Date.now)())
          : null;
      end();
      release = deps.holdSession(profileId, { owner: `quest:${questId}`, streak: true });
      // A story's bookmark step (past the intro) is never traded for an earlier saved step.
      return saved !== null && saved.stepIndex >= step ? saved : step;
    },
    end,
  };
}

export interface LearnerExitDeps {
  questId: string;
  episodeId: string;
  profileId: string | undefined;
  panes: 1 | 2;
  /** The name of the stack route under the player, read when Leave is confirmed. */
  under: () => string | undefined;
  toResults: (state: ResultsResetState) => void;
  toJourneyPane: (episodeId: string) => void;
  toEpisodeScreen: (episodeId: string) => void;
  track: (event: TelemetryEvent) => unknown;
  /** [AU] Forget the run saved for a reload (row AU-12): the quest finished, or the learner chose Leave. */
  clearSavedRun?: () => void;
}

/**
 * The learner's `finish` / `leave` / `track`: Results, the episode (its Journey pane on two panes,
 * F-LAYOUT-001 §3.7) and the platform telemetry client with the active profile.
 */
export function learnerQuestExits(deps: LearnerExitDeps): Pick<QuestPlayerPorts, 'finish' | 'leave' | 'track'> {
  return {
    finish: (result) => {
      deps.clearSavedRun?.();
      deps.toResults(resultsReset(deps.questId, deps.episodeId, result));
    },
    leave: () => {
      deps.clearSavedRun?.();
      const back = episodeReturn(deps.panes, deps.episodeId, deps.under());
      if (back.to === 'journeyPane') deps.toJourneyPane(back.episodeId);
      else deps.toEpisodeScreen(back.episodeId);
    },
    track: (event) => {
      void deps.track({ ...event, profileId: deps.profileId });
    },
  };
}

export interface PreviewPortDeps {
  /** Discard the run in `quest-run-store` (memory only). */
  resetRun: () => void;
  /** Replace the player with the preview end screen (`PreviewEnd`). */
  toEnd: () => void;
  /** Back to the lesson's item page. */
  toItem: () => void;
}

/**
 * The All lessons preview ports (F-BROWSE-001 section 4.7, BR-8): a preview
 * saves nothing. `start` begins at step 0 with no session and no profile;
 * `end` has nothing to release; `finish` resets the run itself (no Results
 * reads it) and goes to the preview end screen; `leave` returns to the item
 * page; `track` sends nothing (the view names no person, and a preview has
 * none to add; the browse telemetry fence would drop a learner event anyway).
 */
export function previewQuestPorts(deps: PreviewPortDeps): QuestPlayerPorts {
  return {
    start: () => 0,
    end: () => undefined,
    finish: () => {
      deps.resetRun();
      deps.toEnd();
    },
    leave: () => deps.toItem(),
    track: () => undefined,
  };
}
