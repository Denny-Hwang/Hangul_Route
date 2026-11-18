import type { PinResetMethod } from './pin-flow';

/**
 * [FN] AMENDMENTS-FINISH-2026-11 FN-1 (audit SEC-7): the check before a new PIN. Pure: no storage, no React.
 * Wireframe `design/wireframes/onboarding/all-ages-onboarding.md` box G2, mock `design/screens/profiles/pin-reset-check.md`.
 *
 * The two offline ways of Forgot PIN? (a Rescue Code this device holds, the finished 24-hour wait) ask it before the
 * new-PIN screen opens: a number from 100 to 999 written out in words in the UI language (the screen writes it with
 * `caregiver.pin.reset.check.words`), typed as digits. The parent-gate pattern of Apple App Review 1.3 and Google's
 * Families policy. A miss shows a new number: no count, no pause, no lock. Signing in to the account (section 8.5 of
 * AMENDMENTS-ONE-ACCOUNT-MANY-USERS) is a strong check already and asks none.
 */

export const CHECK_MIN = 100;
export const CHECK_MAX = 999;
/** The field takes one digit more than the answer has, so a slip shows as typed instead of being cut. */
export const CHECK_INPUT_MAX = 4;

/** The reset ways that ask the check. */
export type OfflineResetMethod = Exclude<PinResetMethod, 'sign_in'>;

/** Whether a reset way asks the check before the new PIN: the two offline ways do, signing in does not. */
export function resetNeedsGrownUpCheck(via: PinResetMethod): via is OfflineResetMethod {
  return via !== 'sign_in';
}

/** A number from CHECK_MIN to CHECK_MAX, never `previous` (a miss always shows a different number). */
export function nextCheckNumber(random: () => number = Math.random, previous: number | null = null): number {
  const span = CHECK_MAX - CHECK_MIN + 1;
  const draw = random();
  const r = Number.isFinite(draw) ? Math.min(Math.max(draw, 0), 1) : 0;
  const n = CHECK_MIN + Math.min(Math.floor(r * span), span - 1);
  if (n !== previous) return n;
  return n === CHECK_MAX ? CHECK_MIN : n + 1;
}

/** Digits only (full-width digits from an East Asian keyboard become ASCII), at most CHECK_INPUT_MAX. */
export function cleanCheckInput(input: string): string {
  return input
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/[^0-9]/g, '')
    .slice(0, CHECK_INPUT_MAX);
}

/** Whether the typed digits are the number, exactly (no leading zero). */
export function checkAnswerMatches(value: number, input: string): boolean {
  return cleanCheckInput(input) === String(value);
}

export interface GrownUpCheck {
  /** The way that asked it; the new-PIN screen opens with this `via`. */
  via: OfflineResetMethod;
  value: number;
  /** Shows the calm line after a miss. A flag, never a count. */
  missed: boolean;
}

export function openGrownUpCheck(via: OfflineResetMethod, random?: () => number): GrownUpCheck {
  return { via, value: nextCheckNumber(random), missed: false };
}

export type GrownUpCheckOutcome = { passed: true; via: OfflineResetMethod } | { passed: false; check: GrownUpCheck };

/**
 * A right answer passes. A miss gives a new number and the calm line, and nothing else. An empty answer is no
 * answer: the check stays as it is.
 */
export function answerGrownUpCheck(check: GrownUpCheck, input: string, random?: () => number): GrownUpCheckOutcome {
  if (cleanCheckInput(input) === '') return { passed: false, check };
  if (checkAnswerMatches(check.value, input)) return { passed: true, via: check.via };
  return { passed: false, check: { via: check.via, value: nextCheckNumber(random, check.value), missed: true } };
}
