import { describe, expect, it } from 'vitest';
import { resolvePicture, resolvePictureArt, swatchColors } from '../picture-ref';

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
