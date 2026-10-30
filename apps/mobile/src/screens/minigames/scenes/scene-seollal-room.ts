/**
 * The Seollal room scene's chunk (F-CURR-002 §10 and row CM-37 part 2, Holidays & Traditions): the scene description,
 * the setting and props it adds to the registry, its reference round, its note and its es / ko text, reached only through
 * the literal `import()` of `../hidden-heritage-scenes.ts`. Precached with the learner build; held to 25,000 B raw as
 * built (`sceneChunkRaw`).
 */
export { SEOLLAL_ROOM_SCENE as scene } from '@hangul-route/design-system/src/scene-art/hidden-heritage/seollal-room';

/** This chunk's marker: the post-build check fails a start bundle that carries it. */
export const SCENE_CHUNK = 'scene-chunk:seollal-room';
