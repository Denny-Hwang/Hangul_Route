import type { GuestRecord, ProfileRole } from '@hangul-route/content-schema';
import { gateProfiles, storedGuestMayLive } from '../guest/guest-model';
import { gateRequired } from '../profiles/learner-type';
import { isLearnerEntry, pinEpochOf, pinHashFingerprint, storedMarkerProfiles, storedProfilesReadable } from '../shell/device-gate';

/**
 * F-AUTH-004 section 7.2 (row NS-2): the native gate state, the one input every native account decision starts from.
 * Pure: `store/native-gate-state.ts` gathers the stores and the exact reads and calls `nativeGateStateOf`.
 *
 * It never reads the in-memory device gate marker (`store/device-gate.ts`), which is `null` before the stores load and
 * is computed from memory even when the strict re-read refused a `none`. It reads what the marker writer reads, the
 * same strict way (F-APP-001 section 3.9): the profile list, the PIN hash and the guest record, each read exactly.
 *
 * | State     | When                                                                                                |
 * | `unknown` | a store has not hydrated; the PIN hash could not be read at hydrate (`pinHashReadFailed`); the PIN  |
 * |           | epoch is not reconciled with the stored hash yet; an exact read failed or a stored value does not   |
 * |           | parse; memory and storage disagree about the PIN (a write still on its way)                         |
 * | `pin`     | a PIN hash is stored, on any device (self-only ones included), with the epoch `account:pinSetAt`    |
 * |           | as the writer's fingerprint rule reconciled it (`0` for a PIN older than F-APP-001 A-6)             |
 * | `nopin`   | no PIN, and a learner needs the gate (`gateRequired`) in memory or as stored (a live guest counts)  |
 * | `open`    | no PIN, no learner needs the gate, and the stored list confirms it (no profile, or self-only)       |
 *
 * Every doubt reads as `unknown`, which never opens an account screen (CS-N14).
 */

export type NativeGateState = { state: 'unknown' } | { state: 'nopin' } | { state: 'open' } | { state: 'pin'; epoch: number };

/** A profile as the gate reads it (the store's profiles, or the raw stored entries reduced by `storedMarkerProfiles`). */
interface GateProfile {
  id?: string;
  role?: 'learner' | 'parent' | 'teacher' | 'admin';
  learnerType?: 'child' | 'self';
}

export interface NativeGateInput {
  /** Each store has finished its first read. */
  hydrated: { profiles: boolean; account: boolean; guest: boolean };
  /** `useAccountStore.pinHashReadFailed`. */
  pinHashReadFailed: boolean;
  /** What the app holds in memory now. */
  memory: {
    profiles: readonly GateProfile[];
    parentPinHash: string | null;
    pinSetAt: number | null;
    /** `useAccountStore.pinHashSeen`: equal to the hash's fingerprint once the writer reconciled the epoch. */
    pinHashSeen: string | null;
    guest: GuestRecord | null;
  };
  /** The exact reads (`readJsonExact`): `ok: false` when one threw (a failed read or a value that does not parse). */
  stored: { ok: false } | { ok: true; profiles: unknown; pinHash: unknown; guest: unknown };
}

const UNKNOWN: NativeGateState = { state: 'unknown' };

/** Whether the profiles (with a live guest) hold a learner the gate guards. */
function needsGate(profiles: readonly GateProfile[], guest: GuestRecord | null): boolean {
  // A grown-up role is kept; anything else (no role, an unknown one) reads as a learner, as the marker reads it.
  const gated = gateProfiles(profiles, guest).map((p) => ({ ...p, role: isLearnerEntry(p) ? ('learner' as const) : (p.role as ProfileRole) }));
  return gated.some((p) => p.role === 'learner') && gateRequired({ profiles: gated, parentPinHash: null });
}

export function nativeGateStateOf(input: NativeGateInput): NativeGateState {
  const { hydrated, memory, stored } = input;
  if (!hydrated.profiles || !hydrated.account || !hydrated.guest) return UNKNOWN;
  if (input.pinHashReadFailed) return UNKNOWN;
  // The writer reconciles the epoch on its first evaluation and every PIN write records the new fingerprint: until the
  // fingerprint seen matches the hash in memory, `pinSetAt` may be an older PIN's epoch.
  if (memory.pinHashSeen !== pinHashFingerprint(memory.parentPinHash)) return UNKNOWN;
  if (!stored.ok) return UNKNOWN;
  if (!storedProfilesReadable(stored.profiles)) return UNKNOWN;
  if (stored.pinHash !== null && typeof stored.pinHash !== 'string') return UNKNOWN;
  // A PIN in memory that storage does not hold (or another one) is a write on its way, or a store another tab changed.
  if (stored.pinHash !== memory.parentPinHash) return UNKNOWN;
  if (memory.parentPinHash !== null) return { state: 'pin', epoch: pinEpochOf(memory.pinSetAt) };
  // A stored guest record that does not parse may hold a live guest (CS-G6), so it counts as one.
  if (storedGuestMayLive(stored.guest, stored.profiles) || needsGate(memory.profiles, memory.guest) || needsGate(storedMarkerProfiles(stored.profiles), null)) return { state: 'nopin' };
  return { state: 'open' };
}
