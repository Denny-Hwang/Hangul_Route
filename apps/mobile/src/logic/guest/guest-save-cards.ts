import type { GuestSaveGate } from './guest-model';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 8.1 and 8.6 (row GU-4; mock `design/screens/onboarding/guest-save.md` D5
 * and D9): what the save card on the guest's Results and the Not now card draw, by the case of `guestSaveGate`. Read
 * by the screens of the guest's chunk only, so the start bundle does not carry it.
 */

/** Section 8.1: the save card under the stars and the card. */
export interface GuestSaveCard {
  /** Hoya's line, the card's heading: `line` when the guest holds quest 1's card, else `lineNoCard`; `askOwner` on an `owner` device. */
  heading: 'line' | 'lineNoCard' | 'askOwner';
  /** **Keep my progress**, the one filled button (cases `open` and `verify`). */
  keep: boolean;
  /** The caption under it, **A grown-up on this device adds you with the PIN.** (case `verify`). */
  caption: boolean;
  /** **Not now**: a quiet text button under Keep my progress, or the one filled button on an `owner` device. */
  notNow: 'quiet' | 'filled';
}

export function guestSaveCard(gate: GuestSaveGate, holdsCard: boolean): GuestSaveCard {
  if (gate === 'owner') return { heading: 'askOwner', keep: false, caption: false, notNow: 'filled' };
  return { heading: holdsCard ? 'line' : 'lineNoCard', keep: true, caption: gate === 'verify', notNow: 'quiet' };
}

/** Section 8.6: the Not now card. */
export interface GuestLaterCard {
  /** The line under the heading: `line` (not backed up yet), or `askOwner` on an `owner` device. */
  line: 'line' | 'askOwner';
  /** **Add my name** (filled); not on an `owner` device. */
  save: boolean;
  /** **Close**: outlined beside Add my name, filled when it is the one button. */
  close: 'outlined' | 'filled';
}

export function guestLaterCard(gate: GuestSaveGate): GuestLaterCard {
  return gate === 'owner' ? { line: 'askOwner', save: false, close: 'filled' } : { line: 'line', save: true, close: 'outlined' };
}
