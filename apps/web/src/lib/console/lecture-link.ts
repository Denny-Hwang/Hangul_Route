/**
 * Console -> presenter hand-off, the console half (F-TCH-004 §3.2). The deck
 * rides in the link's fragment only. The helper picker is gone (LV-H), so the
 * console hands nothing over after the link: [ Open presenter ] opens a new tab
 * with no handle back to this page (the opener is cleared at once, as
 * `noopener` would, but the handle still tells a blocked pop-up apart).
 */

type OpenedTab = { opener?: unknown } | null | undefined;

export type OpenResult = { ok: true } | { ok: false };

/** Opens the presenter in a new tab from the click; `ok: false` when the browser blocked the pop-up. */
export function openPresenter(host: { open(url: string, target: string): unknown }, url: string): OpenResult {
  // Not the `noopener` feature: with it `window.open` returns null even when the tab opens.
  const win = host.open(url, '_blank') as OpenedTab;
  if (win === null || win === undefined) return { ok: false };
  try {
    win.opener = null;
  } catch {
    // A browser that will not let the opener be cleared has opened the tab all the same.
  }
  return { ok: true };
}
