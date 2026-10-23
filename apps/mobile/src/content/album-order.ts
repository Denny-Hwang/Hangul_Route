import type { StageKey, ThemeKey } from '@hangul-route/content-schema';

/**
 * The order of the five category albums (F-CURR-002 §7.2, row CM-23; content/upper-cell-cards.ts lists their cards).
 * Only the upper-cards chunk (screens/library/upper-cards-chunk.tsx) and the tests read this file, so the start bundle
 * does not carry it (row CM-23 part 2 moved it out of upper-cell-cards.ts).
 */
/** The stages whose cells fill the albums, in album order (Stage 5 is the books). */
export const ALBUM_STAGES: readonly StageKey[] = ['stage2', 'stage3', 'stage4', 'stage6', 'stage7'];

/** The albums in Library order: the Journey's theme order. */
export const ALBUM_THEMES: readonly ThemeKey[] = ['letters', 'life', 'rites', 'nature', 'crafts'];
