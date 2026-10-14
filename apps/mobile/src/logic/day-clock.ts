/**
 * The day boundary for a screen that stays mounted across midnight (F-ROUTE-001 R-7e). Plan day
 * keys are UTC calendar days (F-PLAN-002 section 3.6, `DateKeySchema`, assumption 6), so by
 * default the day turns over at UTC midnight whatever the device's time zone. Framework-free:
 * `screens/route/use-today.ts` wraps it in a hook, and the tests drive it with fake timers.
 */

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
