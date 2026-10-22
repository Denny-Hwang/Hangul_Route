/**
 * Native stub of the join hand-off (F-APP-001 sections 3.6 and 3.8): the family home that writes
 * it is on the web app host, in the same tab as the learner app, so a native build never has one.
 * The web variant is `join-handoff.web.ts`.
 */
export function takeJoinHandoff(): string | null {
  return null;
}

/** [GU] Row GU-3: no hand-off on native. */
export function hasJoinHandoff(): boolean {
  return false;
}
