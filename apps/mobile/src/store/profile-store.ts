import type { AvatarKind, LearnerType, Profile } from '@hangul-route/content-schema';
import { create } from 'zustand';
import {
  activeProfile,
  createProfile as createProfileReducer,
  removeProfile as removeProfileReducer,
  setActiveProfile,
  updateProfile as updateProfileReducer,
  type Clock,
  type CreateProfileInput,
  type ProfilePatch,
  type ProfileSet,
} from '../logic/profiles/profile-model';
import { addTombstone, mergeProfileLists, parseTombstones, pruneTombstones, sameProfileList } from '../logic/profiles/profile-merge';
import { closesSession } from '../logic/profiles/session';
import { changedServerFields, hasFields, serverProfileChanges, type ServerLearnerFields } from '../logic/sync/learner-profile';
import { postProfilesChanged, subscribeProfilesChanged } from '../platform/profiles-channel';
import { readJson, writeJson } from '../platform/storage';
import { PROFILES_LOCK, withTabLock } from '../platform/tab-lock';
import { closeGrownUpSession } from './grown-up-session';
import { notifyProfileEdited } from './profile-edits';
import { notifyProfileRemoved } from './profile-removal';

/**
 * Persistence shell over the pure reducers in `logic/profiles/profile-model`
 * (F-PROF-001). Decisions — validation, id shape, active-profile handling —
 * live in the logic layer; this module only holds and persists the result.
 */

/** The profile list (`hr:profiles`); the device gate marker writer reads it raw to confirm a `none` marker. */
export const PROFILES_KEY = 'profiles';
const ACTIVE_KEY = 'profiles:active';
/** [OA] OA-D19: the removed ids, so no tab brings a removed learner back (`logic/profiles/profile-merge.ts`). */
export const PROFILE_TOMBSTONES_KEY = 'profiles:tombstones';

interface State extends ProfileSet {
  hydrated: boolean;
  /**
   * [OA] When the active learner's session on this device began (epoch ms, in memory only): the app start, then
   * every change of learner. `profile.switch` buckets the minutes since (`minutesIn`, G1).
   */
  activeSince: number;
}

interface Actions {
  hydrate: () => Promise<void>;
  /** [OA] OA-D19: reads the list another tab wrote (on `hr-profiles`, and when the page is back in front). */
  refresh: () => Promise<void>;
  createProfile: (input: {
    displayName: string;
    ageGroup: Profile['ageGroup'];
    avatar: AvatarKind;
    role?: CreateProfileInput['role'];
    learnerType?: LearnerType;
  }) => Profile;
  /**
   * Changes name, level, avatar or who-is-learning; throws on an invalid value, ignores an unknown id. A change to a
   * learner's name, level or avatar is announced (`profile-edits`) so the sync store sends it to the server.
   */
  updateProfile: (id: string, patch: ProfilePatch) => void;
  /**
   * Takes the server's name, level and avatar for a learner (inbox pull, restore). Only values that differ and pass
   * the local rules apply; nothing is announced, so the change is never sent back. Returns whether anything changed.
   */
  applyServerProfile: (id: string, server: ServerLearnerFields) => boolean;
  setActive: (id: string) => void;
  remove: (id: string) => void;
  setParentPin: (pinHash: string) => void;
  /** Restore paths add a profile that already exists elsewhere (keeps its id). */
  adoptProfile: (profile: Profile) => void;
}

/** [OA] Every id this tab has read or written (the merge does not take back an id removed here). */
const seen = new Set<string>();
const remember = (profiles: readonly Profile[]): void => {
  for (const p of profiles) seen.add(p.id);
};

/** A write that never throws, whatever the storage (or a test double) returns. */
function quietly(write: () => unknown): void {
  Promise.resolve()
    .then(write)
    .catch(() => undefined);
}

function persistActive(activeId: string | null): void {
  quietly(() => writeJson(ACTIVE_KEY, activeId));
}

/** A change applied again to the merged list (a patch keeps its effect over another tab's newer copy). */
type ListChange = (profiles: Profile[]) => Profile[];
const unchanged: ListChange = (profiles) => profiles;

