import { PIN_RESET_TICKET_MS, PinResetTicketSchema, type DeviceGateMarker, type PinResetTicket } from '@hangul-route/content-schema';

/**
 * [OA] Reset the grown-up PIN by signing in, the learner app's side (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 steps
 * 1 and 5, OA-D8, CS-9; row OA-6). Pure: no storage, no clock.
 *
 * - Step 1: Forgot PIN? shows **Sign in to the account** first only on the web, online, with the switch on; a tap
 *   opens `/signin?next=/account/pin-reset` in this tab and writes no unlock (`next` is a fixed path: no id, no PII).
 * - Step 5: the console's `/account/pin-reset` wrote the ticket `hr:shell:pinReset` = `{ v: 1, at, epoch }` and opened
 *   `/?gate=pin-reset`. The app root reads the ticket once and deletes it (`platform/app-root.web.ts`); it opens the
 *   new-PIN screen only when `now - at` is in `[0, PIN_RESET_TICKET_MS)` (2 minutes) and `epoch` is the epoch of the
 *   device's current `pin` marker. Anything else (no ticket, too old, a clock that ran backwards, another PIN, junk, a
 *   ticket already read) is refused and the start screen shows "That took a while. Sign in again to set a new PIN."
 */

/** Step 1's address, before the hand-off adds `lang` (`handoffUrl`): the sign-in page, then the reset page. */
export const PIN_RESET_SIGN_IN_PATH = '/signin?next=/account/pin-reset';

/** Step 1: whether Forgot PIN? offers Sign in to the account (first, above the Rescue Code and the wait). */
export function signInResetShown(input: { os: string; online: boolean; flag: boolean }): boolean {
  return input.os === 'web' && input.online && input.flag;
}

/** The stored ticket (a JSON string) as a ticket, or null when it is absent or does not parse. */
export function pinResetTicketOf(raw: string | null): PinResetTicket | null {
  if (raw === null) return null;
  try {
    const parsed = PinResetTicketSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Step 5: `setup` opens the new-PIN screen; `expired` shows the line over the start screen. */
export type PinResetOutcome = 'setup' | 'expired';

export function pinResetOutcome(input: { ticket: PinResetTicket | null; now: number; marker: DeviceGateMarker | null }): PinResetOutcome {
  const { ticket, now, marker } = input;
  if (!ticket || marker?.gate !== 'pin' || ticket.epoch !== marker.pinEpoch) return 'expired';
  const age = now - ticket.at;
  return age >= 0 && age < PIN_RESET_TICKET_MS ? 'setup' : 'expired';
}

/**
 * The new-PIN screen an accepted ticket opens: setup from the first step (whatever PIN is stored), titled **Choose a
 * new grown-up PIN** (`via: 'sign_in'`), then the Grown-up area. Cancel returns to the start screen.
 */
export const PIN_RESET_SETUP_PARAMS = { next: 'ParentDashboard', mode: 'setup', via: 'sign_in' } as const;
