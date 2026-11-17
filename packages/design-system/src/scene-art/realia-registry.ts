/**
 * The realia dressings' own registry (F-CURR-001 G-2). Kept apart from `SCENE_ART_REGISTRY`:
 * they dress the Realia Read sheet and are never story-scene layers, so they do not spend the
 * story registry's 200 KB budget (F-STORY-002 section 3.9.7). Every item passes `checkItem`.
 */
import { REALIA_PROPS } from './props/realia';
import type { ItemDef } from './types';

export const REALIA_REGISTRY: Readonly<Record<string, ItemDef>> = Object.freeze(Object.fromEntries(REALIA_PROPS.map((item) => [item.id, item])));

/** Raw JSON budget of the whole realia registry (about 7 KB today). */
export const REALIA_REGISTRY_RAW_MAX = 12 * 1024;
