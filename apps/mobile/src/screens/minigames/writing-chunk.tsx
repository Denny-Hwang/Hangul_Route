/**
 * The typing games (AMENDMENTS-FINISH-2026-11 FN-7): Type Hangul and Write Frame, which shares Type Hangul's result
 * panel, reached only through the literal `import()` of `./writing-entry.tsx`, so the web build emits them as one
 * precached bundle (`writing-chunk-<md5>.js`) and the start bundle carries neither. Type Hangul's hear mode is the
 * dictation chunk's. Never import this module statically.
 */

/** The chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const WRITING_CHUNK = 'screen-chunk:writing';

export { TypeHangulGame } from './TypeHangulGame';
export { WriteFrameGame } from './WriteFrameGame';
