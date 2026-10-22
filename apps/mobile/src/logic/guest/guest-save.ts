import { guestSaveGate, type GuestRuleProfile } from './guest-model';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 8.2, CS-G9, CS-G10 (row GU-4): where **Keep my progress** and **Add my
 * name** go, as pure rules. The case comes from `guestSaveGate`, which reads no grown-up session: an open session
 * never skips the PIN (CS-G9). What the two cards draw is `guest-save-cards.ts` (the guest's screen chunk only).
 */

/** Section 8.2: the screen of the `Guest` stack the save opens on. */
export type GuestSaveTarget =
  /** Case `open`: the form, a first run on a device with no learner profile. */
  | { screen: 'CreateProfile'; params: { firstRun: boolean; from: 'guest' } }
  /** Case `verify`: the PIN, verify only (`SaveGuest`). */
  | { screen: 'PinEntry'; params: { next: 'SaveGuest' } };

const learnerCount = (profiles: readonly GuestRuleProfile[]): number => profiles.filter((p) => p.role === undefined || p.role === 'learner').length;

/**
 * Section 8.2: `PinEntry { next: 'SaveGuest' }` when a PIN is stored, the form when the device has no profile and
 * no PIN, and nothing on an `owner` device (the guest never reaches the form or a PIN setup from there, CS-G10).
 * `firstRun` is true when the device holds no learner profile (`onboarding.started.firstRun`).
 */
export function guestSaveTarget(input: { profiles: readonly GuestRuleProfile[]; parentPinHash: string | null }): GuestSaveTarget | null {
  const gate = guestSaveGate(input);
  if (gate === 'owner') return null;
  if (gate === 'verify') return { screen: 'PinEntry', params: { next: 'SaveGuest' } };
  return { screen: 'CreateProfile', params: guestFormParams(input.profiles) };
}

/** The form's params, also after the `SaveGuest` PIN: a first run when the device holds no learner profile. */
export function guestFormParams(profiles: readonly GuestRuleProfile[]): { firstRun: boolean; from: 'guest' } {
  return { firstRun: learnerCount(profiles) === 0, from: 'guest' };
}

/** The `Guest` stack Welcome's **Add my name** opens: the Not now card under the save, so Back on step 1 lands there. */
export interface GuestSaveStack {
  index: 1;
  routes: [{ name: 'GuestLater' }, { name: GuestSaveTarget['screen']; params: GuestSaveTarget['params'] }];
}

export function guestSaveStack(target: GuestSaveTarget): GuestSaveStack {
  return { index: 1, routes: [{ name: 'GuestLater' }, { name: target.screen, params: target.params }] };
}
