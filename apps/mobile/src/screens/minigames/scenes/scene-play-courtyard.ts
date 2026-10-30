/**
 * The Play & Crafts courtyard scene's chunk (F-CURR-002 §5.6 S2 and §10, row CM-37 part 4): the scene description, the
 * setting and props it adds to the registry, its reference round and its note, reached only through the literal
 * `import()` of `../hidden-heritage-scenes.ts`. Precached with the learner build; held to 25,000 B raw as built
 * (`sceneChunkRaw`). Its es and ko strings are in `content/i18n/<locale>/hidden-heritage.json`.
 */
export { PLAY_COURTYARD_SCENE as scene } from '@hangul-route/design-system/src/scene-art/hidden-heritage/play-courtyard';

/** This chunk's marker: the post-build check fails a start bundle that carries it. */
export const SCENE_CHUNK = 'scene-chunk:play-courtyard';
