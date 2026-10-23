/**
 * My Story's chunk (F-CURR-002 §7.1 F8 and §10, row CM-38): the game's screen and its My page, reached only through
 * the literal `import()` of `./my-story-entry.tsx`, so the web build emits it as one precached bundle
 * (`my-story-chunk-<md5>.js`) and the start bundle carries none of it. Write Frame, which plays each frame, is in the
 * start bundle already (and its fallback, `logic/my-story/fallback.ts`), so no module sits in two chunks.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const MY_STORY_CHUNK = 'screen-chunk:my-story';

export { MyStoryGame } from './MyStoryGame';
/**
 * The fixture chain of the fixture build's e2e (`navigation/write-frame-e2e.tsx`, `story`), here rather than in the
 * start bundle, which every build carries (the e2e hosts are registered only in the fixture build, but their modules
 * ship in every bundle). Test data: no lesson reads it.
 */
export { FIXTURE_CHAIN } from '../../logic/my-story/e2e-chain';
