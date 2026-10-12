import type { Quest } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import { episodeReturn } from '../layout/quest-return';
import { questOutcome, type QuestOutcome } from '../quest-outcome';
import type { Bookmark } from '../story/bookmarks';
import { questStartStep } from '../story/resume';

/**
 * The quest player's seam to the outside world (F-BROWSE-001 §4.7, BR-5a). `QuestPlayerView` plays
 * the steps; everything that touches a learner's record, the navigation stack or telemetry goes
 * through these ports. The learner app wires them to today's behaviour (this file); the All lessons
 * preview wires them to ports that save nothing (BR-6).
 */
export interface QuestPlayerPorts {
  /**
   * Called once per mount (and again when the quest or the session changes). Returns the step the run
   * starts on, or `null` when no run may start (the learner app with no active profile: nothing begins).
   */
  start(questId: string, episodeId: string): number | null;
  /** The cleanup of `start`. */
  end(): void;
  /** The last step is done. */
  finish(result: QuestFinish): void;
  /** The player confirmed Leave; the run has already been discarded. */
  leave(): void;
  /** A quest telemetry event; the view never names a person (the ports add who, if anyone). */
  track(event: QuestPlayerEvent): void;
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
}

/** Rounds are scored on the first try; a run with every game skipped is 0 / 0, not 5 / 5. */
export function questFinish(run: QuestRunCounters): QuestFinish {
  return { ...questOutcome(run.correctCount, run.totalCount), retries: run.retryCount };
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
  beginSession: (profileId: string) => void;
  endSession: (profileId: string) => void;
}

/**
 * The learner's `start` / `end`: a resumed story quest opens on its story-read step (F-STORY-004
 * §3.8); without a usable bookmark it starts at step 0. A study session runs for the active profile.
 */
export function learnerQuestSession(deps: LearnerSessionDeps): Pick<QuestPlayerPorts, 'start' | 'end'> {
  const { profileId } = deps;
  return {
    start: (questId) => {
      if (profileId === null) return null;
      const step = questStartStep(deps.questById(questId), deps.resume, (storyId) =>
        deps.bookmarkOf(profileId, storyId),
      );
      deps.beginSession(profileId);
      return step;
    },
    end: () => {
      if (profileId !== null) deps.endSession(profileId);
    },
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
}

/**
 * The learner's `finish` / `leave` / `track`: Results, the episode (its Journey pane on two panes,
 * F-LAYOUT-001 §3.7) and the platform telemetry client with the active profile.
 */
export function learnerQuestExits(deps: LearnerExitDeps): Pick<QuestPlayerPorts, 'finish' | 'leave' | 'track'> {
  return {
    finish: (result) => deps.toResults(resultsReset(deps.questId, deps.episodeId, result)),
    leave: () => {
      const back = episodeReturn(deps.panes, deps.episodeId, deps.under());
      if (back.to === 'journeyPane') deps.toJourneyPane(back.episodeId);
      else deps.toEpisodeScreen(back.episodeId);
    },
    track: (event) => {
      void deps.track({ ...event, profileId: deps.profileId });
    },
  };
}
