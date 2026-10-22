/**
 * `@hangul-route/i18n/messages-es`: the Spanish message overlay on its own, for the learner PWA's Spanish
 * locale chunk (`apps/mobile/src/content/locale-chunks/locale-es.ts`, F-CURR-002 §10). At the package root,
 * like `@hangul-route/content-schema/overlays`, so the subpath resolves the same way with and without
 * `package.json` `exports` support (Metro in Expo SDK 52 reads the path; Node, Vite and TypeScript read `exports`).
 */
export { es } from './src/messages/es/index';
