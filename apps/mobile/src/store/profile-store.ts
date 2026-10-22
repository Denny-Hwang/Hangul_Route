import type { AvatarKind, GuestRecord, LearnerType, Profile } from '@hangul-route/content-schema';
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
import {
  addTombstone,
  holdsLegacyPinHash,
  mergeProfileLists,
  parseTombstones,
  pruneTombstones,
  removeTombstone,
  sameProfileList,
  storedProfileItems,
} from '../logic/profiles/profile-merge';
import { closesSession } from '../logic/profiles/session';
import { changedServerFields, hasFields, serverProfileChanges, type ServerLearnerFields } from '../logic/sync/learner-profile';
import { postProfilesChanged, subscribeProfilesChanged } from '../platform/profiles-channel';
import { readJson, readJsonStrict, writeJson } from '../platform/storage';
import { PROFILES_LOCK, withTabLock } from '../platform/tab-lock';
import { closeGrownUpSession } from './grown-up-session';
import { notifyProfileEdited } from './profile-edits';
import { dropProfileLock, hydrateProfileLocks, lockedIds } from './profile-locks';
import { sweepProfileKeys } from './profile-key-sweep';
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
  /** Restore paths add a profile that already exists elsewhere (keeps its id). */
  adoptProfile: (profile: Profile) => void;
  /**
   * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 5.4 step 2 (row GU-2): saves the guest as an ordinary profile with the
   * guest's id (GU-D2, GU-D9) and the run's start as `createdAt`, appended and made active in one write under the
   * `hr:profiles` lock. In one step of this tab's queue, inside the lock: the stored list is read strictly, an id
   * already on it (another tab saved the guest) is refused (`duplicate`), the list is written and awaited, and read
   * back (`confirmed`). A failed read or write changes nothing (`failed`). The name and the other fields pass the
   * `createProfile` reducer's validation, unchanged (an invalid one throws). Resolves only once the write is done, so
   * `hr:guest` is deleted after the profile is on disk, never before (section 5.4, with or without Web Locks).
   */
  promoteGuest: (
    record: GuestRecord,
    input: { displayName: string; ageGroup: Profile['ageGroup']; avatar: AvatarKind; learnerType: LearnerType },
  ) => Promise<GuestPromotion>;
}

/**
 * [GU] What `promoteGuest` did (section 5.4). Only `saved` with `confirmed` lets the caller delete `hr:guest`: the
 * profile is then on disk, read back. Any other answer keeps `hr:guest`, so the guest's progress is never left under
 * an id that neither record names (G2, GU-D13); the next boot's hydrate repair settles a profile that did land.
 */
export type GuestPromotion =
  /** The profile was written; `confirmed` when a strict read of `hr:profiles` afterwards holds its id. */
  | { kind: 'saved'; profile: Profile; confirmed: boolean }
  /** The stored list (or this tab) already holds the id: another tab saved the guest first. Nothing was written. */
  | { kind: 'duplicate' }
  /** `hr:profiles` could not be read or written: nothing changed, in memory or on disk. */
  | { kind: 'failed' };

/**
 * [OA] Every id this tab has read or written (the merge does not take back an id removed here). An id another tab
 * tombstoned is forgotten again, so a later re-add of that id (a restore, a Rescue Code) is taken from the stored list.
 */
