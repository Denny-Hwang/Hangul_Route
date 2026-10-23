/**
 * `@hangul-route/content-schema/memory` (F-CURR-002 §4.8, row CM-11): the memory wire contract and merge, kept out of
 * the package barrel. At the package root, as `overlays.ts` is, so Metro (which reads the path, not `exports`) finds
 * it; row CM-12's memory store chunk is the app's reader.
 */
export * from './src/memory/memory-sync';
