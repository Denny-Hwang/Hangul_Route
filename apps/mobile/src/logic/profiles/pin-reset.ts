import { RESCUE_MAX_ATTEMPTS, RESCUE_PAUSE_MS, RESCUE_WINDOW_MS, normalizeRescueCode } from '@hangul-route/content-schema';
import { LOCALE_META, formatDate, type Messages, type UiLocale } from '@hangul-route/i18n';
import {
  cooldownRemainingMs,
  isLocked,
  registerFlatFailure,
  registerSuccess,
  type AttemptState,
  type FlatThrottle,
} from './pin-hash';
import { pauseText } from './pin-pause';
import { needsFreshPin } from './session';

/**
 * Forgot PIN, offline — F-LEARN-001 §3.5, L9. Pure: no storage, no React, no
 * network. Two ways to a new PIN, both keep the learners, cards and progress:
 *
 *  1. Re-enter a Rescue Code that this device already stores for a synced
 *     learner. Wrong entries count on the code's **own** throttle
 *     (`account:rescueAttempts`, [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.3: 5 per 15 minutes, then a flat
 *     15-minute pause), so the code cannot be brute-forced here and stays usable while the PIN pad is paused.
 *  2. Wait 24 hours (`account:pinResetRequestedAt`), then set a new PIN.
 */

/** How long the wait path holds before a new PIN may be set. */
export const PIN_RESET_WAIT_MS = 24 * 60 * 60 * 1000;

/**
 * Normalised Rescue Codes stored on this device, one per synced learner
 * (`useSyncStore.byLearner[id].rescueCode`). Empty when none exist, which is
 * when the screen shows only the wait path. Values that are not a Rescue Code
 * shape are dropped.
 */
export function collectRescueCodes(byLearner: Readonly<Record<string, { rescueCode: string | null }>>): string[] {
  const codes: string[] = [];
  for (const { rescueCode } of Object.values(byLearner)) {
    const normalized = rescueCode === null ? null : normalizeRescueCode(rescueCode);
    if (normalized !== null) codes.push(normalized);
  }
  return codes;
}

/** [OA] The Rescue Code's own throttle (section 8.3): a code is several words, so a flat pause is enough. */
export const RESCUE_THROTTLE: FlatThrottle = { max: RESCUE_MAX_ATTEMPTS, windowMs: RESCUE_WINDOW_MS, pauseMs: RESCUE_PAUSE_MS };

export type RescueCodeFailure = 'cooldown' | 'bad-format' | 'no-code' | 'wrong-code';

export type RescueCodeResult =
  | { ok: true; state: AttemptState }
  | { ok: false; state: AttemptState; reason: RescueCodeFailure; cooldownRemainingMs?: number };

/**
 * Check a typed Rescue Code against the codes stored on the device. `state` is the code's own attempt state
 * (`account:rescueAttempts`), never the PIN's. The
 * cooldown gate comes first so a locked-out attempt is never compared. An
 * entry that is not a Rescue Code shape, or a device with no stored code, is
 * not a guess and does not burn an attempt; a well-formed wrong code does.
 */
export function attemptRescueCode(input: {
  entry: string;
  storedCodes: readonly string[];
  state: AttemptState;
  now: number;
}): RescueCodeResult {
  const { entry, storedCodes, state, now } = input;
  if (isLocked(state, now)) {
    return { ok: false, state, reason: 'cooldown', cooldownRemainingMs: cooldownRemainingMs(state, now) };
  }
  if (storedCodes.length === 0) return { ok: false, state, reason: 'no-code' };
  const normalized = normalizeRescueCode(entry);
  if (normalized === null) return { ok: false, state, reason: 'bad-format' };
  if (storedCodes.includes(normalized)) return { ok: true, state: registerSuccess() };
  return { ok: false, state: registerFlatFailure(state, now, RESCUE_THROTTLE), reason: 'wrong-code' };
}

export type ResetWaitState =
  | { status: 'idle' }
  | { status: 'waiting'; readyAt: number; remainingMs: number }
  | { status: 'ready'; readyAt: number };

/**
 * Where the 24-hour wait stands. `readyAt` is epoch ms (the screen formats it
 * in local time). The wait is over at the boundary instant itself. A missing
 * or unreadable request reads as idle.
 */
