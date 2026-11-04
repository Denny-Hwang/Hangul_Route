/**
 * The registry of the CM-47 realia dressings (F-CURR-002 row CM-47): the eight props of `props/realia-kinds.ts`.
 * Kept apart from `REALIA_REGISTRY` (and from the scene-art barrel) so the start bundle never carries them: the
 * lazy realia kinds chunk and the presenter import this file by its own path. Every item passes `checkItem`.
 */
import { REALIA_KIND_PROPS } from './props/realia-kinds';
import type { Registry } from './resolve';

export const REALIA_KIND_REGISTRY: Registry = Object.freeze(Object.fromEntries(REALIA_KIND_PROPS.map((item) => [item.id, item])));

/** Raw JSON budget of the CM-47 dressings, alt and accuracy notes included (the row's art budget; 6,873 B at the row). */
export const REALIA_KIND_REGISTRY_RAW_MAX = 8 * 1024;
