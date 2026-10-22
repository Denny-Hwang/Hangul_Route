import { GUEST_KEY, GuestRecordSchema, type Profile } from '@hangul-route/content-schema';
import { isLiveGuest, storedIdStatus, storedRuleProfiles, unreadableGuestId, type GuestRuleProfile } from '../logic/guest/guest-model';
import { gateOpensDirectly } from '../logic/profiles/gate-route';
import { storedProfileItems } from '../logic/profiles/profile-merge';
import { postProfilesChanged } from '../platform/profiles-channel';
import { readJsonExact, readJsonStrict, removeKey } from '../platform/storage';
import { PROFILES_LOCK, withTabLock } from '../platform/tab-lock';
import { useAccountStore } from './account-store';
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

/**
 * [GU] Row GU-5 review (section 9.2, CS-G10): after **Remove the first quest** on the guest-only gate, whether the
 * destination may now open directly, read again from storage rather than this tab's memory: the PIN hash strictly
 * (`rereadPinHash`; this tab never hears of a PIN another tab set) and the stored profile list, joined with memory.
 * Another tab may have saved the guest as a child, added a learner or set a PIN while this sheet was open; then the
 * gate is required and this is false. A read that fails is false (fail closed: the PIN screen stays). A profile only
 * storage holds is read into this tab's store, so the PIN screen draws what is stored. Never throws.
 */
export async function gateOpensDirectlyAfterRemove(): Promise<boolean> {
  try {
    const pin = await useAccountStore.getState().rereadPinHash();
    if (pin.failed) return false;
    const stored = storedProfileItems<Profile>(await readJsonStrict<unknown>(PROFILES_KEY));
    const memory = useProfileStore.getState().profiles;
    const added = stored.filter((p) => !memory.some((m) => m.id === p.id));
    if (added.length > 0) await useProfileStore.getState().refresh().catch(() => undefined);
    return gateOpensDirectly({ profiles: [...memory, ...added], parentPinHash: pin.hash, sessionOpen: false, guest: null });
  } catch {
    return false;
  }
}
