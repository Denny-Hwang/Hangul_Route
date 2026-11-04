import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Quest } from '@hangul-route/content-schema';
import { storiesAll, storyContent } from '../content/stories';
import { isStoryNewBuildError, type StoryStore } from '../logic/story/story-chunk-store';
import { storyIdOfQuest } from '../logic/story/story-ref';
import { isNewBuildAnswer, reloadForNewBuild } from '../platform/new-build-reload';
import { LATER_STORY_IDS } from '../content/later-content';
import type { ChunkState } from './lesson-content';

/**
 * The screens' side of the on-demand story chunks (F-CURR-002 §10, row CM-8;
 * `logic/story/story-chunk-store.ts`). The shelf (titles, levels, card faces) is in the start bundle; a
 * story's tiers, scenes, art, facts and summary come from its chunk, so:
 * - `useStoryReady`: the screens that play or cite a story (the reader, its games, Sources) draw
 *   only their waiting state (`LessonWaiting`: the way back, then a calm status line) until its chunk
 *   is in (the service worker answers from its precache, so this is a frame or two). A chunk that
 *   cannot load goes to the app's crash screen, whose Try again loads it again; a chunk of a newer
 *   build (what it held, or what its URL answers when asked again) reloads the page once instead. A tale only a
 *   book 2 holds (row CM-5B, not precached) that cannot load and is not a newer build is the calm
 *   `LaterNeedsInternet` state instead (`useStoryState`), whichever way it was opened;
 * - `useStoryLoaded`: one story's cover or card back (a card face, a card page) loads its chunk and
 *   redraws when that story's chunk arrives, not when any other does;
 * - `useStoriesLoaded`: the screens that show many covers (the shelf, Home, the episode page) load
 *   the chunks of the stories they show and draw them as each arrives (the theme tint stands in for
 *   a cover until then);
 * - `useStoryContentVersion`: the screens that read every story load every chunk and recompute as
 *   each arrives (a list only fills);
 * - `useNoteStoriesLoaded` / `useNoteStoriesReady`: Culture notes, whose notes cite the facts of the
 *   stories that carry them. The screen waits for every story with notes the way the reader waits for
 *   its story, failure included: a found note is never left out because its chunk did not load. A book 2 tale
 *   that is not on the device and cannot load is left out instead (row CM-5B): the learner never opened it here,
 *   so none of its notes is found on this device.
 * `storyContentBindings` takes the store and the page's reload, so the render tests drive them with
 * a store of their own (the global test setup preloads the app's).
 */

export interface StoryContentDeps {
  store: StoryStore;
  /** The stories that carry culture notes. */
  noteStoryIds: readonly string[];
  /** Reloads the page for a newer build (online, at most once a minute); false when it did not. */
  reloadForNewBuild: () => boolean;
  /** Asks a failed chunk's URL again: true when the host answers for a newer build (404, or its HTML page refused as a script). */
  isNewBuildAnswer: (error: unknown) => Promise<boolean>;
  /** A tale only a book 2 holds (row CM-5B: not precached); none when omitted. */
  isLaterStory?: (storyId: string) => boolean;
}

