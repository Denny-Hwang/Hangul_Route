/**
 * Whether the page is in front of the learner (F-REPORT-001 section 3.3.2,
 * RP-3b), for the web build. `pagehide` and `visibilitychange` to hidden are
 * hidden (the PWA's close paths on Chromium and WebKit); `visibilitychange`
 * to visible and `pageshow` (a page restored from the back/forward cache)
 * are visible. A write on `pagehide` is best effort: a lost end leaves an
 * orphan, which counts 0 minutes. Same surface as `app-visibility.ts`;
 * returns the unsubscribe.
 */
export function subscribeAppVisibility(listener: (visible: boolean) => void): () => void {
  const win = globalThis as unknown as Window;
  const doc = (globalThis as { document?: Document }).document;
  if (typeof win.addEventListener !== 'function' || typeof win.removeEventListener !== 'function' || doc === undefined) {
    return () => undefined;
  }
  const onVisibility = (): void => listener(doc.visibilityState !== 'hidden');
  const onHide = (): void => listener(false);
  const onShow = (): void => listener(true);
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pagehide', onHide);
  win.addEventListener('pageshow', onShow);
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('pagehide', onHide);
    win.removeEventListener('pageshow', onShow);
  };
}

/** Whether the page is in front now: hidden only when the document says so; no document counts as in front. */
export function isAppVisible(): boolean {
  const doc = (globalThis as { document?: Document }).document;
  return doc?.visibilityState !== 'hidden';
}
