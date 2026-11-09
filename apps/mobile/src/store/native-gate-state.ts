import { GUEST_KEY } from '@hangul-route/content-schema';
import { nativeGateStateOf, type NativeGateInput, type NativeGateState } from '../logic/account/gate-state';
import { readJsonExact } from '../platform/storage';
import { PIN_HASH_KEY, useAccountStore } from './account-store';
import { useGuestStore } from './guest-store';
import { PROFILES_KEY, useProfileStore } from './profile-store';

/**
 * F-AUTH-004 section 7.2 (row NS-2): `nativeGateState()`, the native gate state of this device now (`unknown`,
 * `nopin`, `open` or `pin` with its epoch), from the stores and the exact reads the device gate marker writer makes
 * (`store/device-gate.ts`), decided by `nativeGateStateOf`. Never the in-memory marker.
 *
 * It lives beside the marker writer rather than in it so the web start bundle does not carry it: only native code
 * (the Grown-up area stack and, from row NS-4, `AccountGate`) imports this module.
 */

type Read = (key: string) => Promise<unknown>;

async function storedReads(read: Read): Promise<NativeGateInput['stored']> {
  try {
    const [profiles, pinHash, guest] = await Promise.all([read(PROFILES_KEY), read(PIN_HASH_KEY), read(GUEST_KEY)]);
    return { ok: true, profiles, pinHash, guest };
  } catch {
    return { ok: false };
  }
}

/** The stores as they are now (read after the storage reads, so a change made meanwhile is seen in both or in memory). */
function memoryInput(): Omit<NativeGateInput, 'stored'> {
  const profiles = useProfileStore.getState();
  const account = useAccountStore.getState();
  const guest = useGuestStore.getState();
  return {
    hydrated: { profiles: profiles.hydrated, account: account.hydrated, guest: guest.hydrated },
    pinHashReadFailed: account.pinHashReadFailed,
    memory: {
      profiles: profiles.profiles,
      parentPinHash: account.parentPinHash,
      pinSetAt: account.pinSetAt,
      pinHashSeen: account.pinHashSeen,
      guest: guest.record,
    },
  };
}

/** Section 7.2: the gate state of this device. `read` is the exact storage read (a test seam). */
export async function nativeGateState(read: Read = readJsonExact): Promise<NativeGateState> {
  const before = memoryInput();
  // Nothing to read before every store is in: the answer is `unknown` whatever storage holds.
  if (!before.hydrated.profiles || !before.hydrated.account || !before.hydrated.guest) return { state: 'unknown' };
  const stored = await storedReads(read);
  return nativeGateStateOf({ ...memoryInput(), stored });
}

/**
 * Calls `listener` with the gate state after any change of the profiles, the account or the guest record (each change
 * reads the state again; answers that arrive out of order are dropped). Returns the unsubscribe.
 */
export function watchNativeGateState(listener: (state: NativeGateState) => void, read: Read = readJsonExact): () => void {
  let generation = 0;
  let live = true;
  const check = (): void => {
    generation += 1;
    const mine = generation;
    void nativeGateState(read).then((state) => {
      if (live && mine === generation) listener(state);
    });
  };
  const offProfiles = useProfileStore.subscribe(check);
  const offAccount = useAccountStore.subscribe(check);
  const offGuest = useGuestStore.subscribe(check);
  return () => {
    live = false;
    offProfiles();
    offAccount();
    offGuest();
  };
}
