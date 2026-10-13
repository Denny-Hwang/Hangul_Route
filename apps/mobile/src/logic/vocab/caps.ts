import { MinigameKindSchema } from '@hangul-route/content-schema';

/**
 * What this build can offer on the topic page — F-VOC-003 section 3.4. Match
 * is shown only when F-QUEST-002's Pic-Word Match exists in the build
 * (`MinigameKindSchema` has `'pic-word-match'`); the topic page passes
 * `capabilities.picWordMatch` to `activityAvailability`.
 */

export interface VocabCapabilities {
  /** F-QUEST-002's Pic-Word Match is in this build. */
  picWordMatch: boolean;
}

/** `kinds`: the minigame kinds the build knows (the schema's options by default). */
export function vocabCapabilities(kinds: readonly string[] = MinigameKindSchema.options): VocabCapabilities {
  return { picWordMatch: kinds.includes('pic-word-match') };
}

export const capabilities: VocabCapabilities = vocabCapabilities();

/**
 * The screen each topic-page activity opens (F-VOC-003 section 3.1; F-VOC-004
 * section 3.1 adds `VocabSpeedRound`). The flashcards also open from a
 * collected word wall tile.
 */
export const ACTIVITY_ROUTES = { learn: 'VocabCards', speed: 'VocabSpeedRound', match: 'VocabMatch' } as const;

/**
 * Which activity screens this build has. The topic page draws an activity
 * (and makes the word wall's tiles buttons, for `learn`) only when its screen
 * exists, so no build shows a button that goes nowhere. The row that registers
 * a route in `navigation/root.tsx` turns its entry on in the same PR (F-VOC-003
 * C-5 `learn`, F-VOC-004 S-5 `speed`, F-VOC-003 C-6 `match`);
 * `__tests__/caps.test.ts` fails while the two disagree.
 */
export const VOCAB_SCREENS: Readonly<Record<keyof typeof ACTIVITY_ROUTES, boolean>> = {
  learn: false,
  speed: true,
  match: false,
};
