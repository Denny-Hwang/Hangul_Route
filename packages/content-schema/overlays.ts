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
 * The learner PWA (Metro's web build) gets empty tables at start, filled as the active locale's chunk
 * arrives (F-CURR-002 §10): `src/overlay-tables.ts` has a `.web.ts` twin behind the relative import
 * below, so the swap does not depend on how the bundler reads this subpath.
 */
export { installContentOverlay, OVERLAYS } from './src/overlay-tables';
