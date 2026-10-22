/**
 * The content overlay tables behind `@hangul-route/content-schema/overlays` (`../overlays.ts`): both
 * locales in from the start, for every consumer but the learner PWA. Installing one again only lays
 * the same text over it.
 *
 * The learner PWA (Metro's web build) resolves this relative import to `overlay-tables.web.ts`
 * instead: the same `OVERLAYS`, empty at start and filled by `installContentOverlay` as the active
 * locale's chunk arrives (F-CURR-002 §10). The twin sits behind a relative import, not on the
 * package root's subpath file, so Metro picks it whether or not it reads `package.json` `exports`
 * (an `exports` target is used as written, with no platform extension; a relative import always
 * gets one), as `@hangul-route/i18n`'s `bundled-messages` does.
 */
import { OVERLAYS } from './i18n-overlays.generated';
import type { OverlayLocale, Overlays } from './schemas/locale-overlay';

export { OVERLAYS };

/** Lays one locale's table into `OVERLAYS` (the learner PWA's locale chunk; see `overlay-tables.web.ts`). */
export function installContentOverlay(locale: OverlayLocale, table: Overlays[OverlayLocale]): void {
  Object.assign(OVERLAYS[locale], table);
}
