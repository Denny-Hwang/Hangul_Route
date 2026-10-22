import { GUEST_KEY } from '@hangul-route/content-schema';
import { storedGuestAction, storedIdStatus, storedRuleProfiles, type GuestRuleProfile, type StoredGuestAction } from '../logic/guest/guest-model';
import { parseTombstones } from '../logic/profiles/profile-merge';
import { postProfilesChanged } from '../platform/profiles-channel';
import { readJson, readJsonExact, removeKey } from '../platform/storage';
import { PROFILES_LOCK, withTabLock } from '../platform/tab-lock';
import { track } from '../platform/telemetry';
import { hideGuestIdWhile, readStoredGuest, useGuestStore } from './guest-store';
import { sweepProfileKeys } from './profile-key-sweep';
import './profile-keys';
import { notifyProfileRemoved } from './profile-removal';
import { PROFILES_KEY, PROFILE_TOMBSTONES_KEY, useProfileStore } from './profile-store';

/**
 * How long the boot waits for the `hr:profiles` lock before a repair or a sweep (another tab may hold it, or a
 * suspended tab may never give it back). Past it the first screen comes with no guest; the step still runs once the
 * lock is granted.
 */
export const GUEST_LOCK_WAIT_MS = 2_000;

type HydrateResult = StoredGuestAction['kind'] | 'unread';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 5.4 step 4, section 7.2 and GU-D13 (row GU-2): the boot's read of
 * `hr:guest`, after the profile list. Always on, whatever the switches say. `hr:guest` is read first without a lock,
 * so a device with no guest, a live guest or a record that does not parse yet never waits on the `hr:profiles` Web
 * Lock; only a repair or a sweep takes it (at most `GUEST_LOCK_WAIT_MS` before the first screen), and decides again on
 * what is stored then:
 * - a record whose id is already a profile (a save interrupted between the profile write and the delete) is deleted
 *   and the profile kept (the hydrate repair); a record whose id is in neither list stays a guest; a record whose id is
 *   a removed learner's (tombstoned) is deleted, the OA-7a launch sweep having its keys;
 * - a never-saved record past `guestTtlMs` (30 days without play, 7 on a device with learner profiles), or one that has
 *   not parsed for 30 days (at once when it holds no time), is removed through `notifyProfileRemoved(guestId)`, so
 *   every per-profile store forgets the id, then the OA-7a key sweep deletes every stored key of it, then the record
 *   goes and `guest.expired { questDone }` is sent (no profile id). The keys go only when `hr:profiles` and its
 *   tombstones, read again exactly inside the lock, both read and neither holds the id: a failed or damaged read
 *   decides nothing;
 * - a record that does not parse, younger than that, reads as no guest and is kept until a start overwrites it.
 * A repair or a sweep posts `hr-profiles` `changed`, so another tab's run of that record ends. Importing
 * `profile-keys` loads every store that keeps a per-profile key, so each has subscribed to `onProfileRemoved` before
 * a sweep. A storage that cannot be read decides nothing. Never throws.
 */
export async function hydrateGuest(now: number = Date.now(), lockWaitMs: number = GUEST_LOCK_WAIT_MS): Promise<HydrateResult> {
  try {
    const read = await readStoredGuest();
    if (!read.ok) return 'unread';
    const action = storedGuestAction(read.raw, now, useProfileStore.getState().profiles);
    if (action.kind === 'none' || action.kind === 'unreadable') {
      useGuestStore.setState({ record: null, running: false, memoryOnly: false });
      return action.kind;
    }
    if (action.kind === 'keep' && !(await tombstonedLeniently(action.record.id))) {
      useGuestStore.setState({ record: action.record, running: false, memoryOnly: false });
      return 'keep';
    }
    // A repair, a sweep, or a record naming a removed learner: under the lock, on what is stored then.
    useGuestStore.setState({ record: null, running: false, memoryOnly: false });
    return await withinWait(
      withTabLock(PROFILES_LOCK, () => settleStoredGuest(now)),
      lockWaitMs,
    );
  } catch {
    return 'unread';
  } finally {
    useGuestStore.setState({ hydrated: true });
  }
}

