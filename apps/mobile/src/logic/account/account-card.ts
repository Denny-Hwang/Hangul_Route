import type { AccountTrust } from '@hangul-route/content-schema';
import { accountLock, type AccountLockCause } from './account-lock';
import type { NativeGateState } from './gate-state';

/**
 * F-AUTH-004 sections 7.1 (the Grown-up area row), 7.2 and 6.6, design D7 (row NS-3; CS-N2, CS-N9, CS-N11): what the
 * Grown-up area's account card shows. Pure; `screens/account/AccountCard.native.tsx` draws it and decides it, as
 * `AccountGate` does, on mount, on every focus and on every return to `active` (no timer).
 *
 * | Input                                              | Card                                                       |
 * | gate not read yet, `nopin`, Clerk not mounted yet  | nothing (`nopin`: the Grown-up area runs PIN setup first)  |
 * | gate `unknown`, or Clerk off for this visit        | `cant_check`: `lock.cantCheck` and Try again; no email     |
 * | Clerk still loading                                | nothing; offline: `signed_out` (Sign in waits for the net) |
 * | `accountLock` says `sign_in`                       | `signed_out`: the line and Sign in                         |
 * | `accountLock` says `home`                          | `signed_in`: the email line only with a fresh proof (a PIN |
 * |                                                    | typed or a native sign-in within 2 minutes, never a face   |
 * |                                                    | or fingerprint), the shared-device line, Sign out          |
 * | `accountLock` says `locked`                        | `locked`: the lock's line and its button; no email         |
 *
 * The card is not an account screen: it reads `accountLock` as entered from inside the area (no `verify_pin`), and
 * every button of it that opens an account screen or signs in asks the typed PIN first without a fresh proof
 * (`cardEntry`). Sign out only deletes, so it never asks one.
 */

export type AccountCardView =
  | { kind: 'hidden' }
  | { kind: 'cant_check' }
  | { kind: 'signed_out' }
  | { kind: 'signed_in'; email: boolean }
  | { kind: 'locked'; cause: Exclude<AccountLockCause, 'needs_pin' | 'unknown'>; action: 'back' | 'sign_in_again' };

export interface AccountCardInput {
  /** `nativeGateState()` as last read; null before the first read. */
  gate: NativeGateState | null;
  /** Clerk's provider for this visit: not decided yet, off, mounted and loading, or mounted and loaded. */
  clerk: 'pending' | 'off' | 'loading' | 'ready';
  online: boolean;
  /** Clerk's `isSignedIn` (only read while `ready`). */
  signedIn: boolean;
  signedInThisVisit: boolean;
  trust: AccountTrust | null;
  retrustPending: boolean;
  /** `freshProof(...)`: a typed PIN or a native sign-in within `GROWN_UP_FRESH_PIN_MS`. */
  fresh: boolean;
}

export function accountCardView(input: AccountCardInput): AccountCardView {
  const { gate } = input;
  if (gate === null || gate.state === 'nopin') return { kind: 'hidden' };
  if (gate.state === 'unknown') return { kind: 'cant_check' };
  if (input.clerk === 'pending') return { kind: 'hidden' };
  if (input.clerk === 'off') return { kind: 'cant_check' };
  if (input.clerk === 'loading') return input.online ? { kind: 'hidden' } : { kind: 'signed_out' };
  const lock = accountLock({
    gate,
    signedIn: input.signedIn,
    signedInThisVisit: input.signedInThisVisit,
    trust: input.trust,
    retrustPending: input.retrustPending,
    fresh: input.fresh,
    fromOutside: false,
  });
  if (lock.kind === 'home') return { kind: 'signed_in', email: input.fresh };
  if (lock.kind === 'locked' && lock.cause !== 'unknown') return { kind: 'locked', cause: lock.cause, action: lock.action === 'sign_in_again' ? 'sign_in_again' : 'back' };
  return { kind: 'signed_out' };
}

/**
 * ND-5, CS-N11: a card button that opens an account screen or signs in (Sign in, Sign in again) on a `pin` device
 * needs a typed PIN or a native sign-in within 2 minutes; without one it asks the typed PIN first (`verify_pin`). On
 * an `open` device there is no PIN to ask; a gate not read yet fails closed.
 */
export function cardEntry(gate: NativeGateState | null, fresh: boolean): 'go' | 'verify_pin' {
  // Only an `open` device goes without a PIN; a gate not read yet (or any other state) fails closed.
  if (gate !== null && gate.state === 'open') return 'go';
  return fresh && gate !== null && gate.state === 'pin' ? 'go' : 'verify_pin';
}
