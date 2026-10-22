/**
 * [OA] Cross-tab profile list changes (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19, row OA-4a). Native variant: one
 * app, one window, so there is no other tab to tell and nothing to listen to; Metro picks `profiles-channel.web.ts`
 * for the web build.
 */

/** Tells the other tabs that `hr:profiles` changed (no-op on native). */
export function postProfilesChanged(): void {}

/** Calls `onChange` when another tab changed the list or this page is back in front (no-op on native). */
export function subscribeProfilesChanged(_onChange: () => void): () => void {
  return () => undefined;
}
