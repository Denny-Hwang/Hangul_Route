/**
 * The scene-art registry (F-STORY-002 §3.9.4): every item a scene may name.
 * PR 2.3a seeds it with Hoya's five poses; the first settings and props arrive
 * with the library batches (PR 2.3b, 2.10a-d), each a new entry here.
 */
import { HOYA_POSES, hoyaItem } from './hoya';
import type { Registry } from './resolve';

export const SCENE_ART_REGISTRY: Registry = Object.freeze(Object.fromEntries(HOYA_POSES.map((pose) => [`hoya:${pose}`, hoyaItem(pose)])));

/** Whether a `setting` or layer `ref` names a registered item. */
export function hasItem(ref: string): boolean {
  return Object.hasOwn(SCENE_ART_REGISTRY, ref);
}
