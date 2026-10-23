/**
 * Story Order's chunk (F-CURR-002 section 10, row CM-34): the game screen, reached only through the literal `import()`
 * of `./StoryOrderStep.tsx`, so the web build emits it as one precached bundle (`order-game-chunk-<md5>.js`; not `story-`, the story chunks' prefix (row CM-8)) and the
 * start bundle carries none of it. Its rules (`logic/story-order/story-order-player.ts`, `story-order-view.ts`) ride in
 * it; Story Sequence's player and the shared components stay in the start bundle, which already holds them.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const STORY_ORDER_CHUNK = 'screen-chunk:story-order';

export { StoryOrderGame } from './StoryOrderGame';
