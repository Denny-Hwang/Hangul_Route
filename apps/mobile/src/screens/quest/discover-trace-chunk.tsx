/**
 * The trace page of Discover (AMENDMENTS-STAGE1-TRACE-COVERAGE row TC-1b): the pad, its canvas and its rules, reached only
 * through the literal `import()` of `./discover-trace-entry.tsx`, so the web build emits it as one precached bundle
 * (`discover-trace-chunk-<md5>.js`) and the start bundle carries none of it (the canvas pulls the gesture handler and the
 * stroke tables). Never import this module statically.
 */

/** The chunk's marker (`SCREEN_CHUNKS` in scripts/pwa/lesson-chunks.mjs): the build finds it here and never in the start bundle. */
export const DISCOVER_TRACE_CHUNK = 'screen-chunk:discover-trace';

export { DiscoverTracePad } from './DiscoverTracePad';
