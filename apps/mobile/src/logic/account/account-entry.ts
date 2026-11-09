import type { GrownUpUse } from '@hangul-route/content-schema';
import type { WhoMarker } from '../profiles/who';

/**
 * F-AUTH-004 sections 7.1, 7.2 and ND-5, ND-7, ND-9 (row NS-4; design `entries.md`): where a native account entry (a
 * chooser row, Welcome's **Sign in as a grown-up**) goes first, and which account route it opens. Pure.
 *
 * | Device (the in-memory marker the rows are drawn from) | First step                                          |
 * | `pin`                                                  | the typed PIN: `PinEntry { next: 'GrownUpUse', use, |
 * |                                                        | typedOnly: true }` (no face or fingerprint, CS-N11) |
 * | `nopin`                                                | PIN setup (`PinEntry { next: 'ParentDashboard' }`), |
 * |                                                        | never an account screen (ND-7)                      |
 * | `none` (no PIN, no learner the gate guards)            | the account route at once (there is no PIN, ND-9)   |
 *
 * The marker only chooses the first step: the account route's `AccountGate` then decides on the exact gate state
 * (`nativeGateState`), so a marker that is out of date never opens anything by itself (CS-N2, CS-N14).
 */

/** A native account entry: a use row, Sign in as a grown-up (`signin`), or Grown-up account (`account`). */
export type AccountEntryUse = GrownUpUse | 'signin' | 'account';

/** An account route of the nested Grown-up area stack, with its params (memory only; codes, never ids). */
export type AccountRoute = { screen: 'SignIn'; params: { use?: GrownUpUse | 'account' } } | { screen: 'AccountHome'; params: { use: GrownUpUse | 'account' } };

/** Sign in as a grown-up opens the sign-in; a use (or Grown-up account) opens that use's home, which the gate decides. */
export function accountRouteFor(use: AccountEntryUse): AccountRoute {
  return use === 'signin' ? { screen: 'SignIn', params: {} } : { screen: 'AccountHome', params: { use } };
}

export type AccountEntry =
  | { kind: 'pin'; params: { next: 'GrownUpUse'; use: AccountEntryUse; typedOnly: true } }
  | { kind: 'setup' }
  | { kind: 'open'; route: AccountRoute };

export function accountEntryFor(use: AccountEntryUse, marker: WhoMarker): AccountEntry {
  if (marker === 'pin') return { kind: 'pin', params: { next: 'GrownUpUse', use, typedOnly: true } };
  if (marker === 'nopin') return { kind: 'setup' };
  return { kind: 'open', route: accountRouteFor(use) };
}

/** The use a screen of the account stack is titled with (D6): a use's label, or **Grown-up account** with none. */
export function accountTitleUse(use: AccountEntryUse | undefined): GrownUpUse | 'account' {
  return use === undefined || use === 'signin' ? 'account' : use;
}
