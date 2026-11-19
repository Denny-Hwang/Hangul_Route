/**
 * The level check (its host, the nested stack of its screens and the flow they render) (AMENDMENTS-FINISH-2026-11 FN-7): a chunk of its own, reached only through the literal `import()` of
 * `./placement-entry.tsx`, so the web build emits it as one precached bundle (`placement-chunk-<md5>.js`) and the start
 * bundle carries none of it. Never import this module statically.
 */

/** The chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const PLACEMENT_CHUNK = 'screen-chunk:placement';

export { PlacementScreen } from './PlacementScreen';
