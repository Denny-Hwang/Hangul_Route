import { PROFILE_LOCKS_KEY, type Profile } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { effectiveLocks, lockChangedEvent, locksUnreadShown, nextLocks, parseLocks, withoutLock, type LocksRead } from '../logic/profiles/locks';
import type { PauseSchedule, PinHasher, PinVerifyResult } from '../logic/profiles/pin-hash';
import { postProfilesChanged } from '../platform/profiles-channel';
import { readJsonExact, readJsonExactFresh, updateJson } from '../platform/storage';
import { track } from '../platform/telemetry';
import { useAccountStore } from './account-store';

/**
 * [OA] Locked learner profiles at run time (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D9, sections 6.1, 6.3, 13.1, 13.2;
 * row OA-5). The locks live in their own key, `hr:profiles:locks` (`ProfileLocksSchema`), never inside
 * `ProfileSchema` (an older bundle rewriting `hr:profiles` cannot drop them) and never synced. The rules are pure in
 * `logic/profiles/locks.ts`. Locks are enforced whatever `EXPO_PUBLIC_WHO_CHOOSER` says (fail safe, section 16); only
 * the lock control in Edit profile follows the flag.
 */

export type { LocksRead } from '../logic/profiles/locks';

interface State {
  /**
   * The last read of the record. App.tsx mounts the navigator only after `hydrateLearnerData`, which reads it, so no
   * screen sees the start value.
   */
  read: LocksRead;
}

export const useProfileLocks = create<State>(() => ({ read: [] }));

async function readOnce(read: () => Promise<unknown>): Promise<LocksRead> {
  try {
    return parseLocks(await read());
  } catch {
    return 'unread';
  }
}

/**
 * Reads `hr:profiles:locks` exactly. A failed read, or a record that does not parse, is retried once on a fresh
 * connection; if that fails too the result is `unread`, which locks every learner while a PIN exists (fail closed,
 * 13.2) until a later read succeeds. Never throws.
 */
export async function readProfileLocks(): Promise<LocksRead> {
  const first = await readOnce(() => readJsonExact<unknown>(PROFILE_LOCKS_KEY));
  if (first !== 'unread') return first;
  return readOnce(() => readJsonExactFresh<unknown>(PROFILE_LOCKS_KEY));
}

/** Boot (`hydrateLearnerData`), and every `hr-profiles` change from another tab: read the locks again. Never throws. */
export async function hydrateProfileLocks(): Promise<void> {
  useProfileLocks.setState({ read: await readProfileLocks() });
}

/** Stands in for a stored value that did not parse. */
const BROKEN = { broken: true } as const;

const learnerIds = (profiles: readonly Profile[]): string[] => profiles.filter((p) => p.role === 'learner').map((p) => p.id);

/** The learner ids locked now (void without a PIN; every learner while the record is unread). */
export function lockedIds(profiles: readonly Profile[], read: LocksRead = useProfileLocks.getState().read, pinSet: boolean = useAccountStore.getState().parentPinHash !== null): string[] {
  return effectiveLocks({ profileIds: learnerIds(profiles), read, pinSet });
}

/** Whether the screens show `learner.who.locksUnread` (unread, with a PIN) in place of the per-tile captions. */
export function locksUnread(read: LocksRead = useProfileLocks.getState().read, pinSet: boolean = useAccountStore.getState().parentPinHash !== null): boolean {
  return locksUnreadShown({ read, pinSet });
}

/** The hook the chooser, the Profile tiles and Edit profile read: the locked ids and the unread line, kept current. */
export function useLocks(profiles: readonly Profile[]): { locked: ReadonlySet<string>; unread: boolean } {
  const read = useProfileLocks((s) => s.read);
  const pinSet = useAccountStore((s) => s.parentPinHash !== null);
  return { locked: new Set(lockedIds(profiles, read, pinSet)), unread: locksUnread(read, pinSet) };
}

/**
 * Locks or unlocks one learner (Edit profile, behind a fresh PIN; the caller checks `needsFreshPin`). The record is
 * read and written in one step (`updateJson`: one IndexedDB transaction on the web, so another tab's write is never
 * lost), the other tabs are told on `hr-profiles`, and `profile.lock_changed { locked }` is sent. A failed read
 * writes nothing and resolves `false`; the switch then stays as it was.
 */
export async function setProfileLocked(id: string, locked: boolean, profiles: readonly Profile[]): Promise<boolean> {
  const written: { ids: readonly string[] | null } = { ids: null };
  // A stored value the exact read could not parse may come back here as "nothing stored"; while the locks are unread
  // it is written as the fail-closed view, so an unlock still opens only the one learner.
  const unread = useProfileLocks.getState().read === 'unread';
  try {
    await updateJson<unknown>(PROFILE_LOCKS_KEY, (current) => {
      const next = nextLocks(current === null && unread ? BROKEN : current, id, locked, learnerIds(profiles));
      written.ids = next.ids;
      return next;
    });
  } catch {
    return false;
  }
  if (written.ids === null) return false;
  useProfileLocks.setState({ read: written.ids });
  postProfilesChanged();
  void track(lockChangedEvent(locked));
  return true;
}

/**
 * Takes a removed learner's id out of the locks, in the removal's own write sequence (`profile-store.remove`, 13.2).
 * Nothing is written when the id was not locked or the record is broken (a stray id is ignored anyway). Never throws.
 */
export async function dropProfileLock(id: string): Promise<void> {
  try {
    const written: { ids: readonly string[] | null } = { ids: null };
    await updateJson<unknown>(PROFILE_LOCKS_KEY, (current) => {
      const next = withoutLock(current, id);
      if (next !== undefined) written.ids = next.ids;
      return next;
    });
    if (written.ids !== null) useProfileLocks.setState({ read: written.ids });
  } catch {
    // The read failed: nothing was written, and a stray id never counts.
  }
}

/**
 * Section 6.3, CS-3: the verify path of a locked tile (`PinEntry { next: 'LockedProfile' }`). A correct PIN resets
 * the strikes (as every correct PIN does, in the shared attempt state) and clears a pending 24-hour reset request,
 * but it **never** calls `markPinVerified()` or `openParentGate()`: the unlock opens that profile only, never a
 * grown-up session, and never counts as a fresh PIN for `openGrownUpArea` or the fresh-PIN controls. A face or
 * fingerprint success on a locked tile (row OA-9) takes this path too.
 */
export async function verifyForLockedProfile(pin: string, deps: { hasher: PinHasher; schedule: PauseSchedule; now?: () => number }): Promise<PinVerifyResult> {
  const result = await useAccountStore.getState().verifyPinAttempt(pin, deps);
  if (result.ok && useAccountStore.getState().pinResetRequestedAt !== null) useAccountStore.getState().clearPinResetRequest();
  return result;
}

/** Test seam: back to no locks read. */
export function resetProfileLocks(): void {
  useProfileLocks.setState({ read: [] });
}
