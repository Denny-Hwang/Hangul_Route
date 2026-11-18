/**
 * Join a class (the code, the class and the batch of learners) (AMENDMENTS-FINISH-2026-11 FN-7): a chunk of its own, reached only through the literal `import()` of
 * `./join-space-entry.tsx`, so the web build emits it as one precached bundle (`join-space-chunk-<md5>.js`) and the start
 * bundle carries none of it. Never import this module statically.
 */

/** The chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const JOIN_SPACE_CHUNK = 'screen-chunk:join-space';

export { JoinSpaceScreen } from './JoinSpaceScreen';
