/**
 * The story reader (AMENDMENTS-FINISH-2026-11 FN-7): `StoryReaderView`, its scene view, audio plan and reader state,
 * reached only through the literal `import()` of `./reader-entry.tsx`, so the web build emits it as one precached
 * bundle (`reader-chunk-<md5>.js`; not `story-`, the story chunks' prefix) and the start bundle carries none of it.
 * Its readers are the story reader route and the quest's Story Read step. Never import this module statically.
 */

/** The chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const STORY_READER_CHUNK = 'screen-chunk:story-reader';

export { StoryReaderView } from './StoryReaderView';
