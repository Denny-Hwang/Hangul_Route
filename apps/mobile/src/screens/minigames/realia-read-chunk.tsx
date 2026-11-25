/**
 * Realia Read (F-A11Y-001 row AF-4b; the pattern of AMENDMENTS-FINISH-2026-11 FN-7): the game, its flow and its answer
 * feedback, reached only through the literal `import()` of `./realia-read-entry.tsx`, so the web build emits it as one
 * precached bundle (`realia-read-chunk-<md5>.js`) and the start bundle carries none of it. Never import this module statically.
 */

/** The chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const REALIA_READ_CHUNK = 'screen-chunk:realia-read';

export { RealiaReadGame } from './RealiaReadGame';
