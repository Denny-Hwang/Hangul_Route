import { GUEST_KEY, type GuestRecord } from '@hangul-route/content-schema';
import { storedGuestAction, type StoredGuestAction } from '../logic/guest/guest-model';
import { removeKey } from '../platform/storage';
import { PROFILES_LOCK, withTabLock } from '../platform/tab-lock';
import { track } from '../platform/telemetry';
import { readStoredGuest, useGuestStore } from './guest-store';
import { sweepProfileKeys } from './profile-key-sweep';
import './profile-keys';
import { notifyProfileRemoved } from './profile-removal';
import { useProfileStore } from './profile-store';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 5.4 step 4, section 7.2 and GU-D13 (row GU-2): the boot's read of
 * `hr:guest`, after the profile list. Always on, whatever the switches say:
 * - a record whose id is already a profile (a save interrupted between the profile write and the delete) is deleted
 *   and the profile kept (the hydrate repair); a record whose id is in neither list stays a guest;
 * - a never-saved record past `guestTtlMs` (30 days without play, 7 on a device with learner profiles), or one that has
 *   not parsed for 30 days (at once when it holds no time), is removed through `notifyProfileRemoved(guestId)`, so
 *   every per-profile store forgets the id, then the OA-7a key sweep deletes every stored key of it, then the record
 *   goes and `guest.expired { questDone }` is sent (no profile id);
 * - a record that does not parse, younger than that, reads as no guest and is kept until a start overwrites it.
 * Importing `profile-keys` loads every store that keeps a per-profile key, so each has subscribed to
 * `onProfileRemoved` before a sweep. A storage that cannot be read decides nothing. Never throws.
 */
export async function hydrateGuest(now: number = Date.now()): Promise<StoredGuestAction['kind'] | 'unread'> {
  try {
    return await withTabLock(PROFILES_LOCK, async () => {
      const read = await readStoredGuest();
      if (!read.ok) return 'unread';
      const action = storedGuestAction(read.raw, now, useProfileStore.getState().profiles);
      let record: GuestRecord | null = null;
      if (action.kind === 'keep') record = action.record;
      else if (action.kind === 'repair') await removeKey(GUEST_KEY).catch(() => undefined);
      else if (action.kind === 'sweep') await sweepGuest(action.id, action.questDone);
      useGuestStore.setState({ record, running: false, memoryOnly: false });
      return action.kind;
    });
  } catch {
    return 'unread';
  } finally {
    useGuestStore.setState({ hydrated: true });
  }
}

/**
 * GU-D13: removes a never-saved guest: every per-profile store forgets `guestId` (`notifyProfileRemoved`), the key
 * sweep deletes what is still stored under it, `hr:guest` goes and `guest.expired` is sent. `guestId` is null for a
 * record that held no usable id (only the record goes). Never called for an id on the profile list.
 */
async function sweepGuest(guestId: string | null, questDone: boolean): Promise<void> {
  if (guestId !== null && !useProfileStore.getState().profiles.some((p) => p.id === guestId)) {
    notifyProfileRemoved(guestId);
    await sweepProfileKeys([guestId]);
  }
  await removeKey(GUEST_KEY).catch(() => undefined);
  void track({ name: 'guest.expired', payload: { questDone } });
}
