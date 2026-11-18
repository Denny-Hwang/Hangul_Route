/**
 * Sentence Builder (AMENDMENTS-FINISH-2026-11 FN-7): the game, its tiles and their motion, reached only through the
 * literal `import()` of `./sentence-builder-entry.tsx`, so the web build emits it as one precached bundle
 * (`sentence-builder-chunk-<md5>.js`) and the start bundle carries none of it. Never import this module statically.
 */

/** The chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const SENTENCE_BUILDER_CHUNK = 'screen-chunk:sentence-builder';

export { SentenceBuilderGame } from './SentenceBuilderGame';
