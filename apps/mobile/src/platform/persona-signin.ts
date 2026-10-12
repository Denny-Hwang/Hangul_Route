import type { PersonaChoice } from '../logic/shell/entry-points';

/**
 * Native stub of the Welcome persona row's sign-in (F-APP-001 section 3.6, OD-6): native builds
 * show no row, so nothing native calls it; it throws so a wrong call is caught in tests.
 */
export async function openPersonaSignIn(_choice: PersonaChoice): Promise<void> {
  throw new Error('The grown-up sign-in is web only (F-APP-001 OD-6)');
}
