/**
 * The vocabulary Speed Round (AMENDMENTS-FINISH-2026-11 FN-7): a chunk of its own, reached only through the literal `import()` of
 * `./speed-round-entry.tsx`, so the web build emits it as one precached bundle (`speed-round-chunk-<md5>.js`) and the start
 * bundle carries none of it. Never import this module statically.
 */

/** The chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const SPEED_ROUND_CHUNK = 'screen-chunk:speed-round';

export { VocabSpeedRoundScreen } from './VocabSpeedRoundScreen';
