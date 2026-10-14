import { describe, expect, it } from 'vitest';
import {
  CONSONANT_ROWS,
  SHIFTED_KEYS,
  VOWEL_ROWS,
  keyFace,
  keyboardLayout,
  keyboardWidth,
  pressLetter,
  type KeyboardKey,
} from '../components/HangulKeyboard/layout';
import { layoutClassFor } from '../layout';
import { spacing, touchTarget } from '../tokens';

/** The keyboard for a window, as the game sizes it: the window itself where it spans edge to edge. */
const forWindow = (width: number, height: number) => {
  const lc = layoutClassFor({ width, height });
  return keyboardLayout(keyboardWidth(lc, width), lc);
};
const letters = (keys: readonly KeyboardKey[]): string[] => keys.filter((k) => k.kind === 'letter').map((k) => k.base ?? '');
const rowsOf = (keys: readonly KeyboardKey[]): string[][] => {
  const ys = [...new Set(keys.map((k) => k.y))].sort((a, b) => a - b);
  return ys.map((y) => keys.filter((k) => k.y === y).map((k) => k.base ?? k.kind));
};

describe('HangulKeyboard key table (KS X 5002 two-set)', () => {
  it('holds the consonant and vowel halves in the standard order', () => {
    expect(CONSONANT_ROWS).toEqual([
      ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ'],
      ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ'],
      ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ'],
    ]);
    expect(VOWEL_ROWS).toEqual([
      ['ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
      ['ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
      ['ㅠ', 'ㅜ', 'ㅡ'],
    ]);
  });

  it('Shift gives the five tense consonants and ㅒ ㅖ; every other key keeps its letter', () => {
    expect(SHIFTED_KEYS).toEqual({ 'ㅂ': 'ㅃ', 'ㅈ': 'ㅉ', 'ㄷ': 'ㄸ', 'ㄱ': 'ㄲ', 'ㅅ': 'ㅆ', 'ㅐ': 'ㅒ', 'ㅔ': 'ㅖ' });
    expect(keyFace('ㄱ', true)).toBe('ㄲ');
    expect(keyFace('ㄱ', false)).toBe('ㄱ');
    expect(keyFace('ㅁ', true)).toBe('ㅁ');
    expect(keyFace('ㅏ', true)).toBe('ㅏ');
  });

  it('Shift is one-shot: a letter types its face and turns Shift off', () => {
    expect(pressLetter('ㄷ', true)).toEqual({ jamo: 'ㄸ', shift: false });
    expect(pressLetter('ㄷ', false)).toEqual({ jamo: 'ㄷ', shift: false });
    expect(pressLetter('ㅎ', true)).toEqual({ jamo: 'ㅎ', shift: false });
  });
});

describe('keyboardWidth (type-hangul.md "Width")', () => {
  it('spans the window on a compact window and on any short window', () => {
    expect(keyboardWidth(layoutClassFor({ width: 320, height: 568 }), 320)).toBe(320);
    expect(keyboardWidth(layoutClassFor({ width: 844, height: 390 }), 800)).toBe(800);
  });

  it('sits in the reading column from regular up', () => {
    expect(keyboardWidth(layoutClassFor({ width: 768, height: 1024 }), 768)).toBe(720);
    expect(keyboardWidth(layoutClassFor({ width: 688, height: 1024 }), 688)).toBe(640);
    expect(keyboardWidth(layoutClassFor({ width: 1180, height: 820 }), 720)).toBe(720);
    expect(keyboardWidth(layoutClassFor({ width: 1180, height: 820 }), 600)).toBe(600);
  });

  it('never goes below zero', () => {
    expect(keyboardWidth(layoutClassFor({ width: 0, height: 0 }), -5)).toBe(0);
  });
});

describe('keyboardLayout (keyboard.md table)', () => {
  it('320 x 568: split, five cells of exactly 64, six rows and the gap (392 tall)', () => {
    const k = forWindow(320, 568);
    expect(k.arrangement).toBe('split');
    expect([k.cellWidth, k.cellHeight]).toEqual([touchTarget.min, touchTarget.min]);
    expect(k.height).toBe(6 * touchTarget.min + spacing.sm);
    expect(rowsOf(k.keys)).toEqual([
      ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ'],
      ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ'],
      ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'shift'],
      ['ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
      ['ㅗ', 'ㅓ', 'ㅏ', 'ㅣ', 'delete'],
      ['ㅠ', 'ㅜ', 'ㅡ', 'space'],
    ]);
    const space = k.keys.find((key) => key.kind === 'space');
    expect(space).toMatchObject({ x: 3 * 64, width: 2 * 64, y: 5 * 64 + spacing.sm });
    // Hit areas touch and never overflow the window.
    for (const key of k.keys) {
      expect(key.x + key.width).toBeLessThanOrEqual(320);
      expect(key.width).toBeGreaterThanOrEqual(touchTarget.min);
      expect(key.height).toBe(touchTarget.min);
    }
  });

  it('keeps focus order: row by row, the consonant half first', () => {
    const k = forWindow(320, 568);
    expect(letters(k.keys).slice(0, 14)).toEqual(CONSONANT_ROWS.flat());
    expect(letters(k.keys).slice(14)).toEqual(VOWEL_ROWS.flat());
    expect(k.keys.map((key) => key.id)).toContain('shift');
    expect(new Set(k.keys.map((key) => key.id)).size).toBe(k.keys.length);
  });

  it('375: split 75', () => {
    const k = forWindow(375, 667);
    expect([k.arrangement, k.cellWidth, k.cellHeight]).toEqual(['split', 75, 64]);
    expect(k.keys[0]?.x).toBe(0);
  });

  it('599 and 600: split, capped at the hero size and centred', () => {
    const narrow = forWindow(599, 900);
    expect([narrow.arrangement, narrow.cellWidth]).toEqual(['split', touchTarget.hero]);
    expect(narrow.keys[0]?.x).toBe(Math.floor((599 - 5 * 96) / 2));
    const regular = forWindow(600, 900);
    expect([regular.arrangement, regular.cellWidth, regular.cellHeight]).toEqual(['split', 96, 64]);
  });

  it('687: still split; 688: standard 64 (the reading column is 640)', () => {
    expect(forWindow(687, 1024).arrangement).toBe('split');
    const k = forWindow(688, 1024);
    expect([k.arrangement, k.cellWidth, k.cellHeight]).toEqual(['standard', 64, 77]);
  });

  it('768: standard 72 x 77 with the standard rows, the half-cell indent and the centred Space', () => {
    const k = forWindow(768, 1024);
    expect([k.arrangement, k.cellWidth, k.cellHeight]).toEqual(['standard', 72, 77]);
    expect(k.height).toBe(4 * 77);
    expect(rowsOf(k.keys)).toEqual([
      ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
      ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
      ['shift', 'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', 'delete'],
      ['space'],
    ]);
    const byId = (id: string) => k.keys.find((key) => key.id === id);
    expect(byId('ㅁ')?.x).toBe(36);
    expect(byId('shift')).toMatchObject({ x: 0, width: 108 });
    expect(byId('ㅋ')?.x).toBe(108);
    expect(byId('delete')).toMatchObject({ x: 612, width: 108 });
    expect(byId('space')).toMatchObject({ x: 180, width: 360, y: 3 * 77 });
    expect(byId('ㅛ')?.half).toBe('vowel');
    expect(byId('ㅅ')?.half).toBe('consonant');
    expect(byId('space')?.half).toBeNull();
  });

  it('1180: standard 72 x 90 (media scale 1.4, under the hero cap)', () => {
    const k = forWindow(1180, 820);
    expect([k.arrangement, k.cellWidth, k.cellHeight]).toEqual(['standard', 72, 90]);
  });

  it('844 x 390 short: standard 84 x 64, edge to edge, 256 tall', () => {
    const k = forWindow(844, 390);
    expect([k.arrangement, k.cellWidth, k.cellHeight, k.height]).toEqual(['standard', 84, 64, 256]);
    expect(k.keys[0]?.x).toBe(2);
  });

  it('a short window under 640 wide gets standard too: split (392) would not fit, standard is 256', () => {
    for (const [w, h, cw] of [
      [568, 320, 56],
      [592, 360, 59],
      [480, 320, 48],
    ] as const) {
      const k = forWindow(w, h);
      expect([k.arrangement, k.cellWidth, k.cellHeight, k.height], `${w} x ${h}`).toEqual(['standard', cw, 64, 256]);
      for (const key of k.keys) {
        expect(key.x + key.width, `${w} x ${h} ${key.id}`).toBeLessThanOrEqual(w);
        expect(key.y + key.height, `${w} x ${h} ${key.id}`).toBeLessThanOrEqual(256);
      }
    }
  });

  it('below 320 the split cells go under 64 and the keyboard keeps working', () => {
    const k = forWindow(284, 500);
    expect(k.arrangement).toBe('split');
    expect(k.cellWidth).toBe(56);
    expect(k.keys).toHaveLength(26 + 3);
  });
});
