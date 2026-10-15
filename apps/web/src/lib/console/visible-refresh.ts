/**
 * Console pages read the roster and a learner's report when they open. A tab left open would keep the old values
 * (a learner renamed on their device, a new practice day), so the pages read them again (F-LEARN-001 section 3.11,
 * F-CONSOLE-001):
 *
 * - when the tab comes back into view (`visibilitychange` to `visible`);
 * - when the window gets focus or is shown again (`focus`, `pageshow`): on a desktop, moving between two windows
 *   side by side never changes `visibilityState`;
 * - on a roster page, also every `VISIBLE_POLL_MS` while the tab is in view (a classroom screen that stays in front).
 *
 * Every trigger shares one gap: at most one read every 30 seconds. Each read of a report records one `report.viewed`
 * on the Worker, so report pages never poll, and the gap keeps that count calm.
 */
export const VISIBLE_REFRESH_GAP_MS = 30_000;
/** The slow read while a roster tab stays in view. */
export const VISIBLE_POLL_MS = 90_000;

/** The parts of `window` the watcher reads: easy to fake in a unit test. */
export interface RefreshEvents {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** The parts of `document` the watcher reads. */
export interface VisibilitySource extends RefreshEvents {
  readonly visibilityState: string;
}

export interface VisibleRefreshOptions {
  now?: () => number;
  gapMs?: number;
  /** The window, for `focus` and `pageshow`; none in a test that has no window. */
  win?: RefreshEvents | null;
  /** A slow read while the tab is in view, in ms; none by default. */
  pollMs?: number | null;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
}

const WINDOW_EVENTS = ['focus', 'pageshow'] as const;

/**
 * Calls `refresh` on each trigger above while `source` is visible and at least `gapMs` passed since the page last read
 * (the page's own load counts: the clock starts when the watcher starts). Returns the function that stops watching.
 */
export function watchVisibleRefresh(source: VisibilitySource, refresh: () => void, options: VisibleRefreshOptions = {}): () => void {
  const now = options.now ?? Date.now;
  const gapMs = options.gapMs ?? VISIBLE_REFRESH_GAP_MS;
  const win = options.win ?? null;
  let last = now();
  const onTrigger = (): void => {
    if (source.visibilityState !== 'visible') return;
    const at = now();
    if (at - last < gapMs) return;
    last = at;
    refresh();
  };
  source.addEventListener('visibilitychange', onTrigger);
  for (const type of WINDOW_EVENTS) win?.addEventListener(type, onTrigger);
  const pollMs = options.pollMs ?? null;
  const startTimer = options.setInterval ?? ((fn: () => void, ms: number): unknown => globalThis.setInterval(fn, ms));
  const stopTimer = options.clearInterval ?? ((handle: unknown): void => globalThis.clearInterval(handle as ReturnType<typeof setInterval>));
  const timer = pollMs !== null && pollMs > 0 ? startTimer(onTrigger, pollMs) : null;
  return () => {
    source.removeEventListener('visibilitychange', onTrigger);
    for (const type of WINDOW_EVENTS) win?.removeEventListener(type, onTrigger);
    if (timer !== null) stopTimer(timer);
  };
}