export function resetWaitState(requestedAt: string | null, now: number): ResetWaitState {
  const requested = requestedAt === null ? Number.NaN : Date.parse(requestedAt);
  if (Number.isNaN(requested)) return { status: 'idle' };
  const readyAt = requested + PIN_RESET_WAIT_MS;
  return now >= readyAt ? { status: 'ready', readyAt } : { status: 'waiting', readyAt, remainingMs: readyAt - now };
}

/**
 * The stamp to store when "Start the wait" is pressed: the pending one if
 * there is one (pressing again cannot extend or restart the wait), else now.
 */
export function startResetWait(existing: string | null, now: number): string {
  return existing !== null && resetWaitState(existing, now).status !== 'idle' ? existing : new Date(now).toISOString();
}

type PinMessages = Messages['caregiver']['pin'];

/** Calm, adult-facing line for a Rescue Code entry that did not open the reset. Never shames. */
export function rescueFailureMessage(result: Extract<RescueCodeResult, { ok: false }>, m: PinMessages): string {
  switch (result.reason) {
    case 'cooldown':
      return pauseText(result.cooldownRemainingMs ?? 0, m);
    case 'bad-format':
      return m.reset.failure.badFormat;
    case 'no-code':
      return m.reset.failure.noCode;
    case 'wrong-code':
      return m.reset.failure.wrongCode;
  }
}

/**
 * The end of the wait as a local date and time in the UI locale, e.g. "Oct 11, 2026, 4:30 PM".
 * Never throws: a runtime without that locale's data falls back to the formatter table.
 */
export function formatReadyAt(locale: UiLocale, readyAt: number): string {
  const date = new Date(readyAt);
  try {
    return date.toLocaleString(LOCALE_META[locale].speechLang, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${formatDate(locale, date, 'monthDayYear')}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}

export interface WaitCardView {
  caption: string;
  buttonLabel: string;
  buttonDisabled: boolean;
}

/**
 * What the "Wait 24 hours" card shows. `formatReadyAt` turns the epoch ms of
 * the end of the wait into local text (the screen owns the locale).
 */
export function waitCardView(
  wait: ResetWaitState,
  formatReadyAt: (readyAt: number) => string,
  m: PinMessages,
): WaitCardView {
  switch (wait.status) {
    case 'idle':
      return { caption: m.reset.wait.idle.caption, buttonLabel: m.reset.wait.idle.button, buttonDisabled: false };
    case 'waiting':
      return {
        caption: m.reset.wait.waiting.caption(formatReadyAt(wait.readyAt)),
        buttonLabel: m.reset.wait.waiting.button,
        buttonDisabled: true,
      };
    case 'ready':
      return { caption: m.reset.wait.ready.caption, buttonLabel: m.reset.wait.ready.button, buttonDisabled: false };
  }
}

/**
 * [OA] OA-D21: whether the Grown-up area shows "The grown-up PIN was changed after the 24-hour wait." now: a PIN set
 * by the finished wait is on record and a PIN was entered after it (so the grown-up who sees it is not the one who
 * just set it, and the setup step itself never shows it). The screen clears the record once shown.
 */
export function resetByWaitNoticeDue(record: { at: number } | null, lastPinVerifiedAt: number | null): boolean {
  return record !== null && lastPinVerifiedAt !== null && lastPinVerifiedAt > record.at;
}

/**
 * [OA] OA-D21: Change PIN on the reset-by-wait notice sets a new PIN, so it needs a PIN entered within
 * `GROWN_UP_FRESH_PIN_MS` (`needsFreshPin`): fresh, it opens creation (`setup`); otherwise the current PIN is asked
 * first (`change`), so whoever holds a device left on the Grown-up area cannot take the PIN over. The caller passes
 * when a PIN was last typed (`lastPinTypedAt`), never a face or fingerprint success: those never set, change or reset
 * the PIN (section 8.6).
 */
export function changePinMode(lastPinVerifiedAt: number | null, now: number): 'setup' | 'change' {
  return needsFreshPin('change_pin', lastPinVerifiedAt, now) ? 'change' : 'setup';
}
