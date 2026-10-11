import type { Jamo } from '@hangul-route/content-schema';
import { findJamo } from '../content/jamo';

/**
 * View rules for Build a Letter (F-QUEST-002 §3.7): how the block's slots are
 * laid out and how a batchim tile is announced. Pure.
 */

/** Vowels written under the consonant; every other Stage 1 vowel sits beside it. */
const UNDER_VOWELS = new Set(['jamo:o', 'jamo:yo', 'jamo:u', 'jamo:yu', 'jamo:eu']);

export interface BlockShape {
  /** Where the vowel sits relative to the initial consonant. */
  vowel: 'beside' | 'under';
  /** A third, lower slot for a final consonant. */
  hasFinal: boolean;
}

/** Shape of the syllable block built from `componentJamoIds` (reading order). */
export function blockShape(componentJamoIds: readonly string[]): BlockShape {
  const vowelId = componentJamoIds.find((id) => findJamo(id)?.kind === 'vowel');
  const last = componentJamoIds[componentJamoIds.length - 1];
  return {
    vowel: vowelId && UNDER_VOWELS.has(vowelId) ? 'under' : 'beside',
    hasFinal: componentJamoIds.length === 3 && last !== undefined && findJamo(last)?.kind === 'batchim',
  };
}

/** Accessibility label for a tile: a batchim says it is a final; others keep the default. */
export function tileAccessibilityLabel(jamo: Pick<Jamo, 'kind' | 'romanization'>): string | undefined {
  return jamo.kind === 'batchim' ? `final ${jamo.romanization}` : undefined;
}

/** The wrong-answer hint for a block shape (replaces "letters go left to right"). */
export function shapeHint(shape: BlockShape): string {
  const vowel = `The vowel goes ${shape.vowel} the first letter.`;
  return shape.hasFinal ? `${vowel} The last letter sits at the bottom.` : vowel;
}
