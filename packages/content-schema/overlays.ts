/**
 * `@hangul-route/content-schema/overlays`: the generated es / ko content overlays
 * (F-I18N-001 §3.6, open item (2)). Kept out of the package barrel so a consumer that
 * never translates content (the site, the Worker) does not bundle every Spanish and
 * Korean string; the learner app imports it here and passes it to `localize`.
 *
 * This file sits at the package root (not in `src/`) so the subpath resolves the same way
 * with and without `package.json` `exports` support (Metro in Expo SDK 52 reads the
 * path, Node / Vite / TypeScript read `exports`).
 *
 * The learner PWA (Metro's web build) reads `overlays.web.ts` instead: the same `OVERLAYS`, empty at
 * start and filled by `installContentOverlay` as the active locale's chunk arrives (F-CURR-002 §10).
 * Here both locales are in from the start, so installing one again only lays the same text over it.
 */
import type { OverlayLocale, Overlays } from './src/schemas/locale-overlay';
import { OVERLAYS } from './src/i18n-overlays.generated';

export { OVERLAYS };

/** Lays one locale's table into `OVERLAYS` (the learner PWA's locale chunk; see `overlays.web.ts`). */
export function installContentOverlay(locale: OverlayLocale, table: Overlays[OverlayLocale]): void {
  Object.assign(OVERLAYS[locale], table);
}
