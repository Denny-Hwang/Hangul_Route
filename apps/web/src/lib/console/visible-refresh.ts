/**
 * Console pages read the roster and a learner's report when they open. A tab left open would keep the old values
 * (a learner renamed on their device, a new practice day), so the pages read them again when the tab comes back into
 * view (`visibilitychange` to `visible`), at most once every 30 seconds (F-LEARN-001 section 3.11, F-CONSOLE-001).
 * Each read of a report records one `report.viewed` on the Worker, so the gap also keeps that count calm.
 */
export const VISIBLE_REFRESH_GAP_MS = 30_000;

/** The parts of `document` the watcher reads: easy to fake in a unit test. */
export interface VisibilitySource {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/**
 * Calls `refresh` when `source` turns visible and at least `gapMs` passed since the page last read (the page's own
 * load counts: the clock starts when the watcher starts). Returns the function that stops watching.
 */
export function watchVisibleRefresh(source: VisibilitySource, refresh: () => void, now: () => number = Date.now, gapMs: number = VISIBLE_REFRESH_GAP_MS): () => void {
  let last = now();
  const onChange = (): void => {
    if (source.visibilityState !== 'visible') return;
    const at = now();
    if (at - last < gapMs) return;
    last = at;
    refresh();
  };
  source.addEventListener('visibilitychange', onChange);
  return () => source.removeEventListener('visibilitychange', onChange);
}
