import { CLOCK_SCALES, DEFAULT_CLOCK_SCALE, type ClockScale, type ProfileSettings } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { CLOCK_BASE_MS, clockBar, fewSecondsLeft, formatClock, type SpeedMode } from './session-clock';

/**
 * Challenge mode (F-VOC-004 S8, §3.5, §3.6, §3.8; PR S-6). Pure.
 *
 * Challenge is a per-profile opt-in (`ProfileSettings.challengeMode`, absent
 * = off) with a clock scale (absent = 1). It is never preselected for a
 * profile that has not opted in. The clock is one countdown for the whole
 * round; its view is digits rounded up, a bar in 1/60 steps and, in the last
 * ten seconds, static words: nothing blinks, pulses or turns red.
 */

export type ChallengeCopy = Messages['learner']['vocab']['speed']['challenge'];
export type ChallengeA11yCopy = Messages['a11y']['vocab']['speed'];

/** The calm "That's the time!" beat before the results (§3.6). */
export const TIME_UP_MS = 1_000;

export interface ChallengeSettings {
  on: boolean;
  scale: ClockScale;
}

/** The profile's Challenge opt-in and scale; absent fields read as off and 1 (S-1 amendment). */
export function challengeSettings(settings: ProfileSettings | undefined): ChallengeSettings {
  return { on: settings?.challengeMode ?? false, scale: settings?.clockScale ?? DEFAULT_CLOCK_SCALE };
}

/** The start sheet's first mode: Challenge only for a profile that opted in and a route that asks for it (S8). */
export function initialMode(on: boolean, requested: SpeedMode | undefined): SpeedMode {
  return on && requested === 'challenge' ? 'challenge' : 'relaxed';
}

/** The scale to use when Challenge is turned on: twice as long with a screen reader on (§3.8), else the stored one. */
export function scaleOnOptIn(stored: ClockScale, screenReader: boolean): ClockScale {
  return screenReader ? 2 : stored;
}

/** The three scales with their names, in order (§3.5). */
export function scaleOptions(copy: ChallengeCopy): Array<{ scale: ClockScale; label: string }> {
  const labels: Record<ClockScale, string> = { 1: copy.scale.normal, 1.5: copy.scale.longer, 2: copy.scale.twice };
  return CLOCK_SCALES.map((scale) => ({ scale, label: labels[scale] }));
}

/** "Adds a 60-second clock. ...": the clock an opt-in would give now (the stored scale, or 2x with a screen reader). */
export function tryChallengeLine(stored: ClockScale, screenReader: boolean, copy: ChallengeCopy): string {
  return copy.tryLine((CLOCK_BASE_MS * scaleOnOptIn(stored, screenReader)) / 1_000);
}

/** "One clock: 90 seconds for the whole round." */
export function challengeLine(scale: ClockScale, copy: ChallengeCopy): string {
  return copy.line((CLOCK_BASE_MS * scale) / 1_000);
}

export interface ClockView {
  /** "0:42", seconds rounded up. */
  digits: string;
  /** The bar's fill, 0..1 in 1/60 steps. */
  fill: number;
  /** "A few seconds left" in the last ten seconds, else `null`. */
  fewSeconds: string | null;
  /** "Time left: 42 seconds", read on focus only (never a live region). */
  label: string;
}

/** What the Challenge clock shows; `null` without a clock (Relaxed). */
export function clockView(
  remainingMs: number | null,
  totalMs: number | null,
  copy: ChallengeCopy,
  a11y: ChallengeA11yCopy,
): ClockView | null {
  if (remainingMs === null || totalMs === null) return null;
  const seconds = Math.ceil(Math.max(0, remainingMs) / 1_000);
  return {
    digits: formatClock(remainingMs),
    fill: clockBar(remainingMs, totalMs),
    fewSeconds: fewSecondsLeft(remainingMs) ? copy.fewSeconds : null,
    label: a11y.timeLeft(seconds),
  };
}

/** The wall time a pause lasted (the `resume` event's `pausedMs`), never negative; 0 when no pause began. */
export function pausedFor(pausedAt: number | null, now: number): number {
  return pausedAt === null ? 0 : Math.max(0, now - pausedAt);
}