export function storyContentBindings({
  store,
  noteStoryIds,
  reloadForNewBuild: reload,
  isNewBuildAnswer: newBuildAnswer,
  isLaterStory = () => false,
}: StoryContentDeps) {
  const subscribe = store.subscribe;
  /** True when a failed load means a newer build on the host: what the chunk said, else what its URL answers now. */
  const isNewer = async (error: unknown): Promise<boolean> => isStoryNewBuildError(error) || (await newBuildAnswer(error).catch(() => false));

  /**
   * The story's chunk: `ready` at once for no story or an id that is not a bundled story; a book 2 tale that cannot
   * load (not a newer build) is `needs-internet`; any other failed load throws (the crash screen).
   */
  function useStoryState(storyId: string | null | undefined): ChunkState {
    const ready = useSyncExternalStore(subscribe, () => storyId == null || store.isStoryReady(storyId));
    // Keyed by the story, so a host that reuses the screen for another story never shows the old one's failure.
    const [failed, setFailed] = useState<{ storyId: string; error: unknown; later: boolean } | null>(null);
    useEffect(() => {
      if (ready || storyId == null) return undefined;
      let live = true;
      store.ensureStories([storyId]).catch(async (error: unknown) => {
        if (!live) return;
        const newer = await isNewer(error);
        if (!live || (newer && reload())) return;
        setFailed({ storyId, error, later: !newer && isLaterStory(storyId) });
      });
      return () => {
        live = false;
      };
    }, [storyId, ready]);
    if (ready) return 'ready';
    if (failed === null || failed.storyId !== storyId) return 'waiting';
    if (failed.later) return 'needs-internet';
    throw failed.error;
  }

  /** True once the story's chunk is in (at once for an id that is not a bundled story); throws a failed load. */
  function useStoryReady(storyId: string | null | undefined): boolean {
    return useStoryState(storyId) === 'ready';
  }

  /** `useStoryState` for the story a quest plays (`ready` for a quest that is not a story quest). */
  function useStoryQuestState(quest: Pick<Quest, 'steps'> | undefined): ChunkState {
    return useStoryState(quest === undefined ? null : storyIdOfQuest(quest));
  }

  /** `useStoryReady` for the story a quest plays (none for a quest that is not a story quest). */
  function useStoryQuestReady(quest: Pick<Quest, 'steps'> | undefined): boolean {
    return useStoryQuestState(quest) === 'ready';
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

  /**
   * True once every story with culture notes has its chunk in; throws a failed load (the crash screen, whose
   * Try again loads it again), as `useStoryReady` does, so a found note never goes missing from the list or a
   * deep link. A chunk of a newer build reloads the page once instead.
   */
  function useNoteStoriesReady(): boolean {
    const allIn = useSyncExternalStore(subscribe, () => noteStoryIds.every((id) => store.isStoryReady(id)));
    // Book 2 tales whose chunk could not load (not a newer build): left out, never the crash screen (row CM-5B).
    const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
    const inOrSkipped = allIn || noteStoryIds.every((id) => skipped.has(id) || store.isStoryReady(id));
    const [failed, setFailed] = useState<{ error: unknown } | null>(null);
    useEffect(() => {
      if (allIn) return undefined;
      let live = true;
      void Promise.allSettled(noteStoryIds.map((id) => store.ensureStories([id]))).then(async (results) => {
        const failures = noteStoryIds.flatMap((id, i) => {
          const r = results[i];
          return r?.status === 'rejected' ? [{ id, reason: r.reason as unknown }] : [];
        });
        if (!live || failures.length === 0) return;
        const newer = (await Promise.all(failures.map((f) => isNewer(f.reason)))).some(Boolean);
        if (!live || (newer && reload())) return;
        const other = newer ? failures[0] : failures.find((f) => !isLaterStory(f.id));
        if (other !== undefined) setFailed({ error: other.reason });
        else setSkipped(new Set(failures.map((f) => f.id)));
      });
      return () => {
        live = false;
      };
    }, [allIn]);
    if (!inOrSkipped && failed !== null) throw failed.error;
    return inOrSkipped;
  }

  return {
    useStoryState,
    useStoryReady,
    useStoryQuestState,
    useStoryQuestReady,
    useStoryLoaded,
    useStoriesLoaded,
    useStoryContentVersion,
    useNoteStoriesLoaded,
    useNoteStoriesReady,
  };
}

/** The stories that carry culture notes: their notes cite the story's facts, which are in its chunk. */
const NOTE_STORY_IDS: readonly string[] = storiesAll.filter((s) => s.cultureNotes.length > 0).map((s) => s.id);

export const {
  useStoryState,
  useStoryReady,
  useStoryQuestState,
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
  isNewBuildAnswer: (error) => isNewBuildAnswer(error),
  isLaterStory: (id) => LATER_STORY_IDS.has(id),
});
