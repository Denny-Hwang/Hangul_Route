import { describe, expect, it } from 'vitest';
import { colors } from '../../tokens';
import { circle } from '../builders';
import { WORD_ART_DEFAULT_SIZE, WORD_ART_MONO_TONE, wordArtModel } from '../model';
import { getWordArt } from '../registry';
import { toRenderList } from '../render';
import type { WordArtGlyph } from '../types';

/**
 * F-VOC-002 §3.7: what the React Native `WordArt` paints, decided in pure
 * code so it is tested in node (components are excluded from coverage):
 * the render list (memoised per glyph and mode), the size and the
 * accessibility of the picture.
 */

describe('wordArtModel', () => {
  it('resolves the key to the render list of its glyph', () => {
    const m = wordArtModel({ artKey: 'food-apple', size: 48, accessibilityLabel: 'apple' })!;
    expect(m.shapes).toEqual(toRenderList(getWordArt('food-apple')!));
    expect(m.size).toBe(48);
    expect(m.viewBox).toBe('0 0 100 100');
  });

  it('is null for an unknown key, so the caller shows its text tile (never a blank)', () => {
    expect(wordArtModel({ artKey: 'food-unknown', size: 48, accessibilityLabel: 'x' })).toBeNull();
    expect(wordArtModel({ artKey: 'word:food-apple', size: 48, accessibilityLabel: 'x' })).toBeNull();
    expect(wordArtModel({ artKey: '', size: 48, decorative: true })).toBeNull();
  });

  it('mono draws the silhouette in border.strong (W8)', () => {
    expect(WORD_ART_MONO_TONE).toBe('border.strong');
    const m = wordArtModel({ artKey: 'animal-cat', size: 64, mono: true, decorative: true })!;
    for (const s of m.shapes) {
      if (s.fill !== 'none') expect(s.fill).toBe(colors.border.strong);
      if (s.stroke !== undefined) expect(s.stroke).toBe(colors.border.strong);
    }
  });

  it('memoises the render list per glyph and mode (§3.8 draw cost)', () => {
    const a = wordArtModel({ artKey: 'travel-bus', size: 48, decorative: true })!;
    const b = wordArtModel({ artKey: 'travel-bus', size: 160, accessibilityLabel: 'bus' })!;
    const c = wordArtModel({ artKey: 'travel-bus', size: 48, mono: true, decorative: true })!;
    expect(b.shapes).toBe(a.shapes);
    expect(c.shapes).not.toBe(a.shapes);
    expect(wordArtModel({ artKey: 'travel-bus', size: 32, mono: true, decorative: true })!.shapes).toBe(c.shapes);
    expect(Object.isFrozen(a.shapes)).toBe(true);
  });

  it('names the picture with its label when it carries the meaning', () => {
    expect(wordArtModel({ artKey: 'food-apple', size: 48, accessibilityLabel: 'apple' })).toMatchObject({ label: 'apple', decorative: false, unlabelled: false });
  });

  it('hides a decorative picture from assistive technology', () => {
    expect(wordArtModel({ artKey: 'food-apple', size: 48, decorative: true })).toMatchObject({ label: undefined, decorative: true, unlabelled: false });
  });

  it('treats a blank label as no label (never an empty announcement), and flags the picture as unlabelled', () => {
    for (const accessibilityLabel of ['', '  ']) {
      expect(wordArtModel({ artKey: 'food-apple', size: 48, accessibilityLabel })).toMatchObject({ label: undefined, decorative: false, unlabelled: true });
    }
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('falls back to the default size for %s', (size) => {
    expect(wordArtModel({ artKey: 'food-apple', size, decorative: true })!.size).toBe(WORD_ART_DEFAULT_SIZE);
  });

  it('reads another lookup when given one (tests, previews)', () => {
    const glyph: WordArtGlyph = [circle(50, 50, 30, { f: 'vocab.blue' })];
    const m = wordArtModel({ artKey: 'food-x', size: 48, decorative: true }, (key) => (key === 'food-x' ? glyph : undefined))!;
    expect(m.shapes).toHaveLength(1);
    expect(m.shapes[0]!.fill).toBe(colors.vocab.blue);
  });
});
