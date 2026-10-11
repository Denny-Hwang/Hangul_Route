import type { StoryLevel } from '@hangul-route/content-schema';
import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { storiesAll, storyFixtureIds } from '../content/stories';
import type { SourcesRouteParams } from '../logic/story/source-link';
import { addTelemetryListener, type TelemetryEvent } from '../platform/telemetry';

/**
 * End-to-end entry to the replay reader, for fixture builds only
 * (`pnpm --filter @hangul-route/mobile build:web:fixtures`, F-STORY-002 §5).
 * No learner can reach a story until F-STORY-004's shelf ships, so the reader
 * e2e opens it through `window.__hrStoryE2E.openReader(...)`. The switch is
 * the bundle itself: only an e2e bundle (`build-stories.mjs
 * --include-fixtures`) has fixture ids, so in a real build the flag is false,
 * the root navigator never renders the hook and nothing is installed. (Not an
 * env variable: Metro caches transforms across builds, and a cached
 * `process.env` value could survive into a later production build.)
 */
export const STORY_FIXTURES_BUILD = storyFixtureIds.length > 0;

export interface StoryE2eHandle {
  openReader(params: { storyId: string; level: StoryLevel; sceneIndex?: number }): void;
  /** Sources with its deep-link params (F-STORY-002 PR 2.7; F-STORY-004 adds the episode and notes links). */
  openSources(params: SourcesRouteParams): void;
  /** Opens a story's shelf quest (F-STORY-002 PR 2.6b: the reader as a quest step) until the shelf can. */
  openQuest(params: { questId: string; episodeId: string }): void;
  /** Every bundled story with its tiers, so the e2e can smoke-read the real content too. */
  stories(): Array<{ id: string; levels: StoryLevel[]; fixture: boolean; traditional: boolean }>;
  /** `story.*` telemetry events `track()` accepted since the hook mounted (the e2e build sends none). */
  events(): TelemetryEvent[];
}

export function StoryE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrStoryE2E?: StoryE2eHandle };
    const events: TelemetryEvent[] = [];
    const stopListening = addTelemetryListener((e) => {
      if (e.name.startsWith('story.')) events.push(e);
    });
    g.__hrStoryE2E = {
      events: () => events.map((e) => ({ ...e })),
      openReader: ({ storyId, level, sceneIndex }) =>
        navigation.navigate('StoryReader', { storyId, level, mode: 'replay', ...(sceneIndex === undefined ? {} : { sceneIndex }) }),
      openSources: (params) => navigation.navigate('StorySources', params),
      openQuest: ({ questId, episodeId }) => navigation.navigate('QuestPlayer', { questId, episodeId }),
      stories: () =>
        storiesAll.map((s) => ({
          id: s.id,
          levels: s.tiers.map((t) => t.level),
          fixture: storyFixtureIds.includes(s.id),
          traditional: s.origin.type === 'traditional' || s.origin.type === 'adapted',
        })),
    };
    return () => {
      stopListening();
      delete g.__hrStoryE2E;
    };
  }, [navigation]);
  return null;
}
