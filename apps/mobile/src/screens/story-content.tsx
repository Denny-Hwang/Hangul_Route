import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Quest } from '@hangul-route/content-schema';
import { storiesAll, storyContent } from '../content/stories';
import { isNewBuildError } from '../logic/lessons/lesson-store';
import { storyIdOfQuest } from '../logic/story/story-ref';
import { reloadForNewBuild } from '../platform/new-build-reload';

/**
 * The screens' side of the on-demand story chunks (F-CURR-002 §10, row CM-8;
 * `logic/story/story-chunk-store.ts`). The shelf (titles, levels, card faces) is in the start bundle; a
 * story's tiers, scenes, art, facts and summary come from its chunk, so:
 * - `useStoryReady`: the screens that play or cite a story (the reader, its games, Sources) draw
 *   nothing until its chunk is in (the service worker answers from its precache, so this is a
 *   frame or two), and a chunk that cannot load goes to the app's crash screen, whose Try again
 *   loads it again; a chunk of a newer build reloads the page once instead (as the lesson chunks do);
 * - `useStoriesLoaded`: the screens that show covers or card backs (the shelf, Home, the card
 *   pages) load the chunks of the stories they show and draw them as each arrives (the theme tint
 *   stands in for a cover until then);
 * - `useStoryContentVersion`: the screens that read every story (Culture notes) load every chunk
 *   and recompute as each arrives (a list only fills).
 */

const subscribe = storyContent.subscribe;

/** True once the story's chunk is in (at once for an id that is not a bundled story); throws a failed load. */
export function useStoryReady(storyId: string | null | undefined): boolean {
  const ready = useSyncExternalStore(subscribe, () => storyId == null || storyContent.isStoryReady(storyId));
  const [failed, setFailed] = useState<{ storyId: string; error: unknown } | null>(null);
  useEffect(() => {
    if (ready || storyId == null) return undefined;
    let live = true;
    storyContent.ensureStories([storyId]).catch((error: unknown) => {
      if (!live) return;
      if (isNewBuildError(error) && reloadForNewBuild()) return;
      setFailed({ storyId, error });
    });
    return () => {
      live = false;
    };
  }, [storyId, ready]);
  if (!ready && failed !== null && failed.storyId === storyId) throw failed.error;
  return ready;
}

/** `useStoryReady` for the story a quest plays (none for a quest that is not a story quest). */
export function useStoryQuestReady(quest: Pick<Quest, 'steps'> | undefined): boolean {
  return useStoryReady(quest === undefined ? null : storyIdOfQuest(quest));
}

/** Loads the chunks of these stories; the number changes as each arrives. A failed chunk keeps its placeholders. */
export function useStoriesLoaded(storyIds: readonly string[]): number {
  const version = useSyncExternalStore(subscribe, storyContent.version);
  const key = storyIds.join('\n');
  useEffect(() => {
    // A chunk that cannot load leaves its story's cover and card back blank; the next visit tries again.
    storyContent.ensureStories(key === '' ? [] : key.split('\n')).catch(() => undefined);
  }, [key]);
  return version;
}

/** Loads every story chunk; the number changes as each arrives, for the memos that read every story. */
export function useStoryContentVersion(): number {
  const version = useSyncExternalStore(subscribe, storyContent.version);
  useEffect(() => {
    storyContent.ensureAll().catch(() => undefined);
  }, []);
  return version;
}

/** The stories that carry culture notes: their notes cite the story's facts, which are in its chunk. */
const NOTE_STORY_IDS: readonly string[] = storiesAll.filter((s) => s.cultureNotes.length > 0).map((s) => s.id);

/** Loads the chunks of the stories with culture notes (the Culture notes card and screen list their found notes). */
export function useNoteStoriesLoaded(): number {
  return useStoriesLoaded(NOTE_STORY_IDS);
}
