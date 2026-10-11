/**
 * The scene-art registry (F-STORY-002 §3.9.4): every item a scene may name.
 * PR 2.3a seeded it with Hoya's five poses; PR 2.3b adds the first library
 * batch (3 settings, 13 props) for the flagship stories. Later batches
 * (PR 2.10a-d) each add entries here.
 */
import { HOYA_POSES, hoyaItem } from './hoya';
import { BOOK_THREAD_BOUND, BOOKS_CASE, DOCUMENT_BOX } from './props/books';
import { FIG_CHILD, FIG_GRANDMOTHER, FIG_HISTORIAN, FIG_KING, FIG_OFFICIAL, FIG_SCHOLAR, FIG_VILLAGER } from './props/people';
import { DESK_LOW, WRITING_LINES, WRITING_SET } from './props/writing';
import type { Registry } from './resolve';
import { PALACE_COURTYARD } from './settings/palace-courtyard';
import { PALACE_HALL } from './settings/palace-hall';
import { VILLAGE_LANE } from './settings/village-lane';
import type { ItemDef } from './types';

const LIBRARY: readonly ItemDef[] = [
  PALACE_COURTYARD,
  PALACE_HALL,
  VILLAGE_LANE,
  FIG_KING,
  FIG_OFFICIAL,
  FIG_SCHOLAR,
  FIG_HISTORIAN,
  FIG_VILLAGER,
  FIG_GRANDMOTHER,
  FIG_CHILD,
  DESK_LOW,
  WRITING_SET,
  WRITING_LINES,
  BOOK_THREAD_BOUND,
  BOOKS_CASE,
  DOCUMENT_BOX,
];

export const SCENE_ART_REGISTRY: Registry = Object.freeze({
  ...Object.fromEntries(HOYA_POSES.map((pose) => [`hoya:${pose}`, hoyaItem(pose)])),
  ...Object.fromEntries(LIBRARY.map((item) => [item.id, item])),
});

/** Whether a `setting` or layer `ref` names a registered item. */
export function hasItem(ref: string): boolean {
  return Object.hasOwn(SCENE_ART_REGISTRY, ref);
}