const seen = new Set<string>();
const remember = (profiles: readonly Profile[]): void => {
  for (const p of profiles) seen.add(p.id);
};
const forget = (ids: readonly string[]): void => {
  for (const id of ids) seen.delete(id);
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
const adding =
  (profile: Profile): ListChange =>
  (list) =>
    list.some((p) => p.id === profile.id) ? list : [...list, profile];
const removing =
  (id: string): ListChange =>
  (list) =>
    list.some((p) => p.id === id) ? list.filter((p) => p.id !== id) : list;

/** [OA] What a list write carries besides its change: a removal's tombstone, or a re-add that lifts one (OA-D13). */
interface ListIds {
  /** A learner removed here: tombstoned in the same write. */
  removedId?: string;
  /** A learner added here again (a restore keeps its id): its tombstone goes in the same write. */
  revivedId?: string;
}

/** [OA] A list change waiting for its write: applied again, in order, to every merge until a write lands. */
interface PendingChange extends ListIds {
  change: ListChange;
}
const pending: PendingChange[] = [];

/**
 * [OA] `setActive` writes only `hr:profiles:active` (OA-D19), so the `lastActiveAt` it stamps is kept here and laid
 * over every merge (a refresh does not take it back) until the next list write stores it.
 */
const touches = new Map<string, string>();
const withTouches: ListChange = (profiles) =>
  touches.size === 0 ? profiles : profiles.map((p) => (touches.has(p.id) ? { ...p, lastActiveAt: touches.get(p.id) as string } : p));

/** The merged list with the changes still waiting applied over it, in order: what this tab shows. */
function withPending(merged: Profile[]): Profile[] {
  let list = merged;
  for (const c of pending) list = c.change(list);
  return withTouches(list);
}

/**
 * Every read and write of `hr:profiles` in this tab runs one after another, so no two steps read the same old copy
 * (native, and browsers without Web Locks, where `withTabLock` does not hold other steps back).
 */
let queue: Promise<unknown> = Promise.resolve();
function enqueue(step: () => Promise<void>): Promise<void> {
  const run = queue.then(step);
  queue = run.catch(() => undefined);
  return run;
}

/** Both stored records, strictly: a failed read throws, so the caller writes nothing over data it could not see. */
async function readStored(): Promise<{ storedRaw: unknown; tombstonesRaw: unknown }> {
  const [storedRaw, tombstonesRaw] = await Promise.all([readJsonStrict<unknown>(PROFILES_KEY), readJsonStrict<unknown>(PROFILE_TOMBSTONES_KEY)]);
  return { storedRaw, tombstonesRaw };
}

/**
 * [OA] OA-D19, CS-16: one list write. `hr:profiles` is read, merged and written inside the `hr:profiles` Web Lock, and
 * every step of this tab runs one after another (`enqueue`). The merge is by id, the stored copy first (another tab's
 * newer write), an id only this tab holds kept, a removal in the tombstone set winning (`mergeProfileLists`); every
 * change waiting here is applied again to it, in order, so a change made here survives another tab's newer copy and
 * a write that did not land. A failed read writes nothing: the changes stay waiting for the next change or the next
 * refresh. The list in memory follows the merge (with any change made meanwhile still over it), and the other tabs
 * are told on `hr-profiles`.
 */
function flushStep(): Promise<void> {
  return withTabLock(PROFILES_LOCK, flushLocked);
}

/** `flushStep`'s body, for a caller already inside the `hr:profiles` lock and the queue (`promoteGuest`). Throws when a read or write fails. */
async function flushLocked(): Promise<void> {
  const changes = pending.slice();
  if (changes.length === 0) return;
  const { storedRaw, tombstonesRaw } = await readStored();
  const now = Date.now();
  const read = parseTombstones(tombstonesRaw);
  let tombstones = pruneTombstones(read, now);
  for (const c of changes) {
    if (c.revivedId !== undefined) tombstones = removeTombstone(tombstones, c.revivedId);
    if (c.removedId !== undefined) tombstones = addTombstone(tombstones, c.removedId, now);
  }
  remember(useProfileStore.getState().profiles);
  let merged = mergeProfileLists({ stored: storedProfileItems<Profile>(storedRaw), local: useProfileStore.getState().profiles, seen, removed: tombstones.ids });
  for (const c of changes) merged = c.change(merged);
  const touched = new Map(touches);
  merged = withTouches(merged);
  if (tombstones !== read) await writeJson(PROFILE_TOMBSTONES_KEY, tombstones);
  await writeJson(PROFILES_KEY, merged);
  pending.splice(0, changes.length);
  for (const [id, at] of touched) if (touches.get(id) === at) touches.delete(id);
  forget(tombstones.ids);
  // [OA] Row OA-5, section 13.2: a removed learner leaves the locks in the same write sequence.
  for (const c of changes) if (c.removedId !== undefined) await dropProfileLock(c.removedId);
  remember(merged);
  followMerged(withPending(merged), tombstones.ids);
  postProfilesChanged();
}

function persistList(change: ListChange = unchanged, ids: ListIds = {}): void {
  pending.push({ change, ...ids });
  quietly(() => enqueue(flushStep));
}

/**
 * [OA] Row OA-5: the learner who becomes active when the active one left the list (a removal here or in another tab)
 * is never a locked one while an unlocked one is left; with every one left locked, the relock at the next launch or
 * return asks the PIN (CS-19).
 */
function unlockedFallback(profiles: readonly Profile[], fallback: string | null): string | null {
  if (fallback === null) return null;
  const locked = new Set(lockedIds(profiles));
  if (!locked.has(fallback)) return fallback;
  return profiles.find((p) => !locked.has(p.id))?.id ?? fallback;
}

/** [OA] Row OA-7a: told when another tab removed the learner active here (`bindRemovedElsewhere`, App.tsx). */
type ActiveRemovedListener = (input: { learnersLeft: number }) => void;
const activeRemovedListeners = new Set<ActiveRemovedListener>();

/**
 * [OA] Row OA-7a (CS-16, CS-19): another tab removed the learner active in this tab. The listener (bound once by the
 * learner app) opens the chooser, or Welcome when no learner is left, so nobody keeps playing as the learner who took
 * over. Returns the unsubscribe.
 */
export function onActiveRemovedElsewhere(listener: ActiveRemovedListener): () => void {
  activeRemovedListeners.add(listener);
  return () => {
    activeRemovedListeners.delete(listener);
  };
}

/**
 * The list in memory after a merge or a refresh. The active profile stays unless it is gone; when another tab removed
 * it, the change of learner takes the same path as a pick (OA-D5b (1), CS-15): the session clock restarts, the
 * active key is written and the grown-up session ends. [OA] Row OA-5: the learner who takes over is never a locked one
 * while an unlocked one is left. [OA] Row OA-7a (CS-20): a learner this tab held that another tab removed (its id in
 * the tombstones `removed`) is announced here too (`notifyProfileRemoved`), so this tab's stores drop it and write
 * nothing back for it; when it was the active one, the chooser opens (`onActiveRemovedElsewhere`).
 */
function followMerged(merged: Profile[], removed: readonly string[] = []): void {
  const { profiles, activeId } = useProfileStore.getState();
  const tombstoned = new Set(removed);
  const gone = profiles.filter((p) => tombstoned.has(p.id) && !merged.some((m) => m.id === p.id)).map((p) => p.id);
  const keep = activeId !== null && merged.some((p) => p.id === activeId);
  const nextActive = keep ? activeId : unlockedFallback(merged, merged[0]?.id ?? null);
  if (nextActive === activeId) {
    if (!sameProfileList(profiles, merged)) useProfileStore.setState({ profiles: merged });
  } else {
    useProfileStore.setState({ profiles: merged, activeId: nextActive, activeSince: Date.now() });
    persistActive(nextActive);
    if (closesSession(activeId, nextActive)) closeGrownUpSession('switch');
  }
  for (const id of gone) notifyProfileRemoved(id);
  if (activeId !== null && gone.includes(activeId)) {
    const learnersLeft = merged.filter((p) => p.role === 'learner').length;
    for (const listener of activeRemovedListeners) {
      try {
        listener({ learnersLeft });
      } catch {
        // The next listener still hears it.
      }
    }
  }
}

function persist(set: ProfileSet, before: ProfileSet, change?: ListChange, ids?: ListIds): void {
  persistList(change, ids);
  if (set.activeId !== before.activeId) persistActive(set.activeId);
}

/** [OA] How `commitSet` writes: the list change replayed over the merge (with its ids), or the active key only. */
interface CommitOptions extends ListIds {
  now?: number;
  change?: ListChange;
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
    persist(next, before, options.change, { removedId: options.removedId, revivedId: options.revivedId });
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
    const storedRaw = await readJson<unknown>(PROFILES_KEY);
    // [OA] Row OA-10 (section 13.1): a legacy per-profile `parentPinHash` is dropped here and written off the device.
    const stored = storedProfileItems<Profile>(storedRaw);
    const activeId = await readJson<string | null>(ACTIVE_KEY);
    // [OA] OA-D19: a learner removed in another tab (an older bundle may have written it back) stays removed.
    const removed = new Set(parseTombstones(await readJson<unknown>(PROFILE_TOMBSTONES_KEY)).ids);
    const profiles = removed.size === 0 ? stored : stored.filter((p) => !removed.has(p.id));
    remember(profiles);
    // [OA] Row OA-7a (CS-20): what a removed learner left behind (a delete that failed, a key an older bundle wrote
    // back) goes at launch. A learner restored since is no longer tombstoned, so its keys stay.
    if (removed.size > 0) quietly(() => sweepProfileKeys([...removed].filter((id) => !profiles.some((p) => p.id === id))));
    // An active id that is no longer in the list (removed in another tab) falls back as `followMerged` does.
    const active = activeId === null || activeId === undefined ? null : profiles.some((p) => p.id === activeId) ? activeId : (profiles[0]?.id ?? null);
    set({ profiles, activeId: active, hydrated: true, activeSince: Date.now() });
    if (holdsLegacyPinHash(storedRaw)) persistList();
  },

  refresh: () => {
    // A change whose write did not land (a failed read) is written now, with the list it reads.
    if (pending.length > 0) return enqueue(flushStep);
    return enqueue(async () => {
      let read: { storedRaw: unknown; tombstonesRaw: unknown };
      try {
        read = await readStored();
      } catch {
        return;
      }
      if (!Array.isArray(read.storedRaw)) return;
      const removed = parseTombstones(read.tombstonesRaw).ids;
      const merged = mergeProfileLists({ stored: storedProfileItems<Profile>(read.storedRaw), local: get().profiles, seen, removed });
      forget(removed);
      remember(merged);
      // A change made here while the read ran stays over it (its own write is queued after this step).
      followMerged(withPending(merged), removed);
    });
  },

  createProfile: (input) => {
    const { profiles, activeId } = get();
    const result = createProfileReducer({ profiles, activeId }, input, clock);
    commitSet(set, { profiles, activeId }, result.set, { change: adding(result.created), revivedId: result.created.id });
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
    const next = setActiveProfile({ profiles, activeId }, id, now);
    // [OA] OA-D5b (1): every change of learner, from any surface, ends the grown-up session (always on, CS-15).
    commitSet(set, { profiles, activeId }, next, { now, activeOnly: true });
    // Its `lastActiveAt` is stored with the next list write, and kept over every merge until then.
    const stamped = next.profiles.find((p) => p.id === next.activeId)?.lastActiveAt;
    if (next.activeId !== null && typeof stamped === 'string') touches.set(next.activeId, stamped);
  },

  remove: (id) => {
    const { profiles, activeId } = get();
    const next = removeProfileReducer({ profiles, activeId }, id);
    const guarded = next.activeId === activeId ? next : { ...next, activeId: unlockedFallback(next.profiles, next.activeId) };
    commitSet(set, { profiles, activeId }, guarded, { change: removing(id), removedId: id });
    notifyProfileRemoved(id);
  },

  adoptProfile: (profile) => {
    const { profiles, activeId } = get();
    if (profiles.some((p) => p.id === profile.id)) return;
    // [OA] OA-D13: a learner restored or claimed again within 30 days of a removal keeps its id; its tombstone goes.
    commitSet(set, { profiles, activeId }, { profiles: [...profiles, profile], activeId: activeId ?? profile.id }, { change: adding(profile), revivedId: profile.id });
  },

  promoteGuest: async (record, input) => {
    let outcome = { kind: 'failed' } as GuestPromotion;
    // One step in this tab's queue and inside the `hr:profiles` lock: the duplicate check, the write and its read back.
    await enqueue(() =>
      withTabLock(PROFILES_LOCK, async () => {
        let storedRaw: unknown;
        try {
          ({ storedRaw } = await readStored());
        } catch {
          return;
        }
        const { profiles, activeId } = get();
        // A guest another tab saved is already a profile in the stored list.
        if (profiles.some((p) => p.id === record.id) || storedProfileItems<Profile>(storedRaw).some((p) => p.id === record.id)) {
          outcome = { kind: 'duplicate' };
          return;
        }
        const startedAt = Date.parse(record.startedAt);
        const now = Date.now();
        const fixed: Clock = { now: () => (Number.isFinite(startedAt) ? startedAt : now), nextId: () => record.id.slice('profile:'.length) };
        // The id is the guest's (`profile:` and the same suffix); the reducer's validation is unchanged (it may throw).
        const result = createProfileReducer({ profiles, activeId }, input, fixed);
        // Made active now: `lastActiveAt` is the save, `createdAt` the run's start.
        const created: Profile = { ...result.created, lastActiveAt: new Date(now).toISOString() };
        const next = { profiles: [...profiles, created], activeId: created.id };
        const changed = closesSession(activeId, next.activeId);
        set(changed ? { ...next, activeSince: now } : next);
        // `adding` keeps a copy another tab stored meanwhile: never two profiles with one id.
        const entry: PendingChange = { change: adding(created), revivedId: created.id };
        pending.push(entry);
        try {
          await flushLocked();
        } catch {
          // The write did not land: the profile goes from memory again and nothing waits to write it.
          const at = pending.indexOf(entry);
          if (at >= 0) pending.splice(at, 1);
          const current = get();
          set({ profiles: current.profiles.filter((p) => p.id !== created.id), activeId: current.activeId === created.id ? activeId : current.activeId });
          return;
        }
        persistActive(created.id);
        if (changed) closeGrownUpSession('switch');
        let confirmed = false;
        try {
          confirmed = storedProfileItems<Profile>(await readJsonStrict<unknown>(PROFILES_KEY)).some((p) => p.id === created.id);
        } catch {
          confirmed = false;
        }
        outcome = { kind: 'saved', profile: created, confirmed };
      }),
    );
    // This tab shows the profile another tab saved.
    if (outcome.kind === 'duplicate') await get().refresh().catch(() => undefined);
    return outcome;
  },
}));

export function activeProfileSelector(state: State): Profile | null {
  return activeProfile(state);
}

/**
 * [OA] OA-D19: another tab changed the profile list or the locks (`hr-profiles`), or this page is back in front: read
 * them again, so a learner added there shows here, a removed one goes and a lock set there holds here. Bound once by App.tsx; returns the unsubscribe.
 */
export function followProfileChanges(): () => void {
  return subscribeProfilesChanged(() => {
    if (!useProfileStore.getState().hydrated) return;
    useProfileStore.getState().refresh().catch(() => undefined);
    // [OA] Row OA-5: a lock changed in another tab shows here too (and a failed read is tried again).
    void hydrateProfileLocks();
  });
}
