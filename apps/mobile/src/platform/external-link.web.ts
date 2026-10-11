import { isSafeHttpsUrl, type OpenLinkOutcome } from '../logic/story/source-link';

/**
 * Web: a new tab with `noopener,noreferrer` (F-STORY-002 §7 assumption 1
 * fallback): the opened page gets no handle back to the app and no referrer.
 * `window.open` returns null with `noopener` even when the tab opens, so only
 * a throw or a missing `open` counts as a failure; the link also stays on
 * screen as selectable text with Copy link. Offline, nothing opens and the
 * caller says a connection is needed.
 */
export async function openExternalUrl(url: string): Promise<OpenLinkOutcome> {
  if (!isSafeHttpsUrl(url)) return 'failed';
  const g = globalThis as { navigator?: { onLine?: boolean }; open?: (url: string, target: string, features: string) => unknown };
  if (g.navigator?.onLine === false) return 'offline';
  if (typeof g.open !== 'function') return 'failed';
  try {
    g.open(url, '_blank', 'noopener,noreferrer');
    return 'opened';
  } catch {
    return 'failed';
  }
}
