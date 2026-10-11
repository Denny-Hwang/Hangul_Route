import { describe, expect, it } from 'vitest';
import type { WordArtProps } from '../types';

/**
 * F-VOC-002 §3.7 behaviour 5: a picture that is not decorative must be named.
 * `accessibilityLabel` is required unless `decorative` is set; the checks are
 * at compile time (`pnpm typecheck` runs over this file).
 */

describe('WordArtProps', () => {
  it('accepts a named picture and a decorative one', () => {
    const named: WordArtProps = { artKey: 'food-apple', size: 48, accessibilityLabel: 'apple' };
    const decorative: WordArtProps = { artKey: 'food-apple', size: 160, decorative: true };
    const silhouette: WordArtProps = { artKey: 'food-apple', size: 64, mono: true, decorative: true, testID: 'tile' };
    expect([named, decorative, silhouette]).toHaveLength(3);
  });

  it('refuses a picture with neither a label nor decorative', () => {
    // @ts-expect-error accessibilityLabel is required unless decorative
    const unnamed: WordArtProps = { artKey: 'food-apple', size: 48 };
    // @ts-expect-error decorative: false still needs a label
    const notDecorative: WordArtProps = { artKey: 'food-apple', size: 48, decorative: false };
    expect([unnamed, notDecorative]).toHaveLength(2);
  });

  it('refuses a label on a decorative picture (it would never be read)', () => {
    // @ts-expect-error a decorative picture takes no label
    const both: WordArtProps = { artKey: 'food-apple', size: 48, decorative: true, accessibilityLabel: 'apple' };
    expect(both).toBeDefined();
  });
});
