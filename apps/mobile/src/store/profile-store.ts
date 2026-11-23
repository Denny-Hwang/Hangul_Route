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
  rebuiltTombstones,
  removeTombstone,
  sameProfileList,
  storedProfileItems,
} from '../logic/profiles/profile-merge';
import { closesSession } from '../logic/profiles/session';
import { listCopySettledAt, listCopyStep, settledMark } from '../logic/profiles/list-copy';
import { changedServerFields, hasFields, serverProfileChanges, type ServerLearnerFields } from '../logic/sync/learner-profile';
import { postProfilesChanged, subscribeProfilesChanged } from '../platform/profiles-channel';
import { listKeys, removeKey, writeJson } from '../platform/storage';
import { PROFILES_LOCK, withTabLock } from '../platform/tab-lock';
import { durableRead, type DurableRead } from './durable-read';
import { closeGrownUpSession } from './grown-up-session';
import { notifyProfileEdited } from './profile-edits';
import { dropProfileLock, hydrateProfileLocks, lockedIds } from './profile-locks';
import { keyOfProfile, sweepProfileKeys } from './profile-key-sweep';
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
/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.1: where the raw bytes of a profile list that does not parse are kept
 * (first copy kept, never overwritten), named as AU-3's `progress-corrupt:<id>`.
 */
export const PROFILES_CORRUPT_KEY = 'profiles-corrupt';
/**
 * [DP] Section 3.6 (row DP-1d): when the kept copy's damage settled (`{ v: 1, at }`, `logic/profiles/list-copy.ts`):
 * the list read again, or a grown-up recovery replaced it. The copy goes 30 days later.
 */
export const PROFILES_COPY_SETTLED_KEY = 'profiles-corrupt:settled';
/**
 * [DP] Owner decision OD-DP5 (row DP-1e): where the raw bytes of a tombstone record that does not parse are kept (first
 * copy kept, never overwritten) before the record is rebuilt from the device. Ids only, never a name, so it is kept.
 */
export const TOMBSTONES_CORRUPT_KEY = 'tombstones-corrupt';

