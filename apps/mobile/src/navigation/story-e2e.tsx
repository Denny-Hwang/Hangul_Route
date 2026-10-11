import type { StoryLevel } from '@hangul-route/content-schema';
import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { storyFixtureIds } from '../content/stories';

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
}

export function StoryE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrStoryE2E?: StoryE2eHandle };
    g.__hrStoryE2E = {
      openReader: ({ storyId, level, sceneIndex }) =>
        navigation.navigate('StoryReader', { storyId, level, mode: 'replay', ...(sceneIndex === undefined ? {} : { sceneIndex }) }),
    };
    return () => {
      delete g.__hrStoryE2E;
    };
  }, [navigation]);
  return null;
}