/**
 * [OA] OA-D19, CS-16: `hr:profiles` is read, merged and written inside the `hr:profiles` Web Lock, or, without Web
 * Locks, re-read just before the write and merged the same way: by id, the stored copy first (another tab's newer
 * write), an id only this tab holds kept, a removal in the tombstone set winning (`mergeProfileLists`). `change` is
 * applied again to the merged list so a patch made here survives another tab's newer copy. The list in memory follows
 * the merge, and the other tabs are told on `hr-profiles` to read it again. Never throws.
 */
function persistList(change: ListChange = unchanged, removedId?: string): void {
  remember(useProfileStore.getState().profiles);
  quietly(() => withTabLock(PROFILES_LOCK, async () => {
    const [storedRaw, tombstonesRaw] = await Promise.all([readJson<unknown>(PROFILES_KEY), readJson<unknown>(PROFILE_TOMBSTONES_KEY)]);
    const now = Date.now();
    const read = parseTombstones(tombstonesRaw);
    const pruned = pruneTombstones(read, now);
    const tombstones = removedId === undefined ? pruned : addTombstone(pruned, removedId, now);
    const stored = Array.isArray(storedRaw) ? (storedRaw as Profile[]) : [];
    const merged = change(mergeProfileLists({ stored, local: useProfileStore.getState().profiles, seen, removed: tombstones.ids }));
    if (tombstones !== read) await writeJson(PROFILE_TOMBSTONES_KEY, tombstones);
    await writeJson(PROFILES_KEY, merged);
    remember(merged);
    followMerged(merged);
    postProfilesChanged();
  }));
}

/** The list in memory after a merge or a refresh: the active profile stays unless it is gone. */
function followMerged(merged: Profile[]): void {
  const { profiles, activeId } = useProfileStore.getState();
  if (sameProfileList(profiles, merged)) return;
  const keep = activeId !== null && merged.some((p) => p.id === activeId);
  useProfileStore.setState({ profiles: merged, activeId: keep ? activeId : (merged[0]?.id ?? null) });
}

function persist(set: ProfileSet, before: ProfileSet, change?: ListChange, removedId?: string): void {
  persistList(change, removedId);
  if (set.activeId !== before.activeId) persistActive(set.activeId);
}

/** [OA] How `commitSet` writes: the list change replayed over the merge, a removal's tombstone, or the active key only. */
interface CommitOptions {
  now?: number;
  change?: ListChange;
  removedId?: string;
  /** OA-D19: a pick writes only `hr:profiles:active`, so a learner another tab just added is never written over. */
  activeOnly?: boolean;
}

/**
 * [OA] OA-D5b (1), CS-15: every write of a new profile set goes through here. When the active learner changes (a
 * Profile tile, a new learner made active, the active learner removed, a restored learner adopted, any later writer),
 * the session clock restarts and the grown-up session ends, from any surface.
 */
function commitSet(
  set: (partial: Partial<State>) => void,
  before: ProfileSet,
  next: ProfileSet,
  options: CommitOptions = {},
): void {
  const now = options.now ?? Date.now();
  const changed = closesSession(before.activeId, next.activeId);
  set(changed ? { ...next, activeSince: now } : next);
  if (options.activeOnly === true) {
    if (next.activeId !== null) persistActive(next.activeId);
  } else {
    persist(next, before, options.change, options.removedId);
  }
  if (changed) closeGrownUpSession('switch');
}

const clock: Clock = {
  now: () => Date.now(),
  nextId: () => Math.random().toString(36).slice(2, 10),
};

