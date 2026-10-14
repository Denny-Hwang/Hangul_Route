import type { LayoutClass } from '../../layout';
import { scaleMedia } from '../../layout';
import { layout, spacing, touchTarget } from '../../tokens';

/**
 * The in-app two-set (dubeolsik, KS X 5002) keyboard, pure part (F-CURR-001 §3.7, OD-10;
 * design/screens/minigame-writing/keyboard.md): the key table, one-shot Shift and the
 * arrangement for a width. No React, no copy: `HangulKeyboard.tsx` paints what this returns.
 */

/** The consonant half of rows 1-3, left to right. */
export const CONSONANT_ROWS: readonly (readonly string[])[] = [
  ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ'],
  ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ'],
  ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ'],
];

/** The vowel half of rows 1-3, left to right. */
export const VOWEL_ROWS: readonly (readonly string[])[] = [
  ['ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
  ['ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
  ['ㅠ', 'ㅜ', 'ㅡ'],
];

/** What Shift turns a key into: the five tense consonants and ㅒ ㅖ. Every other key is unchanged. */
export const SHIFTED_KEYS: Readonly<Record<string, string>> = {
  'ㅂ': 'ㅃ',
  'ㅈ': 'ㅉ',
  'ㄷ': 'ㄸ',
  'ㄱ': 'ㄲ',
  'ㅅ': 'ㅆ',
  'ㅐ': 'ㅒ',
  'ㅔ': 'ㅖ',
};

/** The letter a key shows (and types) with Shift on or off. */
export function keyFace(base: string, shift: boolean): string {
  return shift ? (SHIFTED_KEYS[base] ?? base) : base;
}

/** A letter key press: the jamo it types, and Shift, which is one-shot, turns off. */
export function pressLetter(base: string, shift: boolean): { jamo: string; shift: false } {
  return { jamo: keyFace(base, shift), shift: false };
}

export type KeyboardArrangement = 'standard' | 'split';
export type KeyKind = 'letter' | 'shift' | 'delete' | 'space';

/** One key's hit area, in dp from the keyboard's top-left corner. Hit areas touch; the face is inset when painted. */
export interface KeyboardKey {
  /** The base letter for a letter key, else the kind; unique. */
  id: string;
  kind: KeyKind;
  /** Letter keys only; the action keys belong to neither half. */
  half: 'consonant' | 'vowel' | null;
  /** The unshifted letter of a letter key. */
  base: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KeyboardLayout {
  arrangement: KeyboardArrangement;
  cellWidth: number;
  cellHeight: number;
  /** The tray: the width it was given and the height of its rows. */
  width: number;
  height: number;
  /** In focus order: row by row, left to right (in split, the consonant half first). */
  keys: KeyboardKey[];
}

type KeyboardLayoutClass = Pick<LayoutClass, 'width' | 'short' | 'mediaScale'>;

/** Ten cells of row 1 at the touch floor: below this the keyboard splits into its two halves. */
const STANDARD_MIN_WIDTH = 10 * touchTarget.min;

/**
 * The width the keyboard gets from the width available to it: all of it on a `compact`
 * window and on any `short` one (edge to edge, like a system keyboard), else the reading
 * column (the window less two gutters, at most `layout.maxWidth.reading`).
 */
export function keyboardWidth(
  lc: Pick<LayoutClass, 'width' | 'short' | 'gutter' | 'windowWidth'>,
  available: number,
): number {
  const edgeToEdge = lc.width === 'compact' || lc.short;
  const width = edgeToEdge ? available : Math.min(available, lc.windowWidth - 2 * lc.gutter, layout.maxWidth.reading);
  return Math.max(0, width);
}

const letter = (base: string, half: 'consonant' | 'vowel', x: number, y: number, w: number, h: number): KeyboardKey => ({
  id: base,
  kind: 'letter',
  half,
  base,
  x,
  y,
  width: w,
  height: h,
});

const action = (kind: Exclude<KeyKind, 'letter'>, x: number, y: number, w: number, h: number): KeyboardKey => ({
  id: kind,
  kind,
  half: null,
  base: null,
  x,
  y,
  width: w,
  height: h,
});

function standard(width: number, lc: KeyboardLayoutClass): KeyboardLayout {
  const cw = Math.floor(width / 10);
  const ch = lc.short ? touchTarget.min : Math.min(scaleMedia(touchTarget.min, lc.mediaScale), touchTarget.hero);
  const left = Math.floor((width - 10 * cw) / 2);
  const keys: KeyboardKey[] = [];
  const row = (y: number, x0: number, consonants: readonly string[], vowels: readonly string[]): void => {
    consonants.forEach((base, i) => keys.push(letter(base, 'consonant', x0 + i * cw, y, cw, ch)));
    vowels.forEach((base, i) => keys.push(letter(base, 'vowel', x0 + (consonants.length + i) * cw, y, cw, ch)));
  };
  row(0, left, CONSONANT_ROWS[0] ?? [], VOWEL_ROWS[0] ?? []);
  row(ch, left + cw / 2, CONSONANT_ROWS[1] ?? [], VOWEL_ROWS[1] ?? []);
  keys.push(action('shift', left, 2 * ch, 1.5 * cw, ch));
  row(2 * ch, left + 1.5 * cw, CONSONANT_ROWS[2] ?? [], VOWEL_ROWS[2] ?? []);
  keys.push(action('delete', left + 8.5 * cw, 2 * ch, 1.5 * cw, ch));
  keys.push(action('space', left + 2.5 * cw, 3 * ch, 5 * cw, ch));
  return { arrangement: 'standard', cellWidth: cw, cellHeight: ch, width, height: 4 * ch, keys };
}

function split(width: number): KeyboardLayout {
  const cw = Math.min(Math.floor(width / 5), touchTarget.hero);
  const ch = touchTarget.min;
  const left = Math.floor((width - 5 * cw) / 2);
  const vowelTop = 3 * ch + spacing.sm;
  const keys: KeyboardKey[] = [];
  CONSONANT_ROWS.forEach((row, r) =>
    row.forEach((base, i) => keys.push(letter(base, 'consonant', left + i * cw, r * ch, cw, ch))),
  );
  keys.push(action('shift', left + 4 * cw, 2 * ch, cw, ch));
  VOWEL_ROWS.forEach((row, r) => {
    const y = vowelTop + r * ch;
    row.forEach((base, i) => keys.push(letter(base, 'vowel', left + i * cw, y, cw, ch)));
    if (r === 1) keys.push(action('delete', left + 4 * cw, y, cw, ch));
    if (r === 2) keys.push(action('space', left + 3 * cw, y, 2 * cw, ch));
  });
  return { arrangement: 'split', cellWidth: cw, cellHeight: ch, width, height: vowelTop + 3 * ch, keys };
}

/**
 * The arrangement for a keyboard `width` (from `keyboardWidth`): `standard` (the KS X 5002
 * rows side by side) from ten cells at the touch floor, else `split` (the vowel half under
 * the consonant half, the same rows in the same order). Cell height is the touch floor on a
 * phone and on a short window, scaled by the media scale on a tablet, never above `hero`.
 */
export function keyboardLayout(width: number, lc: KeyboardLayoutClass): KeyboardLayout {
  return width >= STANDARD_MIN_WIDTH ? standard(width, lc) : split(width);
}
