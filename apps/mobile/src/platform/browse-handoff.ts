import type { BrowseTarget } from '@hangul-route/content-schema';

/**
 * Native stub of the All lessons gate hand-off (F-BROWSE-001 section 4.14, OD-10): All lessons is web only, so
 * native builds draw no [ Open all lessons ] or [ Preview lessons ] control and this writes nothing. The web
 * variant is `browse-handoff.web.ts`.
 */
export function openBrowseFromGate(_target?: BrowseTarget): boolean {
  return false;
}
