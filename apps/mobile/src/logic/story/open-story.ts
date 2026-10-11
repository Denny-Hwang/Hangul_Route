import type { StoryLevel } from '@hangul-route/content-schema';
import type { StoryIndexEntry } from './story-index';
import type { StoryStatus } from './story-status';

/**
 * The one place that decides how a story opens (F-STORY-004 §3.2, §3.6-3.8):
 * `QuestPlayer` (scored, optionally resumed) or the unscored `StoryReader`
 * replay, whether the bookmark is cleared first (Start over), and the
 * `story.opened` payload, so every surface reports the same way (§3.11).
 * Pure: the caller navigates, clears and tracks.
 */

export type OpenStorySource = 'home' | 'library' | 'episode' | 'results';
export type OpenStoryMode = 'start' | 'continue' | 'restart' | 'play-again' | 'read-again';

export interface StoryOpenedEvent {
  name: 'story.opened';
  /** Ids and codes only (§3.12). */
  payload: { storyId: string; source: OpenStorySource; mode: OpenStoryMode };
}

export type OpenStoryPlan =
  | {
      route: 'QuestPlayer';
      /** `resume` only for a `continue` with a bookmark (route param added by PR 4.4b). */
      params: { questId: string; episodeId: string; resume?: true };
      /** True for Start over: clear the story's bookmark before navigating. */
      clearBookmark: boolean;
      event: StoryOpenedEvent;
    }
  | {
      route: 'StoryReader';
      /** F-STORY-002 `StoryReader`: an unscored replay that writes nothing. */
      params: { storyId: string; level: StoryLevel; mode: 'replay' };
      clearBookmark: false;
      event: StoryOpenedEvent;
    };

/** The primary action for a state: Start, Keep reading or Read it again (§3.4 hero tile). */
export function defaultOpenMode(status: Pick<StoryStatus, 'state'>): OpenStoryMode {
  if (status.state === 'finished') return 'read-again';
  return status.state === 'in-progress' ? 'continue' : 'start';
}

export function planOpenStory(input: {
  entry: Pick<StoryIndexEntry, 'storyId' | 'questId' | 'episodeId' | 'level'>;
  status: StoryStatus;
  source: OpenStorySource;
  /** Defaults to `defaultOpenMode(status)`. */
  mode?: OpenStoryMode;
}): OpenStoryPlan {
  const { entry, status, source } = input;
  const requested = input.mode ?? defaultOpenMode(status);
  // Nothing to resume (no bookmark, another level, or finished): a plain start.
  const mode = requested === 'continue' && !status.bookmark ? 'start' : requested;
  const event: StoryOpenedEvent = { name: 'story.opened', payload: { storyId: entry.storyId, source, mode } };
  if (mode === 'read-again') {
    return {
      route: 'StoryReader',
      params: { storyId: entry.storyId, level: entry.level, mode: 'replay' },
      clearBookmark: false,
      event,
    };
  }
  const params = { questId: entry.questId, episodeId: entry.episodeId };
  return {
    route: 'QuestPlayer',
    params: mode === 'continue' ? { ...params, resume: true } : params,
    clearBookmark: mode === 'restart',
    event,
  };
}
