/**
 * The level check (its host, the nested stack of its screens and the flow they render) (AMENDMENTS-FINISH-2026-11 FN-7): a chunk of its own, reached only through the literal `import()` of
 * `./placement-entry.tsx`, so the web build emits it as one precached bundle (`placement-chunk-<md5>.js`) and the start
 * bundle carries none of it. Never import this module statically.
 */
import { loadActWordArt } from '@hangul-route/design-system/src/word-art/glyphs/act';

/** The chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const PLACEMENT_CHUNK = 'screen-chunk:placement';

// [PV] The sentence items' action pictures (AMENDMENTS-PLC-VALIDITY PV-1a) load with this chunk, by the file's own path
// (Metro resolves it without `exports`; see logic/__tests__/metro-subpaths.test.ts), so the start bundle carries none.
loadActWordArt();

export { PlacementScreen } from './PlacementScreen';
