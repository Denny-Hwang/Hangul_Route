/**
 * Trace Word (AMENDMENTS-FINISH-2026-11 FN-7): the game, its canvases and its rules, reached only through the literal
 * `import()` of `./trace-word-entry.tsx`, so the web build emits it as one precached bundle (`trace-word-chunk-<md5>.js`)
 * and the start bundle carries none of it. Never import this module statically.
 */

/** The chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const TRACE_WORD_CHUNK = 'screen-chunk:trace-word';

export { TraceWordGame } from './TraceWordGame';
