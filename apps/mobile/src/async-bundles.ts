/**
 * Metro's bundle loader (`__loadBundleAsync`), which the lesson manifest's literal `import()`s need on the web:
 * Metro emits each lesson chunk as its own web bundle and loads it through this loader, by a script tag
 * (F-CURR-002 §10, the CM-5 decision record). Expo Router installs it with all of `@expo/metro-runtime`;
 * this app takes only the loader, so nothing else of that runtime (its native `window.location`) changes.
 * A native build keeps every chunk in its one bundle, where the loader only serves the dev server's lazy
 * bundles. Imported first by `index.ts`. A `require`, so the type check stays out of that package's sources.
 */
require('@expo/metro-runtime/src/async-require');

export {};
