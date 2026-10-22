/**
 * `@hangul-route/content-schema/review-items` (F-CURR-002 §4.2, row CM-10): the review-item model, kept out of the
 * package barrel. This file sits at the package root, as `overlays.ts` does, so the subpath resolves the same way with
 * and without `package.json` `exports` support (Metro in Expo SDK 52 reads the path; Node, Vite and TypeScript read
 * `exports`). Row CM-12's memory store is the app's first reader (its own lazy chunk).
 */
export * from './src/review-items/review-item';
