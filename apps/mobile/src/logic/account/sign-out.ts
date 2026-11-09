import type { NativeGateState } from './gate-state';
import { recordsToDelete, type TrustRead } from './sign-in-records';

/**
 * F-AUTH-004 section 6.6 (row NS-3; CS-N4, CS-N7, R-2): **Sign out** (the account card's ConfirmSheet, `via: 'user'`)
 * and **Sign in again** on a lock (`via: 'lock'`). Pure over its ports, so the order and the offline case are tested.
 *
 * 1. Clerk's own session is signed out first, while its token can still reach Clerk (`endSession`; Clerk's Expo SDK
 *    keeps one instance for the run, so unmounting its provider is not a sign-out). Offline it fails: the session then
 *    ends on Clerk's side only at its normal end (accepted risk R-2), and nothing below waits for it.
 * 2. Every Clerk item goes (`wipeTokens`: every indexed and named `hr.clerk` key, and this run's memory items).
 * 3. The account's records go (`recordsToDelete`: the uses record, the trust, the re-trust notice; both paths keep a
 *    trust of another epoch, so the re-trust rule still holds for the next sign-in; row NS-7).
 * 4. The account queries are cancelled and removed (`clearQueries`), and this visit's memory (the sign-in time, the
 *    re-trust flag) is forgotten (`forgetVisit`).
 * 5. `auth.native.signout { os, via }` (section 15).
 *
 * Every step runs whatever the one before answered (Sign out stays enabled offline: the local items go at once), and
 * no step throws out of here. Resolves to whether every local delete answered.
 */

export interface SignOutPorts {
  endSession: () => Promise<boolean>;
  wipeTokens: () => Promise<boolean>;
  gate: () => Promise<NativeGateState>;
  readTrust: () => Promise<TrustRead>;
  removeRecord: (key: string) => Promise<void>;
  clearQueries: () => Promise<void>;
  forgetVisit: () => void;
  track: (via: 'user' | 'lock') => void;
}

async function attempt<T>(task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch {
    return fallback;
  }
}

export async function signOutOfAccount(ports: SignOutPorts, via: 'user' | 'lock'): Promise<boolean> {
  await attempt(ports.endSession, false);
  const wiped = await attempt(ports.wipeTokens, false);
  const gate = await attempt(ports.gate, { state: 'unknown' } as NativeGateState);
  const trust = await attempt(ports.readTrust, { kind: 'damaged' } as TrustRead);
  let removed = true;
  for (const key of recordsToDelete(via, gate, trust)) {
    if (!(await attempt(() => ports.removeRecord(key).then(() => true), false))) removed = false;
  }
  await attempt(ports.clearQueries, undefined);
  try {
    ports.forgetVisit();
  } catch {
    // A memory reset never fails the sign-out.
  }
  try {
    ports.track(via);
  } catch {
    // Telemetry never fails the sign-out.
  }
  return wiped && removed;
}
