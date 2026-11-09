import type { AccountTrust, GrownUpUse } from '@hangul-route/content-schema';
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
 * every button of it that opens an account screen or signs in (Sign in, a use row, Sign in again) opens that screen,
 * whose `AccountGate` asks the typed PIN first without a fresh proof (row NS-4). Sign out only deletes, so it never
 * asks one.
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
 * Section 7.1, design D7 (row NS-4): the card's use rows, in the order family, teacher, school. On a `pin` device the
 * uses record (`hr:grownup:deviceUses`), else this visit's in-memory `['account', 'spaces']` answer; on any other
 * device only the in-memory answer (no record is kept there, ND-9). An account with no space shows no row: a button
 * would only open "This account has no family space.", and the card already has Sign out.
 */
export function cardUses(gate: NativeGateState | null, record: readonly GrownUpUse[] | null, memory: readonly GrownUpUse[] | null): GrownUpUse[] {
  const uses = gate !== null && gate.state === 'pin' ? (record ?? memory) : memory;
  return USE_ORDER.filter((use) => uses?.includes(use) === true);
}

const USE_ORDER: readonly GrownUpUse[] = ['family', 'teacher', 'school'];
