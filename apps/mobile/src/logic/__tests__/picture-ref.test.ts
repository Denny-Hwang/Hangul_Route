import { describe, expect, it } from 'vitest';
import { resolvePicture, swatchColors } from '../picture-ref';

const colors = {
  brand: { primary: '#111111', primaryLight: '#222222' },
  theme: { letters: '#333333' },
  surface: { overlay: 'rgba(0, 0, 0, 0.4)' },
  scale: { nested: { deep: '#444444' }, count: 3 },
  vocab: { red: '#555555', white: '#666666' },
};
const ctx = { supportedCardIds: ['card:kimchi', 'card:rice'], swatches: swatchColors(colors) };

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

  it('falls back to the text tile for an unsupported card, an unknown swatch, a word picture or no picture', () => {
    expect(resolvePicture('card:no-art', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('swatch:nope', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('swatch:vocab-red', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('word:rock', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture(undefined, ctx)).toEqual({ kind: 'text' });
  });

  it('falls back for text that is not a picture ref at all', () => {
    expect(resolvePicture('kimchi', ctx)).toEqual({ kind: 'text' });
    expect(resolvePicture('', ctx)).toEqual({ kind: 'text' });
  });
});
