/**
 * Match Shape's origin pictures as their own registry (F-CURR-002 row CM-33), kept apart from `SCENE_ART_REGISTRY` and
 * the package barrel: they are never story-scene layers, and only the Match Shape chunk draws them. Every item passes
 * `checkItem`.
 */
import { SHAPE_ORIGIN_PROPS } from './props/shape-origins';
import type { Registry } from './resolve';

export const SHAPE_ORIGIN_REGISTRY: Registry = Object.freeze(Object.fromEntries(SHAPE_ORIGIN_PROPS.map((item) => [item.id, item])));

/** Raw JSON budget of the whole registry (about 5 KB today). */
export const SHAPE_ORIGIN_REGISTRY_RAW_MAX = 8 * 1024;