export const useProfileStore = create<State & Actions>((set, get) => ({
  profiles: [],
  activeId: null,
  hydrated: false,
  activeSince: Date.now(),

  hydrate: async () => {
    const stored = (await readJson<Profile[]>(PROFILES_KEY)) ?? [];
    const activeId = await readJson<string | null>(ACTIVE_KEY);
    // [OA] OA-D19: a learner removed in another tab (an older bundle may have written it back) stays removed.
    const removed = new Set(parseTombstones(await readJson<unknown>(PROFILE_TOMBSTONES_KEY)).ids);
    const profiles = removed.size === 0 ? stored : stored.filter((p) => !removed.has(p.id));
    remember(profiles);
    set({ profiles, activeId: activeId ?? null, hydrated: true, activeSince: Date.now() });
  },

  refresh: async () => {
    const storedRaw = await readJson<unknown>(PROFILES_KEY);
    if (!Array.isArray(storedRaw)) return;
    const removed = parseTombstones(await readJson<unknown>(PROFILE_TOMBSTONES_KEY)).ids;
    const merged = mergeProfileLists({ stored: storedRaw as Profile[], local: get().profiles, seen, removed });
    remember(merged);
    followMerged(merged);
  },

  createProfile: (input) => {
    const { profiles, activeId } = get();
    const result = createProfileReducer({ profiles, activeId }, input, clock);
    commitSet(set, { profiles, activeId }, result.set);
    return result.created;
  },

  updateProfile: (id, patch) => {
    const { profiles, activeId } = get();
    const next = updateProfileReducer({ profiles, activeId }, id, patch);
    if (next.profiles === profiles) return;
    set(next);
    persist(next, { profiles, activeId }, (list) => {
      try {
        return updateProfileReducer({ profiles: list, activeId: null }, id, patch).profiles;
      } catch {
        return list;
      }
    });
    const before = profiles.find((p) => p.id === id);
    const after = next.profiles.find((p) => p.id === id);
    if (!before || !after || after.role !== 'learner') return;
    // Only what the server keeps (never who-is-learning, the PIN or consent, F-LEARN-001 L2).
    const changed = changedServerFields(before, after);
    if (hasFields(changed)) notifyProfileEdited(id, changed);
  },

  applyServerProfile: (id, server) => {
    const { profiles, activeId } = get();
    const current = profiles.find((p) => p.id === id);
    if (!current) return false;
    const changes = serverProfileChanges(current, server);
    if (!hasFields(changes)) return false;
    const next = { profiles: profiles.map((p) => (p.id === id ? { ...p, ...changes } : p)), activeId };
    set(next);
    persist(next, { profiles, activeId }, (list) => list.map((p) => (p.id === id ? { ...p, ...changes } : p)));
    return true;
  },

  setActive: (id) => {
    const { profiles, activeId } = get();
    const now = Date.now();
    // [OA] OA-D5b (1): every change of learner, from any surface, ends the grown-up session (always on, CS-15).
    commitSet(set, { profiles, activeId }, setActiveProfile({ profiles, activeId }, id, now), { now, activeOnly: true });
  },

  remove: (id) => {
    const { profiles, activeId } = get();
    commitSet(set, { profiles, activeId }, removeProfileReducer({ profiles, activeId }, id), { removedId: id });
    notifyProfileRemoved(id);
  },

  adoptProfile: (profile) => {
    const { profiles, activeId } = get();
    if (profiles.some((p) => p.id === profile.id)) return;
    commitSet(set, { profiles, activeId }, { profiles: [...profiles, profile], activeId: activeId ?? profile.id });
  },

  setParentPin: (pinHash) => {
    const before = { profiles: get().profiles, activeId: get().activeId };
    const profiles = before.profiles.map((p) => ({ ...p, parentPinHash: pinHash }));
    const next = { profiles, activeId: before.activeId };
    set(next);
    persist(next, before, (list) => list.map((p) => ({ ...p, parentPinHash: pinHash })));
  },
}));

export function activeProfileSelector(state: State): Profile | null {
  return activeProfile(state);
}

/**
 * [OA] OA-D19: another tab changed the profile list (`hr-profiles`), or this page is back in front: read it again, so a
 * learner added there shows here and a removed one goes. Bound once by App.tsx; returns the unsubscribe.
 */
export function followProfileChanges(): () => void {
  return subscribeProfilesChanged(() => {
    if (!useProfileStore.getState().hydrated) return;
    useProfileStore.getState().refresh().catch(() => undefined);
  });
}
