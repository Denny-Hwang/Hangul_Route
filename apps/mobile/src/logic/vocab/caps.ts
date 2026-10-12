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
