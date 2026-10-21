import { GROWN_UP_FRESH_PIN_MS, PIN_RESET_TICKET_KEY, PinResetTicketSchema, type GrownUpUnlock, type PinOwner, type PinResetTicket, type UiLocale } from '@hangul-route/content-schema';
import { writeItem, type KeyValueStorage } from '../i18n/safe-storage';
import type { DeviceGateRead } from './grown-up-lock';
import { realPinEpoch } from './one-account';

/**
 * [OA] The sign-in reset page `/account/pin-reset` (AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 7.5 and 8.5 steps 3
 * and 4, OA-D8, CS-9, CS-10, CS-17; row OA-6). Pure: `components/console/PinResetPage.tsx` reads the browser and asks
 * this module. The page sits behind the grown-up lock and makes no API call.
 *
 * The checks, in order (section 8.5 step 3):
 * 1. the switch (`NEXT_PUBLIC_PIN_RESET_SIGNIN`); off answers `unavailable`;
 * 2. a `signin` unlock of this tab less than `GROWN_UP_FRESH_PIN_MS` (2 minutes) old that the reset leg wrote with a
 *    password, an email code, a phone code or a Clerk password-reset code, or after the router's reverification that
 *    refuses a passkey (section 7.4): the reset-leg stamp (`hr:grownup:resetLeg`) carries its `at`. A passkey never
 *    counts, on any browser (OQ-21, CS-17), and neither does an ordinary-leg unlock, whatever its factor. Else Clerk
 *    reverification runs, refusing a passkey too (`reverifySecret`);
 * 3. the device marker is readable and `pin`;
 * 4. `pinOwner.epoch === marker.pinEpoch` (no record for this epoch: `firstSignIn`) and `pinOwner.owner` equals the
 *    signed-in account's fingerprint (another account: `notOwner`).
 * Any failing check shows its line and Back to learning, and writes nothing. Success writes the ticket
 * (`hr:shell:pinReset` = `{ v: 1, at, epoch }`, no id of any kind), clears the console session and opens the learner
 * app's `gate=pin-reset`.
 */

/** The refusal lines of section 17.5, chosen by cause (design `console-pin.md` boards 5 to 8). */
export type PinResetLine = 'notOwner' | 'firstSignIn' | 'noPin' | 'unavailable';

export type PinResetDecision = { kind: 'reverify' } | { kind: 'refused'; line: PinResetLine } | { kind: 'go'; epoch: number };

/** Where the page sends the tab after it wrote the ticket: the learner app's boot intent, with the console's language. */
export function pinResetTarget(locale: UiLocale): string {
  return `/?gate=pin-reset&lang=${locale}`;
}

/**
 * Step 2: this tab's `signin` unlock is under 2 minutes old and the reset leg stamped it (`resetLegAt === unlock.at`,
 * written by `grantSignInUnlock` only for the leg's factors, never a passkey). An unlock from the ordinary leg (an email
 * link, a Clerk ticket, a factor Clerk did not name, Use a passkey) or a PIN unlock does not count: the page runs the
 * passkey-refusing reverification instead.
 */
export function freshResetSignIn(input: { unlock: GrownUpUnlock | null; resetLegAt: number | null; now: number }): boolean {
  const { unlock, now } = input;
  if (!unlock || unlock.src !== 'signin' || input.resetLegAt === null || input.resetLegAt !== unlock.at) return false;
  const age = now - unlock.at;
  return age >= 0 && age < GROWN_UP_FRESH_PIN_MS;
}

const refused = (line: PinResetLine): PinResetDecision => ({ kind: 'refused', line });

export function decidePinReset(input: {
  flag: boolean;
  /** `freshResetSignIn`, or a Clerk reverification that just succeeded with a password or a code. */
  signInFresh: boolean;
  device: DeviceGateRead;
  /** Shell store `pinOwner`, read leniently (junk reads as none). */
  stored: PinOwner | null;
  /** The signed-in account's fingerprint (`pinOwnerFingerprint`); null when it cannot be worked out. */
  owner: string | null;
}): PinResetDecision {
  const { device, stored, owner } = input;
  if (!input.flag) return refused('unavailable');
  if (!input.signInFresh) return { kind: 'reverify' };
  // A read that failed may be any device: nothing can be checked, so nothing is promised (board 8).
  if (!device.readable) return refused('unavailable');
  if (device.marker?.gate !== 'pin') return refused('noPin');
  const epoch = realPinEpoch(device);
  // A PIN set before A-6 (epoch 0) can have no owner: no grown-up has ever proved it here with a sign-in.
  if (epoch === null) return refused('firstSignIn');
  if (!owner) return refused('unavailable');
  if (!stored || stored.epoch !== epoch) return refused('firstSignIn');
  if (stored.owner !== owner) return refused('notOwner');
  return { kind: 'go', epoch };
}

/** The ticket of section 8.5 step 4: a time and the marker epoch, nothing else. */
export function pinResetTicket(now: number, epoch: number): PinResetTicket | null {
  const ticket = PinResetTicketSchema.safeParse({ v: 1, at: now, epoch });
  return ticket.success ? ticket.data : null;
}

/** Writes the ticket into this tab's `sessionStorage`; false when the storage refused it (the page then says `unavailable`). */
export function writePinResetTicket(ticket: PinResetTicket, storage: KeyValueStorage | null): boolean {
  return writeItem(storage, PIN_RESET_TICKET_KEY, JSON.stringify(ticket));
}
