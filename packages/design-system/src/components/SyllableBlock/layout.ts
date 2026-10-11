import { borderWidth, colors, radii, spacing, touchTarget } from '../../tokens';
import type {
  SyllableBlockProps,
  SyllableBlockSize,
  SyllableCell,
  SyllablePart,
  SyllableVowel,
} from './types';

/**
 * Pure view model behind `SyllableBlock` (F-QUEST-002 §3.2, §3.7): which boxes
 * sit on which row, which one is lit, how big each box is. The component only
 * paints what this returns, so the arrangement is unit-tested without a
 * renderer. Tokens only, no literals.
 */

/** The three parts in reading order; the array index is the slot index. */
export const SYLLABLE_PARTS = ['initial', 'vowel', 'final'] as const satisfies readonly SyllablePart[];

/** Default box side per size, from the touch-target tokens. */
export const SYLLABLE_CELL_SIZES = {
  sm: touchTarget.min,
  md: touchTarget.child,
} as const satisfies Record<SyllableBlockSize, number>;

export interface SyllableBlockView {
  /** Rows top to bottom; each row holds the boxes drawn side by side. */
  rows: SyllableCell[][];
  cellSize: number;
  /** Space between boxes and between rows. */
  gap: number;
}

type ViewInput = Pick<SyllableBlockProps, 'vowel' | 'hasFinal' | 'highlight' | 'parts' | 'size'>;

/** Slot indexes per row: beside = initial + vowel together, under = stacked; the final is always its own lower row. */
function rowSlots(vowel: SyllableVowel, hasFinal: boolean): number[][] {
  const top = vowel === 'beside' ? [[0, 1]] : [[0], [1]];
  return hasFinal ? [...top, [2]] : top;
}

export function syllableBlockView(input: ViewInput): SyllableBlockView {
  const rows = rowSlots(input.vowel, input.hasFinal).map((slots) =>
    slots.map((slot): SyllableCell => {
      const part = SYLLABLE_PARTS[slot] as SyllablePart;
      return {
        index: slot as 0 | 1 | 2,
        part,
        highlighted: input.highlight === part,
        text: input.parts?.[slot],
      };
    }),
  );
  return { rows, cellSize: SYLLABLE_CELL_SIZES[input.size ?? 'md'], gap: spacing.sm };
}

export interface SyllableCellLook {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
}

/** The lit box carries a thicker border as well as the tint, so it is never colour alone. */
export function syllableCellLook(highlighted: boolean): SyllableCellLook {
  return highlighted
    ? {
        backgroundColor: colors.brand.primaryLight,
        borderColor: colors.brand.primary,
        borderWidth: borderWidth.thick,
        borderRadius: radii.lg,
      }
    : {
        backgroundColor: colors.surface.paper,
        borderColor: colors.border.subtle,
        borderWidth: borderWidth.base,
        borderRadius: radii.lg,
      };
}
