import { GUEST_KEY, GuestRecordSchema } from '@hangul-route/content-schema';
import { isLiveGuest, storedIdStatus, storedRuleProfiles, unreadableGuestId, type GuestRuleProfile } from '../logic/guest/guest-model';
import { postProfilesChanged } from '../platform/profiles-channel';
import { readJsonExact, removeKey } from '../platform/storage';
import { PROFILES_LOCK, withTabLock } from '../platform/tab-lock';
import { hideGuestIdWhile, readStoredGuest, useGuestStore } from './guest-store';
import { sweepProfileKeys } from './profile-key-sweep';
import './profile-keys';
import { notifyProfileRemoved } from './profile-removal';
import { PROFILES_KEY, PROFILE_TOMBSTONES_KEY, useProfileStore } from './profile-store';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 9.2 and OQ-G4 (row GU-5): **Remove the first quest**, from People on this
 * device or the guest-only gate on PIN setup, after its ConfirmSheet (and a fresh PIN where one is stored, asked by the
 * caller). Inside the `hr:profiles` lock, on what is stored then: the guest's id is forgotten by every per-profile store
 * (`notifyProfileRemoved`, the id kept out of telemetry while it runs) and the OA-7a key sweep deletes every key of it,
 * then `hr:guest` goes and the other tabs are told (a run of it there ends). The keys go only when `hr:profiles` and its
 * tombstones read exactly and neither holds the id, so a saved or removed learner's data is never touched (a record
 * whose id is already a profile only goes). A record held in memory only (storage blocked) is forgotten the same way.
 * No server call (there is nothing there) and no event. Only the grown-up side loads this module
 * (`screens/parent/guest-keep-chunk.tsx`), so it stays out of the start bundle. Resolves true when no guest record is left; false when the
 * storage could not be read (nothing is removed). Never throws.
 */
export async function removeLiveGuest(): Promise<boolean> {
  try {
    return await withTabLock(PROFILES_LOCK, async () => {
      const read = await readStoredGuest();
      if (!read.ok) return false;
      const [rawProfiles, rawTombstones] = await Promise.all([readJsonExact<unknown>(PROFILES_KEY), readJsonExact<unknown>(PROFILE_TOMBSTONES_KEY)]);
      if (storedIdStatus('', rawProfiles, rawTombstones) === null) return false;
      const inMemory = useProfileStore.getState().profiles;
      const profiles: GuestRuleProfile[] = [...inMemory, ...storedRuleProfiles(rawProfiles).filter((p) => !inMemory.some((m) => m.id === p.id))];
      const held = useGuestStore.getState().record;
      const parsed = GuestRecordSchema.safeParse(read.raw);
      const id = read.raw === null ? (isLiveGuest(held, profiles) ? held.id : null) : parsed.success ? parsed.data.id : unreadableGuestId(read.raw, profiles);
      if (id !== null && !profiles.some((p) => p.id === id) && storedIdStatus(id, rawProfiles, rawTombstones) === 'unknown') {
        hideGuestIdWhile(id, () => notifyProfileRemoved(id));
        await sweepProfileKeys([id]);
      }
      if (read.raw !== null) {
        await removeKey(GUEST_KEY).catch(() => undefined);
        postProfilesChanged();
      }
      useGuestStore.setState({ record: null, running: false, memoryOnly: false });
      return true;
    });
  } catch {
    return false;
  }
}
