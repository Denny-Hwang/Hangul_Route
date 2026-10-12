import { borderWidth, spacing, touchTarget } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { hasPicture, pictureName, pictureTile, resolvePicture, resolvePictureArt, silhouetteOf, swatchColors } from '../picture-ref';

const colors = {
  brand: { primary: '#111111', primaryLight: '#222222' },
  theme: { letters: '#333333' },
  surface: { overlay: 'rgba(0, 0, 0, 0.4)' },
  scale: { nested: { deep: '#444444' }, count: 3 },
  vocab: { red: '#555555', white: '#666666' },
};
const ctx = { supportedCardIds: ['card:kimchi', 'card:rice'], swatches: swatchColors(colors), wordArtKeys: ['food-apple', 'animal-cat'] };

describe('swatchColors', () => {
  it('flattens group.key colours into kebab-case tokens', () => {
    expect(swatchColors(colors)).toEqual({
      'brand-primary': '#111111',
      'brand-primary-light': '#222222',
      'theme-letters': '#333333',
      'surface-overlay': 'rgba(0, 0, 0, 0.4)',
    });
  });

  it('leaves out the WordArt content tones: the vocab group is drawn only inside WordArt (F-VOC-002 §3.4)', () => {
    const tokens = Object.keys(swatchColors(colors));
    expect(tokens.filter((t) => t.startsWith('vocab-'))).toEqual([]);
  });
});

