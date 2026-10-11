import type { ReactNode } from 'react';

/** Where the vowel sits relative to the initial consonant. */
export type SyllableVowel = 'beside' | 'under';

export type SyllablePart = 'initial' | 'vowel' | 'final';

/** One box of the block. `index` is the reading-order slot: 0 initial, 1 vowel, 2 final. */
export interface SyllableCell {
  index: 0 | 1 | 2;
  part: SyllablePart;
  highlighted: boolean;
  /** Text for the default box paint; absent draws an empty box. */
  text: string | undefined;
}

export type SyllableBlockSize = 'sm' | 'md';

export interface SyllableBlockProps {
  vowel: SyllableVowel;
  hasFinal: boolean;
  /** The box that is the point of the picture. */
  highlight?: SyllablePart;
  /** Text in each box in reading order `[initial, vowel, final]`. */
  parts?: readonly (string | undefined)[];
  /** Replaces the default box paint; the block still owns the arrangement. */
  renderCell?: (cell: SyllableCell) => ReactNode;
  size?: SyllableBlockSize;
  /** Names the whole diagram; absent leaves it to the parent. */
  accessibilityLabel?: string;
  testID?: string;
}
