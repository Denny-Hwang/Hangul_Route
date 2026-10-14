/**
 * The day boundary for a screen that stays mounted across midnight (F-ROUTE-001 R-7e). Plan day
 * keys are UTC calendar days (F-PLAN-002 section 3.6, `DateKeySchema`, assumption 6), so by
 * default the day turns over at UTC midnight whatever the device's time zone. Framework-free:
 * `screens/route/use-today.ts` wraps it in a hook, and the tests drive it with fake timers.
 */

import { localDay } from './vocab/progress';

const DAY_MS = 86_400_000;

/**
 * The longest single wait `watchDay` sets. A timer of many hours is unreliable on Android (Doze
 * and app standby can hold it back), and it is set from the device's zone and clock at that
 * moment, so a zone or clock change while the screen stays in front would leave it aimed at the
 * old midnight. Waking at least hourly re-reads the day and aims again; a wake before the
 * boundary emits nothing.
 */
export const MAX_WAIT_MS = 3_600_000;

/** The UTC day key (`YYYY-MM-DD`) of `now`, the same key as `dayKey(now.toISOString())`. */
export function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Milliseconds from `now` to the next UTC midnight (a full day at midnight itself). */
export function msUntilNextUtcDay(now: Date): number {
  const ms = now.getTime();
  return DAY_MS - (((ms % DAY_MS) + DAY_MS) % DAY_MS);
}

/**
 * Milliseconds from `now` to the next local midnight of the device (F-VOC-005 P5, P-3b). Measured
 * by the calendar, so a day with a daylight-saving change is 23 or 25 hours long.
 */
export function msUntilNextLocalDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** A day basis: how an instant is keyed and how long until that key changes. */
export interface DayBasis {
  readonly keyOf: (now: Date) => string;
  readonly msUntilNext: (now: Date) => number;
}

/**
 * The two day bases of the app: `utc` for plan days and the mission pin (F-PLAN-002 section 3.6,
 * F-HW-001 section 3.2), `local` for the vocabulary schedule and the Home vocabulary card
 * (F-VOC-005 P5, P-3b; the key is `logic/vocab/progress.ts` `localDay`).
 */
export const DAY_BASES: { readonly utc: DayBasis; readonly local: DayBasis } = {
  utc: { keyOf: utcDayKey, msUntilNext: msUntilNextUtcDay },
  local: { keyOf: localDay, msUntilNext: msUntilNextLocalDay },
};

type TimerHandle = ReturnType<typeof setTimeout> | number;

export interface WatchDayOptions {
  /** Called with the day at start, then each time it changes. */
  readonly onDay: (day: string) => void;
  /** The app's foreground signal (`platform/app-visibility`); returns the unsubscribe. */
  readonly subscribeVisibility: (listener: (visible: boolean) => void) => () => void;
  /** The day key of an instant; defaults to the UTC day. */
  readonly keyOf?: (now: Date) => string;
  /** Milliseconds to the next boundary of that key; defaults to the next UTC midnight. */
  readonly msUntilNext?: (now: Date) => number;
  /** Timer seams (tests); default to the global timers. */
  readonly setTimer?: (fn: () => void, ms: number) => TimerHandle;
  readonly clearTimer?: (handle: TimerHandle) => void;
}

/**
 * Watches the day: emits it at once, again at the next boundary (a timer, set again after each
 * boundary), and whenever the app comes back to the front (a suspended app's timer may not have
 * run). Starting it again, as a screen does on focus, reads the day afresh. A timer that fires
 * before the boundary emits nothing and waits for the time left, never more than `MAX_WAIT_MS` at
 * a time. Returns the stop function.
 */
export function watchDay(options: WatchDayOptions): () => void {
  const keyOf = options.keyOf ?? utcDayKey;
  const msUntilNext = options.msUntilNext ?? msUntilNextUtcDay;
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((handle: TimerHandle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let current: string | null = null;
  let timer: TimerHandle | null = null;
  let stopped = false;

  const read = (): void => {
    if (stopped) return;
    const now = new Date();
    const day = keyOf(now);
    if (day !== current) {
      current = day;
      options.onDay(day);
    }
    if (timer !== null) clearTimer(timer);
    timer = setTimer(read, Math.min(MAX_WAIT_MS, Math.max(1, msUntilNext(now))));
  };

  read();
  const unsubscribe = options.subscribeVisibility((visible) => {
    if (visible) read();
  });
  return () => {
    stopped = true;
    if (timer !== null) clearTimer(timer);
    timer = null;
    unsubscribe();
  };
}