describe('resolvePicture (F-QUEST-002 §3.11)', () => {
  it('resolves a card the art supports', () => {
    expect(resolvePicture('card:kimchi', ctx)).toEqual({ kind: 'card', cardId: 'card:kimchi' });
  });

  it('resolves a swatch token to its colour', () => {
    expect(resolvePicture('swatch:brand-primary-light', ctx)).toEqual({
      kind: 'swatch',
      token: 'brand-primary-light',
      color: '#222222',
    });
  });

  it('resolves a word picture WordArt draws to its key, without the word: prefix (F-VOC-002 W-7)', () => {
    expect(resolvePicture('word:food-apple', ctx)).toEqual({ kind: 'word', key: 'food-apple' });
    expect(resolvePicture('word:animal-cat', ctx)).toEqual({ kind: 'word', key: 'animal-cat' });
  });

  it('falls back to the text tile for an unsupported card, an unknown swatch, an undrawn word or no picture', () => {
    expect(resolvePicture('card:no-art', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('swatch:nope', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('swatch:vocab-red', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('word:rock', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('word:food-banana', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture(undefined, ctx)).toEqual({ kind: 'text' });
  });

  it('never reads a key across kinds: a card id is not a word, a word key is not a card', () => {
    expect(resolvePicture('word:card:kimchi', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('card:food-apple', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('word:', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('food-apple', ctx)).toEqual({ kind: 'text' });
  });

  it('falls back for text that is not a picture ref at all', () => {
    expect(resolvePicture('kimchi', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('', ctx)).toEqual({ kind: 'text' });
  });
});

describe('resolvePictureArt: what PictureArt draws for a ref and its gloss (F-VOC-002 §3.7, W-7)', () => {
  it('draws a word picture that has a name', () => {
    expect(resolvePictureArt('word:food-apple', 'apple', ctx)).toEqual({ kind: 'word', key: 'food-apple' });
  });

  it('shows the text tile for a word picture given a blank gloss: the picture is the only carrier of meaning and must be named', () => {
    expect(resolvePictureArt('word:food-apple', '', ctx)).toEqual({ kind: 'text' });
    expect(resolvePictureArt('word:food-apple', '   ', ctx)).toEqual({ kind: 'text' });
  });

  it('leaves cards, swatches and the text fallback as resolvePicture has them', () => {
    expect(resolvePictureArt('card:kimchi', 'kimchi', ctx)).toEqual({ kind: 'card', cardId: 'card:kimchi' });
    expect(resolvePictureArt('swatch:brand-primary', '', ctx)).toEqual({ kind: 'swatch', token: 'brand-primary', color: '#111111' });
    expect(resolvePictureArt('word:rock', 'rock', ctx)).toEqual({ kind: 'text' });
    expect(resolvePictureArt(undefined, 'rock', ctx)).toEqual({ kind: 'text' });
  });
});

describe('hasPicture: one answer to "does this ref draw a picture?" for a ref and the gloss PictureArt is given', () => {
  it('counts a card, a swatch and a named word picture', () => {
    expect(hasPicture('card:kimchi', 'kimchi', ctx)).toBe(true);
    expect(hasPicture('swatch:brand-primary', 'blue', ctx)).toBe(true);
    expect(hasPicture('word:food-apple', 'apple', ctx)).toBe(true);
  });

  it('does not count a word picture with a blank gloss: PictureArt draws the text tile for it', () => {
    expect(hasPicture('word:food-apple', '', ctx)).toBe(false);
    expect(hasPicture('word:food-apple', '  ', ctx)).toBe(false);
  });

  it('does not count an unresolved or absent ref', () => {
    expect(hasPicture('word:rock', 'rock', ctx)).toBe(false);
    expect(hasPicture(undefined, 'rock', ctx)).toBe(false);
  });
});

describe('pictureName: the name and text of a picture is never blank (F-QUEST-002 §3.11)', () => {
  it('keeps a gloss that has text', () => {
    expect(pictureName('apple', 'Picture')).toBe('apple');
  });

  it('uses the fallback for a blank gloss, so the text tile is never empty and the picture is never unnamed', () => {
    expect(pictureName('', 'Picture')).toBe('Picture');
    expect(pictureName('   ', 'Picture')).toBe('Picture');
  });

  it('gives the text tile of a blank-gloss word picture a non-empty label', () => {
    const picture = resolvePictureArt('word:food-apple', '', ctx);
    expect(picture.kind).toBe('text');
    expect(pictureName('', 'Picture').trim()).not.toBe('');
  });
});

describe('pictureTile: the neutral tile round card art and WordArt (F-VOC-002 §3.7, §3.11)', () => {
  // The values PictureArt.tsx passes: padding spacing.xs and border borderWidth.thin per side, art at least 48.
  const metrics = { inset: spacing.xs + borderWidth.thin, minArt: spacing.xxxl };

  it('draws the art inside the requested side when there is room', () => {
    expect(pictureTile(touchTarget.hero, metrics)).toEqual({ tile: touchTarget.hero, art: touchTarget.hero - 2 * metrics.inset });
    expect(pictureTile(touchTarget.min, metrics)).toEqual({ tile: touchTarget.min, art: touchTarget.min - 2 * metrics.inset });
  });

  it('never draws the art below 48, the tested minimum: the tile grows outward instead', () => {
    // The smallest side any caller asks for: ItemScreen in short landscape (spacing.xxxl).
    const smallest = pictureTile(spacing.xxxl, metrics);
    expect(smallest.art).toBeGreaterThanOrEqual(48);
    expect(smallest.tile).toBe(smallest.art + 2 * metrics.inset);
    for (const side of [0, 20, spacing.xxxl, spacing.xxxl + 2 * metrics.inset, touchTarget.min, touchTarget.child, touchTarget.hero]) {
      const { tile, art } = pictureTile(side, metrics);
      expect(art).toBeGreaterThanOrEqual(48);
      expect(tile).toBe(art + 2 * metrics.inset);
      expect(tile).toBeGreaterThanOrEqual(side);
    }
  });
});

describe('silhouetteOf: a word not collected yet (F-VOC-002 W8, F-VOC-003 section 3.4)', () => {
  it('a WordArt picture is drawn in silhouette', () => {
    expect(silhouetteOf({ kind: 'word', key: 'food-apple' })).toEqual({ kind: 'word', key: 'food-apple' });
  });

  it('card art, a swatch and a text tile have no silhouette: a plain tile, so no colour or word gives it away', () => {
    expect(silhouetteOf({ kind: 'card', cardId: 'card:rice' })).toEqual({ kind: 'plain' });
    expect(silhouetteOf({ kind: 'swatch', token: 'brand-primary', color: 'x' })).toEqual({ kind: 'plain' });
    expect(silhouetteOf({ kind: 'text' })).toEqual({ kind: 'plain' });
  });
});
