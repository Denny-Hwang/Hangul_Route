import type { StoryLevel } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { questsAll } from '../content/quests';
import {
  bookmarksKey,
  clearBookmark as clearIn,
  emptyBookmarks,
  finishedStoryLevels,
  mergeBookmarks,
  parseBookmarkFile,
  pruneBookmarks,
  setBookmark as setIn,
  unfinishedBookmark,
  type FinishedCheck,
  type Bookmark,
  type BookmarkFile,
} from '../logic/story/bookmarks';
import { readJson, removeKey, writeJson } from '../platform/storage';
import { onProfileRemoved } from './profile-removal';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';

/**
 * Story bookmarks per profile (F-STORY-004 §3.2, §3.8). Device-local under
 * `story:bookmarks:<profileId>`: not synced, not in backup files, not in a
 * rescue-code restore (§3.13). Hydrated for every profile at cold start
 * (`store/bootstrap.ts`) so Home never renders before bookmarks are in memory.
 * A write made before the saved file loaded stays in memory and is merged with
 * it on load (the discipline of `progress-store.ts`), so it never overwrites
 * what was saved.
 */

interface State {
  byProfile: Record<string, BookmarkFile>;
  /** Profiles whose saved file has been read. Only these are written to storage. */
  hydratedFor: Set<string>;
  /** Profiles written to before their saved file was read; merged with it and saved once it loads. */
  pendingFor: Set<string>;
  /** Stories cleared before the profile's saved file was read; kept out of the merge. */
  clearedFor: Record<string, Set<string>>;
}

interface Actions {
  /** Read the profile's saved bookmarks (once per profile; overlapping calls share one read). */
  hydrate: (profileId: string) => Promise<void>;
  getBookmark: (profileId: string, storyId: string) => Bookmark | undefined;
  /**
   * The bookmark the quest player and the reader resume from: `getBookmark`, minus one whose
   * (story, level) is already finished (§3.8, for example on another device). Results reads
   * `getBookmark` so it can still clear such a bookmark.
   */
  getResumableBookmark: (profileId: string, storyId: string) => Bookmark | undefined;
  /** The reader calls this on every scene change; only scene 1 and later is written. */
  setBookmark: (profileId: string, storyId: string, at: { level: StoryLevel; sceneIndex: number }) => void;
  /** Results (story finished) and Start over call this. */
  clearBookmark: (profileId: string, storyId: string) => void;
  /** Profile removal: drop that profile's bookmarks and their stored key. */
  forgetProfile: (profileId: string) => void;
}

/** One storage read per profile at a time: callers that overlap share it. */
const inFlight = new Map<string, Promise<void>>();
/** Bumped when a profile is forgotten, so a read still in flight for it lands nowhere. */
const generation = new Map<string, number>();

function without(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}

/** The (story, level) pairs this profile has finished, from its progress snapshot. */
function finishedFor(profileId: string): FinishedCheck {
  return finishedStoryLevels(questsAll, useProgressStore.getState().byProfile[profileId]);
}

/** Bookmarks of stories this profile already finished at that level are dropped on every write (§3.8). */
function prune(profileId: string, file: BookmarkFile): BookmarkFile {
  return pruneBookmarks(file, { isFinished: finishedFor(profileId) });
}

/**
 * Bookmarks are written only for a profile this device still has. A reader or Results screen that
 * outlives its profile's removal (§3.12) must not leave a fresh `story:bookmarks:<id>` behind that
 * nothing would ever remove. Before the profile list has loaded there is nothing to check against.
 */
function isKnownProfile(profileId: string): boolean {
  const { hydrated, profiles } = useProfileStore.getState();
  return !hydrated || profiles.some((p) => p.id === profileId);
}

/** Storage is best effort: a failed write keeps the in-memory bookmark for the session. */
function save(profileId: string, file: BookmarkFile): void {
  writeJson(bookmarksKey(profileId), file).catch(() => undefined);
}

