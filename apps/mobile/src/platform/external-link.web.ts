import { isSafeHttpsUrl } from '../logic/story/safe-url';
import type { OpenLinkOutcome } from '../logic/story/source-link';

/**
 * Web: a browser may block a tab that is not opened inside a tap, so a link
 * waiting on the grown-up gate is never opened by itself on return; Sources
 * asks for one more tap of Open link instead (`pendingLinkStep`).
 */
export const HAND_OFF_NEEDS_TAP = true;

type TabHandle = { opener: unknown } | null;

/**
 * Web: a new tab, opened synchronously inside the tap (F-STORY-002 §7
 * assumption 1 fallback). Not with the `noopener` feature: with it
 * `window.open` returns null even when the tab opens, so a blocked pop-up
 * would look like success. Instead the handle is checked (null = blocked:
 * 'failed', and Sources shows "Open this link in a browser: <url>") and its
 * `opener` is cleared at once, before the cross-origin page can run, so the
 * page gets no handle back to the app. The browser's default referrer policy
 * sends that page the app's origin only. Offline, nothing opens and the
 * caller says a connection is needed.
 */
export async function openExternalUrl(url: string): Promise<OpenLinkOutcome> {
  if (!isSafeHttpsUrl(url)) return 'failed';
  const g = globalThis as { navigator?: { onLine?: boolean }; open?: (url: string, target: string) => TabHandle };
  if (g.navigator?.onLine === false) return 'offline';
  if (typeof g.open !== 'function') return 'failed';
  let tab: TabHandle;
  try {
    tab = g.open(url, '_blank');
  } catch {
    return 'failed';
  }
  if (!tab) return 'failed';
  try {
    tab.opener = null;
  } catch {
    // A browser that will not let the opener be cleared has opened the tab all the same.
  }
  return 'opened';
}
