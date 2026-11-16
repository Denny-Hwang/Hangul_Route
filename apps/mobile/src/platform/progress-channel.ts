/**
 * [AU] Cross-tab progress writes (AMENDMENTS-AUDIT-2026-11 row AU-11). Native variant: one app, one window, so there
 * is no other tab to tell and nothing to listen to; Metro picks `progress-channel.web.ts` for the web build.
 */

/** Tells the other tabs that this tab stored a snapshot (no-op on native). */
export function postProgressChanged(): void {}

/** Calls `onChange` when another tab stored a snapshot or this page is back in front (no-op on native). */
export function subscribeProgressChanged(_onChange: () => void): () => void {
  return () => undefined;
}
