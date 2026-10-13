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
  history?: { replaceState?: (state: unknown, unused: string, url: string) => void; go?: (delta: number) => void; length?: number; state?: unknown };
  document?: {
    referrer?: string;
    visibilityState?: string;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  };
  navigator?: { onLine?: boolean };
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
  setTimeout?: (fn: () => void, ms: number) => unknown;
}

const BROWSE_PATH = '/browse';
/**
 * How long [ Close ] waits, after going back, for the page to start leaving
 * (`beforeunload` fires when a traversal to another document starts, before its
 * network fetch; `pagehide` when it unloads) before it leaves by address instead.
 */
const BACK_FALLBACK_MS = 1000;

function browser(): BrowserLike {
  return globalThis as BrowserLike;
}

/**
 * The history entries this page added after the one it opened on: each later
 * link (`hashchange`) pushes one. Kept on the entry's own state
 * (`{ hrBrowseDepth }`), so a reload and a back or forward inside the page read
 * it again; [ Close ] goes back past all of them.
 */
let depth = 0;

function depthOf(state: unknown): number {
  const value = (state as { hrBrowseDepth?: unknown } | null | undefined)?.hrBrowseDepth;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function stripAddress(): void {
  try {
    browser().history?.replaceState?.({ hrBrowseDepth: depth }, '', BROWSE_PATH);
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
  try {
    depth = depthOf(browser().history?.state);
  } catch {
    depth = 0;
  }
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
    depth += 1;
    stripAddress();
    handler(raw);
  };
  const onPop = (): void => {
    try {
      depth = depthOf(w.history?.state);
    } catch {
      depth = 0;
    }
  };
  w.addEventListener('hashchange', listener);
  w.addEventListener('popstate', onPop);
  return () => {
    w.removeEventListener?.('hashchange', listener);
    w.removeEventListener?.('popstate', onPop);
  };
}

/** Whether the tab came to `/browse` from a page of this origin. */
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

/**
 * Whether [ Close ] can go back to the page the tab came from: a referrer on
 * this origin and an entry before this page in the tab's history. A new tab
 * opened from a console page has the referrer but nothing to go back to.
 */
export function canGoBack(): boolean {
  try {
    const length = browser().history?.length;
    return cameFromSameOrigin() && typeof length === 'number' && length > 1 + depth;
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

/**
 * Back to the page the tab came from, past the entries later links added. When
 * the page has not started to leave shortly after (a history that goes
 * nowhere), it leaves for `fallbackUrl` instead, so Close is never a dead button.
 */
export function goBack(fallbackUrl: string): void {
  const w = browser();
  let left = false;
  const onHide = (): void => {
    left = true;
  };
  try {
    w.addEventListener?.('beforeunload', onHide);
    w.addEventListener?.('pagehide', onHide);
    w.setTimeout?.(() => {
      w.removeEventListener?.('beforeunload', onHide);
      w.removeEventListener?.('pagehide', onHide);
      if (!left) leaveTo(fallbackUrl);
    }, BACK_FALLBACK_MS);
    w.history?.go?.(-(1 + depth));
  } catch {
    // The timer, when it was set, still leaves by address.
  }
}

/**
 * Calls `handler` when the tab is shown again or the window gains focus;
 * returns the unsubscribe. `visibilitychange` is fired at the document, so it
 * is heard there (as every other caller in the app does); `focus` on the window.
 */
export function onPageVisible(handler: () => void): () => void {
  const w = browser();
  if (typeof w.addEventListener !== 'function') return () => undefined;
  const doc = w.document;
  const onVisibility = (): void => {
    if (doc?.visibilityState === 'visible') handler();
  };
  try {
    doc?.addEventListener?.('visibilitychange', onVisibility);
  } catch {
    // A document that refuses listeners still has the window's focus.
  }
  w.addEventListener('focus', handler);
  return () => {
    try {
      doc?.removeEventListener?.('visibilitychange', onVisibility);
    } catch {
      // Nothing was added.
    }
    w.removeEventListener?.('focus', handler);
  };
}

/** `navigator.onLine`; a browser that does not say counts as online. */
export function isOnline(): boolean {
  try {
    return browser().navigator?.onLine !== false;
  } catch {
    return true;
  }
}
