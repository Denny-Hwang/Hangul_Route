/**
 * Native stub of the root chooser (F-BROWSE-001 section 4.14, OD-10): native
 * builds have one root, the learner app. The web variant is
 * `app-root.web.ts`.
 */
export type AppRoot = 'browse' | 'app';

export function pickRoot(_location?: { pathname: string }): AppRoot {
  return 'app';
}
