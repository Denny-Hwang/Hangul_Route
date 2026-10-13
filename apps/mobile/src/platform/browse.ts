import type { BrowsePass } from '@hangul-route/content-schema';

/**
 * Native stub of the browse session pass (F-BROWSE-001 section 4.14, OD-10):
 * All lessons is web only, so a native build has no pass and writes none.
 * The web variant is `browse.web.ts`.
 */
export function readSessionPass(): BrowsePass | null {
  return null;
}

export function writeSessionPass(_pass: BrowsePass): boolean {
  return false;
}

export function removeSessionPass(): void {
  // Nothing to remove on native.
}

export function clearGrownUpSession(): void {
  // No grown-up tab state on native.
}
