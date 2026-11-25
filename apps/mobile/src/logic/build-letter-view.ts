import type { Jamo } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { findJamo } from '../content/jamo';

/**
 * View rules for Build a Letter (F-QUEST-002 §3.7): how the block's slots are
 * laid out and how a batchim tile is announced. Pure: the words are
 * `learner.minigame.buildLetter` and `a11y.minigame`, passed in.
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
export function tileAccessibilityLabel(
  jamo: Pick<Jamo, 'kind' | 'romanization'>,
  finalTile: Messages['a11y']['minigame']['finalTile'],
): string | undefined {
  return jamo.kind === 'batchim' ? finalTile(jamo.romanization) : undefined;
}

/** The wrong-answer hint for a block shape (replaces "letters go left to right"). */
export function shapeHint(shape: BlockShape, copy: Messages['learner']['minigame']['buildLetter']['shape']): string {
  if (shape.vowel === 'under') return shape.hasFinal ? copy.underFinal : copy.under;
  return shape.hasFinal ? copy.besideFinal : copy.beside;
}

/** The Undo button (a backspace): the placed tiles without the last one, always a new array (none placed: an empty one). */
export function removeLastTile(placed: readonly string[]): string[] {
  return placed.slice(0, -1);
}

/** How many rows the block's boxes take (`SyllableBlock`): the vowel beside or under, plus the final's own lower row. */
export function blockRows(shape: BlockShape): number {
  return (shape.vowel === 'under' ? 2 : 1) + (shape.hasFinal ? 1 : 0);
}

/**
 * The height of the block's shape picture: `rows x cell + (rows - 1) x gap` (40, 88 or 136 on the phone sizes). Build a
 * Letter keeps this place under the slots in every state, so the picture appearing after a miss moves nothing
 * (F-A11Y-001 §3.5; design/components/AnswerFeedback/spec.md D7).
 */
export function shapePlaceHeight(shape: BlockShape, cell: number, gap: number): number {
  const rows = blockRows(shape);
  return rows * cell + (rows - 1) * gap;
}
