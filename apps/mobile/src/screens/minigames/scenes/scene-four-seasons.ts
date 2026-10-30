/**
 * The Nature & Animals four-season scene's chunk (F-CURR-002 §5.5 S2 and §10, row CM-37 part 3): the scene description,
 * the setting and props it adds to the registry, its reference round and its note, reached only through the literal
 * `import()` of `../hidden-heritage-scenes.ts`. Their es and ko are the `scene:four-seasons` entry of
 * `content/i18n/<locale>/hidden-heritage.json`. Precached with the learner build; held to 25,000 B raw as built
 * (`sceneChunkRaw`).
 */
export { FOUR_SEASONS_SCENE as scene } from '@hangul-route/design-system/src/scene-art/hidden-heritage/four-seasons';

/** This chunk's marker: the post-build check fails a start bundle that carries it. */
export const SCENE_CHUNK = 'scene-chunk:four-seasons';
