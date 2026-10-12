import type { OnlineListener } from './online';

export type { OnlineListener };

/**
 * The browser's network state for the grown-up entries (F-APP-001 sections 3.6 and 3.12): the
 * Welcome row, the Profile row and the dashboard card are disabled with "Needs the internet" while
 * `navigator.onLine` is false, and re-enable on the `online` event. A browser that does not say
 * counts as online (the page load then decides; the offline page is the fallback).
 */
export function isOnline(): boolean {
  const g = globalThis as { navigator?: { onLine?: boolean } };
  return g.navigator?.onLine !== false;
}

export function subscribeOnline(listener: OnlineListener): () => void {
  const w = globalThis as {
    addEventListener?: (type: string, handler: () => void) => void;
    removeEventListener?: (type: string, handler: () => void) => void;
  };
  if (typeof w.addEventListener !== 'function') return () => undefined;
  const onOnline = (): void => listener(true);
  const onOffline = (): void => listener(false);
  w.addEventListener('online', onOnline);
  w.addEventListener('offline', onOffline);
  return () => {
    w.removeEventListener?.('online', onOnline);
    w.removeEventListener?.('offline', onOffline);
  };
}
