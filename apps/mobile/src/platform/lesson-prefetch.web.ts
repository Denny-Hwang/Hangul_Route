/**
 * Background load of every lesson chunk once the first screen is up (F-CURR-002 §10). The chunks left
 * the start bundle so the first screen comes sooner; once it is up they load anyway, from the
 * precache (27 small reads), so a session that started online keeps every lesson when the network
 * goes, when no worker controls the page (the iOS 14 home-screen app) and when another tab applies an
 * update that drops this build's chunks. A failed load is left for the lesson that needs it, and the
 * next call (back online) tries again. `requestIdleCallback` where there is one (not in Safari),
 * else a short timer.
 */
export const PREFETCH_FALLBACK_MS = 1_500;
export const PREFETCH_IDLE_TIMEOUT_MS = 5_000;

interface IdleHost {
  requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
}

export function prefetchWhenIdle(load: () => Promise<void>, host: IdleHost = globalThis as unknown as IdleHost): () => void {
  const run = (): void => {
    load().catch(() => undefined);
  };
  if (typeof host.requestIdleCallback === 'function') {
    const handle = host.requestIdleCallback(run, { timeout: PREFETCH_IDLE_TIMEOUT_MS });
    return () => host.cancelIdleCallback?.(handle);
  }
  const timer = setTimeout(run, PREFETCH_FALLBACK_MS);
  return () => clearTimeout(timer);
}
