/**
 * The browse root's address and exits on the web (F-BROWSE-001 sections 4.1
 * and 4.4). A deep link carries content ids only, in the fragment; the root
 * reads it and replaces the address with `/browse` before first paint, so the
 * link leaves neither the address bar nor the history (a fragment never
 * reaches a server). A later `hashchange` (a second link while the tab is
 * open) is read the same way. Every browser call is guarded: a missing or
 * refusing API never throws.
 */
interface BrowserLike {
  location?: { hash?: string; origin?: string; assign?: (url: string) => void };
  history?: { replaceState?: (state: unknown, unused: string, url: string) => void; back?: () => void };
  document?: { referrer?: string };
  navigator?: { onLine?: boolean };
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

const BROWSE_PATH = '/browse';

function browser(): BrowserLike {
  return globalThis as BrowserLike;
}

function stripAddress(): void {
  try {
    browser().history?.replaceState?.(null, '', BROWSE_PATH);
  } catch {
    // A sandboxed frame may refuse; the fragment is still read once.
  }
}

function currentHash(): string {
  try {
    return browser().location?.hash ?? '';
  } catch {
    return '';
  }
}

/** The fragment the page was opened with (`''` when none); the address becomes `/browse`. */
export function takeFragment(): string {
  const raw = currentHash();
  stripAddress();
  return raw;
}

/** Calls `handler` with each later fragment, after taking it out of the address; returns the unsubscribe. */
export function onFragmentChange(handler: (raw: string) => void): () => void {
  const w = browser();
  if (typeof w.addEventListener !== 'function') return () => undefined;
  const listener = (): void => {
    const raw = currentHash();
    // Taking the fragment out of the address is not a new link.
    if (raw === '' || raw === '#') return;
    stripAddress();
    handler(raw);
  };
  w.addEventListener('hashchange', listener);
  return () => w.removeEventListener?.('hashchange', listener);
}

/** Whether the tab came to `/browse` from a page of this origin (then Close goes back to it). */
export function cameFromSameOrigin(): boolean {
  try {
    const w = browser();
    const referrer = w.document?.referrer ?? '';
    const origin = w.location?.origin ?? '';
    if (referrer === '' || origin === '') return false;
    return new URL(referrer).origin === origin;
  } catch {
    return false;
  }
}

/** Leaves All lessons for `url` in this tab. */
export function leaveTo(url: string): void {
  try {
    browser().location?.assign?.(url);
  } catch {
    // Nothing more to do: the page stays.
  }
}

/** Back to the page the tab came from. */
export function goBack(): void {
  try {
    browser().history?.back?.();
  } catch {
    // Nothing more to do: the page stays.
  }
}

/** `navigator.onLine`; a browser that does not say counts as online. */
export function isOnline(): boolean {
  try {
    return browser().navigator?.onLine !== false;
  } catch {
    return true;
  }
}