interface State extends ProfileSet {
  hydrated: boolean;
  /**
   * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.3: the profile list could not be read at `hydrate` (`read`: the read
   * threw twice; `parse`: the bytes do not parse). `hydrated` stays false and nothing writes `hr:profiles`,
   * `hr:profiles:active` or the tombstones until a `hydrate` reads it. `null` once a read worked.
   */
  loadFailed: 'read' | 'parse' | null;
  /**
   * [DP] Section 3.1: with `loadFailed` `parse`, whether this read kept the damaged bytes at `profiles-corrupt`
   * (`durableRead`'s `kept`); the screen offers the grown-up's way out only then (section 3.5). False otherwise.
   */
  listCopyKept: boolean;
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
    /**
     * [GU] Row GU-5 (section 9.2): `keepActive` is **Keep as a learner** from People on this device: the active learner
     * stays active (the new learner is not switched to), so the grown-up session that asked for it stays open and the
     * grown-up returns to the Grown-up area. A device with no active learner still makes the new one active, and the
     * grown-up session stays open then too (no learner was in front to hand it to; the grown-up is still in the area).
     */
    options?: { keepActive?: boolean },
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

/** [DP] Section 3.3: while the list could not be read, no profile record is written. */
function listUnread(): boolean {
  return useProfileStore.getState().loadFailed !== null;
}

function persistActive(activeId: string | null): void {
  if (listUnread()) return;
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

/** [DP] Section 3.1: what a profile record read under the contract held; `null` when missing. */
const valueOf = (read: DurableRead): unknown => (read.kind === 'value' ? read.value : null);

/**
 * Both stored records, under the read contract (`durableRead`, AMENDMENTS-DURABLE-PROGRESS section 3.1): a failed
 * read throws, and so do bytes that do not parse (the list's are kept at `profiles-corrupt`), so the caller writes
 * nothing over data it could not see and never merges damaged bytes as an empty list.
 */
async function readStored(): Promise<{ storedRaw: unknown; tombstonesRaw: unknown }> {
  const [list, tombstones] = await Promise.all([durableRead(PROFILES_KEY, PROFILES_CORRUPT_KEY), durableRead(PROFILE_TOMBSTONES_KEY, null)]);
  if (list.kind === 'failed' || tombstones.kind === 'failed') throw new Error('profile records could not be read');
  return { storedRaw: valueOf(list), tombstonesRaw: valueOf(tombstones) };
}

/** [DP] Section 3.1: a key that could not be read (the read threw twice); bytes that do not parse were still read. */
const unreadable = (read: DurableRead): boolean => read.kind === 'failed' && read.cause === 'read';

/** [DP] Runs `step` in this tab's queue and inside the `hr:profiles` lock (as every list write), and answers its result; `false` when it could not run. */
async function locked(step: () => Promise<boolean>): Promise<boolean> {
  let answer = false;
  await enqueue(() =>
    withTabLock(PROFILES_LOCK, async () => {
      answer = await step();
    }),
  ).catch(() => undefined);
  return answer;
}

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.6 (row DP-1d): the kept copy of a damaged list goes, then its mark (the
 * copy first: a stop in between leaves the mark, and the next step does the same again). Rejects when a removal fails.
 */
async function removeListCopy(): Promise<void> {
  await removeKey(PROFILES_CORRUPT_KEY);
  await removeKey(PROFILES_COPY_SETTLED_KEY);
}

/**
 * [DP] Section 3.6 (row DP-1d), the grown-up's Start fresh only, inside the `hr:profiles` lock: whether the list's
 * bytes do not parse **now** and `profiles-corrupt` holds those very bytes (`keepRawCopy` answers `kept` only once the
 * copy key holds a copy). The list is read first: a list that reads (or cannot be read) answers false and the copy is
 * never touched. A copy whose damage has settled (its mark is written: the list read again, or a recovery replaced it,
 * since the copy was made) is of an earlier damage: it gives way, at this confirmed Start fresh only, so the copy is of
 * the bytes Start fresh replaces (they are kept as the first copy of this damage, never overwritten). A mark that
 * cannot be read, or a removal or a copy that fails: false (nothing is written over the list). Never rejects.
 */
async function keepCurrentListCopy(): Promise<boolean> {
  const list = await durableRead(PROFILES_KEY, PROFILES_CORRUPT_KEY);
  if (list.kind !== 'failed' || list.cause !== 'parse') return false;
  const mark = await durableRead(PROFILES_COPY_SETTLED_KEY, null);
  if (unreadable(mark)) return false;
  if (mark.kind === 'missing') return list.kept;
  try {
    await removeListCopy();
  } catch {
    return false;
  }
  const again = await durableRead(PROFILES_KEY, PROFILES_CORRUPT_KEY);
  return again.kind === 'failed' && again.cause === 'parse' && again.kept;
}

/**
 * [DP] Section 3.6: removes the kept copy of a damaged list and its mark, inside the `hr:profiles` lock (so it never
 * lands inside another tab's Start fresh). Run by Remove from this device of any learner: the copy may hold their name.
 * Never rejects: a copy whose removal failed stays until the next removal or its 30 days.
 */
export async function dropListCopy(): Promise<void> {
  await locked(async () => {
    await removeListCopy().catch(() => undefined);
    return true;
  });
}

/**
 * [DP] Section 3.6: whether a copy of a damaged list is kept on this device (or its key cannot be read). While it is,
 * an id the list does not name may still be a learner of the damaged list (after a Start fresh): the guest sweep keeps
 * such an id's keys (`guest-sweep.ts`). Never rejects.
 */
export async function holdsListCopy(): Promise<boolean> {
  return (await durableRead(PROFILES_CORRUPT_KEY, null)).kind !== 'missing';
}

/**
 * [DP] Section 3.6: after a `hydrate` that read the list, inside the `hr:profiles` lock (`locked`), never awaited by the
 * boot. A copy still kept, while the list still reads, is marked settled now (its 30 days start: the list reads again,
 * or a recovery just replaced it), kept while they run, then removed with its mark (`logic/profiles/list-copy.ts`). A
 * copy, a list or a mark that cannot be read is left alone.
 */
async function settleListCopy(now: number): Promise<boolean> {
  const copy = await durableRead(PROFILES_CORRUPT_KEY, null);
  if (copy.kind === 'missing' || unreadable(copy)) return false;
  // A list damaged again meanwhile (another tab) is not settled: its copy is the live one.
  if ((await durableRead(PROFILES_KEY, null)).kind === 'failed') return false;
  const mark = await durableRead(PROFILES_COPY_SETTLED_KEY, null);
  if (unreadable(mark)) return false;
  const step = listCopyStep(listCopySettledAt(valueOf(mark)), now);
  if (step === 'mark') await writeJson(PROFILES_COPY_SETTLED_KEY, settledMark(now));
  else if (step === 'drop') await removeListCopy();
  return step !== 'wait';
}

/**
 * [DP] Section 3.6: the step after a `hydrate` that read the list. The copy key is read first, outside the lock, so a
 * device with no copy (nearly every launch) never queues or waits on the `hr:profiles` lock; with one, the step runs
 * inside it. Never rejects.
 */
async function settleKeptListCopy(now: number): Promise<void> {
  if (await holdsListCopy()) await locked(() => settleListCopy(now));
}

/**
 * [DP] Sections 3.1 and 3.3: the three profile records, each under the read contract. Damaged list bytes are kept at
 * `profiles-corrupt`, damaged tombstone bytes at `tombstones-corrupt` (OD-DP5); the active key keeps no copy.
 */
function readProfileRecords(): Promise<[list: DurableRead, active: DurableRead, tombstones: DurableRead]> {
  return Promise.all([
    durableRead(PROFILES_KEY, PROFILES_CORRUPT_KEY),
    durableRead(ACTIVE_KEY, null),
    durableRead(PROFILE_TOMBSTONES_KEY, TOMBSTONES_CORRUPT_KEY),
  ]);
}

/**
 * [DP] Owner decision OD-DP5 (row DP-1e): how long a `hydrate` waits for the `hr:profiles` lock before it rebuilds
 * damaged tombstones (another tab may hold it, or a suspended tab may never give it back; as `GUEST_LOCK_WAIT_MS`).
 * Past it this `hydrate` holds list writes as for a read that failed; the rebuild still runs once the lock is granted.
 */
export const TOMBSTONE_LOCK_WAIT_MS = 2_000;

/** `step`'s answer, or `fallback` once `ms` have passed (the step runs on; it re-reads before it writes). */
async function withinWait<T>(step: Promise<T>, fallback: T, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([step, late]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * [DP] Owner decision OD-DP5 (row DP-1e): tombstone bytes that do not parse never parse again, so holding list writes
 * until they read (section 3.3) would hold them for good. In this tab's queue and inside the `hr:profiles` lock (as every
 * list write), on what is stored then: the list must read (missing, or a list), the active key must read, and the
 * tombstones must still not parse with their raw bytes kept at `tombstones-corrupt` (`keepRawCopy` answers `kept` only
 * once the copy key holds a copy, so the copy is on disk before anything is written over them). The set is rebuilt from
 * the device (`rebuiltTombstones`): a learner of the stored list with nothing left on the device is tombstoned now; a
 * learner with any per-profile key (`keyOfProfile`) is kept, and so is the learner the active key names (a removal
 * always moves the active key away, so that learner is in use, possibly in another tab, and not yet saved). It is
 * written once, and the other tabs are told (`hr-profiles`), so their held list writes land. Answers the ids it
 * tombstoned (empty when the tombstones read now: another tab wrote them), so the caller reads every record again;
 * `null` when nothing was written and nothing changed: a record that does not read, the copy not kept, the keys not
 * listable, no learner of the list left (fail closed, OD-DP8), or the write failed. Never rejects.
 */
async function rebuildDamagedTombstones(now: number): Promise<ReadonlySet<string> | null> {
  let rebuilt = null as ReadonlySet<string> | null;
  let wrote = false;
  await locked(async () => {
    const [list, active, tombstones] = await readProfileRecords();
    const listValue = valueOf(list);
    if (list.kind === 'failed' || active.kind === 'failed' || (listValue !== null && !Array.isArray(listValue))) return false;
    if (tombstones.kind !== 'failed') {
      // Another tab wrote them meanwhile: they are read as they are, never written over.
      rebuilt = new Set<string>();
      return true;
    }
    if (tombstones.cause !== 'parse' || !tombstones.kept) return false;
    const keys = await listKeys();
    const activeId = valueOf(active);
    const kept = (id: string): boolean => id === activeId || keys.some((key) => keyOfProfile(key, id));
    const record = rebuiltTombstones(storedProfileItems<Profile>(listValue), kept, now);
    if (record === null) return false;
    await writeJson(PROFILE_TOMBSTONES_KEY, record);
    wrote = true;
    rebuilt = new Set(record.ids);
    return true;
  });
  if (wrote) postProfilesChanged();
  return rebuilt;
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
  // [DP] Section 3.3: while the list could not be read nothing is written, and nothing waits to be: the list in
  // memory was never read, so the next `hydrate` that reads the list replaces it.
  if (listUnread()) return;
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
  loadFailed: null,
  listCopyKept: false,
  activeSince: Date.now(),

  hydrate: async () => {
    // [DP] AMENDMENTS-DURABLE-PROGRESS sections 3.1 and 3.3: each record is read under the read contract.
    let [list, activeRead, tombstonesRead] = await readProfileRecords();
    // [DP] OD-DP5 (row DP-1e): tombstone bytes that do not parse, once kept, are rebuilt from the device and written, then
    // every record is read again (at most once per hydrate: a rebuild that did not land holds, below).
    let rebuilt: ReadonlySet<string> = new Set();
    if (list.kind !== 'failed' && tombstonesRead.kind === 'failed' && tombstonesRead.cause === 'parse' && tombstonesRead.kept) {
      // The boot waits on the lock for a while only (a lock never given back holds this hydrate as a read failure).
      const written = await withinWait(rebuildDamagedTombstones(Date.now()), null, TOMBSTONE_LOCK_WAIT_MS);
      if (written !== null) {
        rebuilt = written;
        [list, activeRead, tombstonesRead] = await readProfileRecords();
      }
    }
    // A list that could not be read never shows first run: not hydrated, and nothing writes the profile records.
    // A later `hydrate` that fails (Try again) leaves nothing of an earlier read in memory either.
    const unread = (cause: 'read' | 'parse', kept = false): void =>
      set({ loadFailed: cause, listCopyKept: kept, hydrated: false, profiles: [], activeId: null });
    if (list.kind === 'failed') {
      // [DP] Section 3.6 (row DP-1d): a grown-up's way out is offered only with a copy kept and its mark readable. The
      // boot only reads: a copy of an earlier, settled damage gives way at a confirmed Start fresh, never here.
      unread(list.cause, list.cause === 'parse' && list.kept && !unreadable(await durableRead(PROFILES_COPY_SETTLED_KEY, null)));
      return;
    }
    const storedRaw = valueOf(list);
    // [OA] Row OA-10 (section 13.1): a legacy per-profile `parentPinHash` is dropped here and written off the device.
    const stored = storedProfileItems<Profile>(storedRaw);
    let profiles: Profile[];
    /** The active key cannot pick the active learner: failed, or it names a learner hidden below. */
    let activeUnknown = activeRead.kind === 'failed';
    /** [DP] Row DP-1e: the stored list holds a removed learner: a list write drops it. */
    let rewrite = false;
    if (tombstonesRead.kind === 'failed') {
      // [DP] Section 3.3: the tombstones failed alone (a read that threw, or damaged bytes OD-DP5 could not rebuild: no
      // copy kept, or the rebuild failed closed). A learner whose per-profile keys are already all gone (it was
      // swept) is not shown, the sweep is skipped, and every list write reads the tombstones again (`readStored`), so
      // list writes are held until a tombstone read works (the next hydrate reads, or rebuilds, them again). Any
      // per-profile key counts (`keyOfProfile`, the sweep's own test), not only `progress:<id>`, so fewer kept
      // learners are hidden. Fail closed (the list is treated as unread) when a removed learner cannot be told from a
      // kept one: the keys cannot be listed, or no learner would be left of a list that holds some (that would show
      // first run; learners are counted, as the chooser counts them, OD-DP8).
      let keys: string[];
      try {
        keys = await listKeys();
      } catch {
        unread('read');
        return;
      }
      profiles = stored.filter((p) => keys.some((key) => keyOfProfile(key, p.id)));
      if (stored.some((p) => p.role === 'learner') && !profiles.some((p) => p.role === 'learner')) {
        unread('read');
        return;
      }
      // A stored active learner who is hidden here is never replaced by a sibling: the chooser decides (as below).
      const storedActive = valueOf(activeRead);
      if (stored.some((p) => p.id === storedActive) && !profiles.some((p) => p.id === storedActive)) activeUnknown = true;
    } else {
      // [OA] OA-D19: a learner removed in another tab (an older bundle may have written it back) stays removed.
      const removed = new Set(parseTombstones(valueOf(tombstonesRead)).ids);
      profiles = removed.size === 0 ? stored : stored.filter((p) => !removed.has(p.id));
      // [DP] OD-DP5 (row DP-1e): a removed learner still in the stored list (written back) is written out of it now, by
      // a list write that merges with the tombstones as they are, so it never comes back once they are pruned.
      rewrite = profiles.length < stored.length;
      // [OA] Row OA-7a (CS-20): what a removed learner left behind (a delete that failed, a key an older bundle wrote
      // back) goes at launch. A learner restored since is no longer tombstoned, so its keys stay. [DP] Row DP-1e: a
      // learner this hydrate's rebuild just tombstoned had no key when the keys were listed, so a key it has now was
      // written since (by a tab where it is in use): it is not swept here.
      const sweep = [...removed].filter((id) => !profiles.some((p) => p.id === id) && !rebuilt.has(id));
      if (sweep.length > 0) quietly(() => sweepProfileKeys(sweep));
    }
    remember(profiles);
    let active: string | null;
    if (activeUnknown) {
      // [DP] Section 3.3: the active key failed alone. One learner is that learner; with two or more nobody is active,
      // so the chooser opens (OA-D6), never a sibling's record. The pick writes the active key again. Learners are
      // counted, as the chooser counts them (a legacy grown-up row is not a second learner).
      const learners = profiles.filter((p) => p.role === 'learner');
      active = learners.length === 1 ? (learners[0]?.id ?? null) : null;
    } else {
      const activeId = valueOf(activeRead);
      // An active id that is no longer in the list (removed in another tab) falls back as `followMerged` does.
      active = activeId === null ? null : (profiles.find((p) => p.id === activeId)?.id ?? profiles[0]?.id ?? null);
    }
    set({ profiles, activeId: active, hydrated: true, loadFailed: null, listCopyKept: false, activeSince: Date.now() });
    if (holdsLegacyPinHash(storedRaw) || rewrite) persistList();
    // [DP] Section 3.6 (row DP-1d): the list reads, so a damaged copy kept earlier has settled: its 30 days run.
    void settleKeptListCopy(Date.now());
  },

  refresh: () => {
    // [DP] Section 3.3: nothing is read over, or written to, a list that could not be read at launch.
    if (listUnread()) return Promise.resolve();
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
    // [DP] Section 3.3: no removal (and no announcement that drops a learner's data in other stores) over a list that
    // could not be read.
    if (listUnread()) return;
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

  promoteGuest: async (record, input, options = {}) => {
    let outcome = { kind: 'failed' } as GuestPromotion;
    // One step in this tab's queue and inside the `hr:profiles` lock: the duplicate check, the write and its read back.
    await enqueue(() =>
      withTabLock(PROFILES_LOCK, async () => {
        // [DP] Section 3.3: no profile is saved over a list that could not be read (`failed`; `hr:guest` stays).
        if (listUnread()) return;
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
        const next = { profiles: [...profiles, created], activeId: options.keepActive === true && activeId !== null ? activeId : created.id };
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
        persistActive(next.activeId);
        // [GU] Row GU-5 review: the owner's keep never closes the grown-up session that asked for it.
        if (changed && options.keepActive !== true) closeGrownUpSession('switch');
        // [DP] Section 3.1: the confirm read is under the read contract too (damaged bytes are not a list: not confirmed).
        const back = await durableRead(PROFILES_KEY, PROFILES_CORRUPT_KEY);
        const confirmed = storedProfileItems<Profile>(valueOf(back)).some((p) => p.id === created.id);
        outcome = { kind: 'saved', profile: created, confirmed };
      }),
    );
    // This tab shows the profile another tab saved.
    if (outcome.kind === 'duplicate') await get().refresh().catch(() => undefined);
    return outcome;
  },
}));

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.6 (row DP-1d): **Start fresh on this device**, the RecoverRecord sheet's
 * action after the grown-up gate, and the one write past the section 3.3 guards. In this tab's queue and inside the
 * `hr:profiles` lock: only while the list is held as damaged (`loadFailed: 'parse'`), and only when a read made now
 * still finds bytes that do not parse and `profiles-corrupt` holds them (`keepCurrentListCopy`; `keepRawCopy` answers
 * `kept` only once the copy key holds a copy), the empty list is written, once. The active key, the tombstones and
 * every per-profile key are left as they are: learners come back through Restore, and their records under
 * `progress:<id>` are still on the device. Then the list is read again (`hydrate`), which clears `loadFailed` and starts
 * the copy's 30 days; the caller (BootGate) reruns the other stores' reads and the post-hydrate chain. A list that
 * reads meanwhile (another tab wrote one) is never written over. Resolves whether the list was written and reads now;
 * never rejects.
 */
export async function recoverProfileList(): Promise<boolean> {
  const wrote = await locked(async () => {
    if (useProfileStore.getState().loadFailed !== 'parse') return false;
    if (!(await keepCurrentListCopy())) return false;
    await writeJson(PROFILES_KEY, []);
    return true;
  });
  if (!wrote) return false;
  await useProfileStore.getState().hydrate();
  postProfilesChanged();
  return useProfileStore.getState().loadFailed === null;
}

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