/** Whether the tombstones (read leniently: a failed read is none) hold `id`. Only ever sends a record to the locked path. */
async function tombstonedLeniently(id: string): Promise<boolean> {
  return parseTombstones(await readJson<unknown>(PROFILE_TOMBSTONES_KEY)).ids.includes(id);
}

/** `step`'s answer, or `unread` once `ms` have passed (the step goes on; its result is only not waited for). */
function withinWait(step: Promise<HydrateResult>, ms: number): Promise<HydrateResult> {
  return new Promise<HydrateResult>((resolve) => {
    const timer = setTimeout(() => resolve('unread'), ms);
    step.then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      () => {
        clearTimeout(timer);
        resolve('unread');
      },
    );
  });
}

/**
 * Inside the `hr:profiles` lock: `hr:guest`, `hr:profiles` and the tombstones read again exactly, and the record
 * repaired, swept or kept on what they hold. Any read that fails or does not have its shape decides nothing.
 */
async function settleStoredGuest(now: number): Promise<HydrateResult> {
  const read = await readStoredGuest();
  if (!read.ok) return 'unread';
  let rawProfiles: unknown;
  let rawTombstones: unknown;
  try {
    [rawProfiles, rawTombstones] = await Promise.all([readJsonExact<unknown>(PROFILES_KEY), readJsonExact<unknown>(PROFILE_TOMBSTONES_KEY)]);
  } catch {
    return 'unread';
  }
  // Damaged data decides nothing (a list; a tombstone record).
  if (storedIdStatus('', rawProfiles, rawTombstones) === null) return 'unread';
  // The stored ids join the list in memory, so a learner that list missed is still a profile here.
  const inMemory = useProfileStore.getState().profiles;
  const profiles: GuestRuleProfile[] = [...inMemory, ...storedRuleProfiles(rawProfiles).filter((p) => !inMemory.some((m) => m.id === p.id))];
  const action = storedGuestAction(read.raw, now, profiles);
  const named = action.kind === 'keep' || action.kind === 'repair' ? action.record.id : action.kind === 'sweep' ? action.id : null;
  const removed = named !== null && storedIdStatus(named, rawProfiles, rawTombstones) === 'removed';
  if (action.kind === 'repair' || (removed && (action.kind === 'keep' || action.kind === 'sweep'))) {
    // A saved guest, or a removed learner's id (its keys go with the OA-7a launch sweep): only the record goes.
    await removeGuestRecord();
    return 'repair';
  }
  if (action.kind === 'sweep') {
    await sweepGuest(action.id, action.questDone);
    return 'sweep';
  }
  if (action.kind === 'keep') {
    if (!useGuestStore.getState().running) useGuestStore.setState({ record: action.record, memoryOnly: false });
    return 'keep';
  }
  return action.kind;
}

/** `hr:guest` goes, and the other tabs are told (a run of that record there ends). */
async function removeGuestRecord(): Promise<void> {
  await removeKey(GUEST_KEY).catch(() => undefined);
  postProfilesChanged();
}

/**
 * GU-D13: removes a never-saved guest: every per-profile store forgets `guestId` (`notifyProfileRemoved`, with the id
 * kept out of telemetry while it runs), the key sweep deletes what is still stored under it, `hr:guest` goes and
 * `guest.expired` is sent. `guestId` is null for a record that held no usable id (only the record goes). Called only
 * for an id in neither the stored list nor the tombstones.
 */
async function sweepGuest(guestId: string | null, questDone: boolean): Promise<void> {
  if (guestId !== null) {
    hideGuestIdWhile(guestId, () => notifyProfileRemoved(guestId));
    await sweepProfileKeys([guestId]);
  }
  await removeGuestRecord();
  void track({ name: 'guest.expired', payload: { questDone } });
}
