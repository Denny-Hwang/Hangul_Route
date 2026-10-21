import type { Messages } from '@hangul-route/i18n';
import { cooldownRemainingMs, type AttemptState } from './pin-hash';

/**
 * [OA] How the PIN screen words a pause (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.3, wireframe
 * `profiles/pin-entry-v2.md` Panel B, mock `design/screens/profiles/pin-entry-v2.md`). Pure: the screen passes the
 * attempt state, the clock and its destination. A pause is a pause: calm words, never "failed", no count of tries.
 */

type PinMessages = Messages['caregiver']['pin'];

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

/** Seconds under a minute (`cooldown(seconds)`), whole minutes, rounded up, from a minute on (`cooldownMinutes(n)`). */
export function pauseText(remainingMs: number, m: PinMessages): string {
  const ms = Math.max(0, remainingMs);
  if (ms < MINUTE_MS) return m.cooldown(Math.ceil(ms / SECOND_MS));
  return m.cooldownMinutes(Math.ceil(ms / MINUTE_MS));
}

/** The PIN screen destination that may point at Forgot PIN? during a pause: the Grown-up area only (CS-21). */
export const PAUSE_HELP_DESTINATION = 'ParentDashboard';
/** The help line shows from this pause round on (the 3rd, 5 minutes). */
export const PAUSE_HELP_FROM_ROUND = 3;

/**
 * Whether the second line (`cooldownHelp`) shows: during a pause of the 3rd round or later, on the Grown-up area
 * destination only. `LockedProfile`, `GrownUpUse` and `CancelReset` (and every other destination) never show it,
 * so the screen a child meets most does not advertise the wait.
 */
export function showsPauseHelp(state: AttemptState, now: number, destination: string | undefined): boolean {
  if (destination !== PAUSE_HELP_DESTINATION) return false;
  return cooldownRemainingMs(state, now) > 0 && (state.strikes ?? 0) >= PAUSE_HELP_FROM_ROUND;
}

/**
 * The polite live region's update key: it changes once a minute (the whole minutes left, rounded up), so a screen
 * reader hears the pause when it starts and then once a minute, never every second (section 14). `null` when no
 * pause runs.
 */
export function pauseAnnounceKey(remainingMs: number): number | null {
  return remainingMs > 0 ? Math.ceil(remainingMs / MINUTE_MS) : null;
}
