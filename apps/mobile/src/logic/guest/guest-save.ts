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

/**
 * Section 8.2, CS-G9, CS-G10 (row GU-4 review): what Continue on the guest's form does once the gate has been read
 * again from storage, just before anything is written. The form keeps the case it opened in (`gated`: it opened
 * through the `SaveGuest` PIN); another tab may have added a learner, set a PIN or saved this guest meanwhile.
 */
export type GuestSaveRecheck =
  /** The case the form opened in still holds: consent, PIN, email, then the promotion. */
  | 'go'
  /** Back to the save card, which draws the case as it now is: the device is now someone else's (`owner`), or the PIN asked at the start is gone. */
  | 'card'
  /** A PIN was set elsewhere while the form was open: the `SaveGuest` PIN first (the guest never saves past it, CS-G9). */
  | 'pin'
  /** Another tab saved this guest: its Home, with nothing written here. */
  | 'saved'
  /** The PIN hash or the profile list could not be read, or no guest is left to save: nothing is written (fail closed). */
  | 'retry';

export function guestSaveRecheck(input: {
  gated: boolean;
  /** The live guest's id when the form opened. */
  guestId: string | null;
  /** The profiles in memory and in storage. */
  profiles: readonly GuestRuleProfile[];
  /** The PIN hash as stored now (or the one in memory when storage holds none yet). */
  parentPinHash: string | null;
  /** A PIN hash this form wrote itself on an earlier Continue whose promotion failed: not "a PIN set elsewhere". */
  ownPinHash: string | null;
  readFailed: boolean;
}): GuestSaveRecheck {
  if (input.readFailed || input.guestId === null) return 'retry';
  if (input.profiles.some((p) => p.id === input.guestId)) return 'saved';
  const hash = input.parentPinHash !== null && input.parentPinHash === input.ownPinHash ? null : input.parentPinHash;
  const gate = guestSaveGate({ profiles: input.profiles, parentPinHash: hash });
  if (gate === 'owner') return 'card';
  if (gate === 'verify') return input.gated ? 'go' : 'pin';
  return input.gated ? 'card' : 'go';
}

/**
 * GU-D11 (section 8.5): a first-run setup promotes the live guest, instead of making a new profile, when the device
 * holds no learner profile. "Learner" is read as everywhere in the guest rules (an absent role is a learner).
 */
export function setupPromotesGuest(input: { guestLive: boolean; profiles: readonly GuestRuleProfile[] }): boolean {
  return input.guestLive && learnerCount(input.profiles) === 0;
}
