import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Quest } from '@hangul-route/content-schema';
import { storiesAll, storyContent } from '../content/stories';
import { isStoryNewBuildError, type StoryStore } from '../logic/story/story-chunk-store';
import { storyIdOfQuest } from '../logic/story/story-ref';
import { reloadForNewBuild } from '../platform/new-build-reload';

/**
 * The screens' side of the on-demand story chunks (F-CURR-002 §10, row CM-8;
 * `logic/story/story-chunk-store.ts`). The shelf (titles, levels, card faces) is in the start bundle; a
 * story's tiers, scenes, art, facts and summary come from its chunk, so:
 * - `useStoryReady`: the screens that play or cite a story (the reader, its games, Sources) draw
 *   only their waiting state (`LessonWaiting`: the way back, then a calm status line) until its chunk
 *   is in (the service worker answers from its precache, so this is a frame or two). A chunk that
 *   cannot load goes to the app's crash screen, whose Try again loads it again; a chunk of a newer
 *   build reloads the page once instead;
 * - `useStoryLoaded`: one story's cover or card back (a card face, a card page) loads its chunk and
 *   redraws when that story's chunk arrives, not when any other does;
 * - `useStoriesLoaded`: the screens that show many covers (the shelf, Home, the episode page) load
 *   the chunks of the stories they show and draw them as each arrives (the theme tint stands in for
 *   a cover until then);
 * - `useStoryContentVersion`: the screens that read every story load every chunk and recompute as
 *   each arrives (a list only fills);
 * - `useNoteStoriesLoaded` / `useNoteStoriesReady`: Culture notes, whose notes cite the facts of the
 *   stories that carry them.
 * `storyContentBindings` takes the store and the page's reload, so the render tests drive them with
 * a store of their own (the global test setup preloads the app's).
 */

export interface StoryContentDeps {
  store: StoryStore;
  /** The stories that carry culture notes. */
  noteStoryIds: readonly string[];
  /** Reloads the page for a newer build (online, at most once a minute); false when it did not. */
  reloadForNewBuild: () => boolean;
}

export function storyContentBindings({ store, noteStoryIds, reloadForNewBuild: reload }: StoryContentDeps) {
  const subscribe = store.subscribe;

  /** True once the story's chunk is in (at once for an id that is not a bundled story); throws a failed load. */
  function useStoryReady(storyId: string | null | undefined): boolean {
    const ready = useSyncExternalStore(subscribe, () => storyId == null || store.isStoryReady(storyId));
    // Keyed by the story, so a host that reuses the screen for another story never shows the old one's failure.
    const [failed, setFailed] = useState<{ storyId: string; error: unknown } | null>(null);
    useEffect(() => {
      if (ready || storyId == null) return undefined;
      let live = true;
      store.ensureStories([storyId]).catch((error: unknown) => {
        if (!live) return;
        if (isStoryNewBuildError(error) && reload()) return;
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
  function useStoryQuestReady(quest: Pick<Quest, 'steps'> | undefined): boolean {
    return useStoryReady(quest === undefined ? null : storyIdOfQuest(quest));
  }

  /**
   * Loads one story's chunk; true once it is in (at once for no story, or an id that is not a bundled
   * story). Subscribed to that story alone, so a card redraws only when its own chunk arrives. A failed
   * chunk keeps its placeholders (false); the next mount tries again.
   */
  function useStoryLoaded(storyId: string | null | undefined): boolean {
    const ready = useSyncExternalStore(subscribe, () => storyId == null || store.isStoryReady(storyId));
    useEffect(() => {
      if (ready || storyId == null) return;
      store.ensureStories([storyId]).catch(() => undefined);
    }, [storyId, ready]);
    return ready;
  }

  /** Loads the chunks of these stories; the number changes as each arrives. A failed chunk keeps its placeholders. */
  function useStoriesLoaded(storyIds: readonly string[]): number {
    const version = useSyncExternalStore(subscribe, store.version);
    const key = storyIds.join('\n');
    useEffect(() => {
      // A chunk that cannot load leaves its story's cover and card back blank; the next visit tries again.
      store.ensureStories(key === '' ? [] : key.split('\n')).catch(() => undefined);
    }, [key]);
    return version;
  }

  /** Loads every story chunk; the number changes as each arrives, for the memos that read every story. */
  function useStoryContentVersion(): number {
    const version = useSyncExternalStore(subscribe, store.version);
    useEffect(() => {
      store.ensureAll().catch(() => undefined);
    }, []);
    return version;
  }

  /** Loads the chunks of the stories with culture notes (the Culture notes card and screen list their found notes). */
  function useNoteStoriesLoaded(): number {
    return useStoriesLoaded(noteStoryIds);
  }

  /** True once every story with culture notes has its chunk in, or has failed to load (its notes then stay out). */
  function useNoteStoriesReady(): boolean {
    const allIn = useSyncExternalStore(subscribe, () => noteStoryIds.every((id) => store.isStoryReady(id)));
    const [settled, setSettled] = useState(allIn);
    useEffect(() => {
      if (allIn) return undefined;
      let live = true;
      void Promise.allSettled(noteStoryIds.map((id) => store.ensureStories([id]))).then(() => {
        if (live) setSettled(true);
      });
      return () => {
        live = false;
      };
    }, [allIn]);
    return allIn || settled;
  }

  return { useStoryReady, useStoryQuestReady, useStoryLoaded, useStoriesLoaded, useStoryContentVersion, useNoteStoriesLoaded, useNoteStoriesReady };
}

/** The stories that carry culture notes: their notes cite the story's facts, which are in its chunk. */
const NOTE_STORY_IDS: readonly string[] = storiesAll.filter((s) => s.cultureNotes.length > 0).map((s) => s.id);

export const {
  useStoryReady,
  useStoryQuestReady,
  useStoryLoaded,
  useStoriesLoaded,
  useStoryContentVersion,
  useNoteStoriesLoaded,
  useNoteStoriesReady,
} = storyContentBindings({
  store: storyContent,
  noteStoryIds: NOTE_STORY_IDS,
  reloadForNewBuild: () => reloadForNewBuild(),
});