export const useStoryStore = create<State & Actions>((set, get) => {
  /**
   * Save a write. Until the profile's saved file has been read the write stays
   * in memory only (saving it would replace every saved bookmark) and the read
   * starts now; `hydrate` merges the two and saves the result.
   */
  function persist(profileId: string, file: BookmarkFile): void {
    if (get().hydratedFor.has(profileId)) {
      save(profileId, file);
      return;
    }
    set((s) => ({ pendingFor: new Set([...s.pendingFor, profileId]) }));
    void get().hydrate(profileId);
  }

  return {
    byProfile: {},
    hydratedFor: new Set(),
    pendingFor: new Set(),
    clearedFor: {},

    hydrate: (profileId) => {
      if (get().hydratedFor.has(profileId)) return Promise.resolve();
      const running = inFlight.get(profileId);
      if (running) return running;
      const startedAt = generation.get(profileId) ?? 0;
      const load: Promise<void> = (async () => {
        const loaded = parseBookmarkFile(await readJson<unknown>(bookmarksKey(profileId)));
        // The profile was removed while the read was in flight.
        if ((generation.get(profileId) ?? 0) !== startedAt) return;
        const { byProfile, pendingFor, clearedFor } = get();
        const pending = pendingFor.has(profileId);
        const file = pending
          ? prune(profileId, mergeBookmarks(byProfile[profileId] ?? emptyBookmarks(), loaded, clearedFor[profileId]))
          : loaded;
        set((s) => {
          const { [profileId]: _merged, ...cleared } = s.clearedFor;
          return {
            byProfile: { ...s.byProfile, [profileId]: file },
            hydratedFor: new Set([...s.hydratedFor, profileId]),
            pendingFor: without(s.pendingFor, profileId),
            clearedFor: cleared,
          };
        });
        if (pending) save(profileId, file);
      })().finally(() => {
        // A newer read for the same id (started after a removal) owns the slot now.
        if (inFlight.get(profileId) === load) inFlight.delete(profileId);
      });
      inFlight.set(profileId, load);
      return load;
    },

    getBookmark: (profileId, storyId) => get().byProfile[profileId]?.byStory[storyId],

    getResumableBookmark: (profileId, storyId) =>
      unfinishedBookmark(storyId, get().byProfile[profileId]?.byStory[storyId], finishedFor(profileId)),

    setBookmark: (profileId, storyId, at) => {
      if (!isKnownProfile(profileId)) return;
      // Replaying a story already finished at this level: the bookmark would be pruned at once (§3.8),
      // so there is nothing to keep and nothing to write.
      if (finishedFor(profileId)(storyId, at.level)) return;
      const current = get().byProfile[profileId] ?? emptyBookmarks();
      const written = setIn(current, storyId, at, new Date().toISOString());
      if (written === current) return;
      const next = prune(profileId, written);
      set((s) => ({ byProfile: { ...s.byProfile, [profileId]: next } }));
      persist(profileId, next);
    },

    clearBookmark: (profileId, storyId) => {
      if (!isKnownProfile(profileId)) return;
      const { byProfile, hydratedFor } = get();
      const current = byProfile[profileId] ?? emptyBookmarks();
      const next = clearIn(current, storyId);
      if (hydratedFor.has(profileId)) {
        if (next === current) return;
        set((s) => ({ byProfile: { ...s.byProfile, [profileId]: next } }));
        save(profileId, next);
        return;
      }
      // Not loaded yet: the saved file may still hold this story, so remember the clear for the merge.
      set((s) => ({
        byProfile: { ...s.byProfile, [profileId]: next },
        clearedFor: { ...s.clearedFor, [profileId]: new Set([...(s.clearedFor[profileId] ?? []), storyId]) },
      }));
      persist(profileId, next);
    },

    forgetProfile: (profileId) => {
      generation.set(profileId, (generation.get(profileId) ?? 0) + 1);
      inFlight.delete(profileId);
      set((s) => {
        const { [profileId]: _file, ...byProfile } = s.byProfile;
        const { [profileId]: _cleared, ...clearedFor } = s.clearedFor;
        return {
          byProfile,
          hydratedFor: without(s.hydratedFor, profileId),
          pendingFor: without(s.pendingFor, profileId),
          clearedFor,
        };
      });
      removeKey(bookmarksKey(profileId)).catch(() => undefined);
    },
  };
});

// Removing a profile also removes its `story:bookmarks:<profileId>` (§3.12 privacy: story ids only, nothing left behind).
onProfileRemoved((profileId) => useStoryStore.getState().forgetProfile(profileId));
