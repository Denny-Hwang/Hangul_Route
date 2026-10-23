/**
 * The Food market scene's chunk (F-CURR-002 §10 and row CM-36): the scene description, the setting and props it adds to
 * the registry, its reference round and its note, reached only through the literal `import()` of
 * `../hidden-heritage-scenes.ts`. Precached with the learner build; held to 25,000 B raw as built (`sceneChunkRaw`).
 */
export { FOOD_MARKET_SCENE as scene } from '@hangul-route/design-system/src/scene-art/hidden-heritage/food-market';

/** This chunk's marker: the post-build check fails a start bundle that carries it. */
export const SCENE_CHUNK = 'scene-chunk:food-market';
