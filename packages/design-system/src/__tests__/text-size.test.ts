import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEXT_SIZE_STEP,
  STANDARD_TYPE_SCALE,
  TEXT_SCALE_CSS_VAR,
  TEXT_SIZE_FACTORS,
  TEXT_SIZE_STEPS,
  cappedFont,
  effectiveFontScale,
  scaledFontCap,
  sizeMultiplier,
  textSizeFactor,
  typeScale,
} from '../text-size';
import { typography } from '../tokens';

/**
 * The text size engine (owner items 6 and 7): reading sizes (caption to prompt) scale by the
 * step factor f, large type (title, display, hero) by 1 + (f - 1) / 2, every size rounded, and the
 * line height comes from the scaled size.
 */
describe('text size steps', () => {
  it('four steps, smallest first, standard by default', () => {
    expect(TEXT_SIZE_STEPS).toEqual(['standard', 'large', 'larger', 'largest']);
    expect(DEFAULT_TEXT_SIZE_STEP).toBe('standard');
    expect(TEXT_SIZE_FACTORS).toEqual({ standard: 1, large: 1.15, larger: 1.3, largest: 1.5 });
    expect(TEXT_SCALE_CSS_VAR).toBe('--hr-text-scale');
  });

  it('textSizeFactor: a known step, else standard (missing, damaged or a later step after a rollback)', () => {
    expect(textSizeFactor('largest')).toBe(1.5);
    expect(textSizeFactor('large')).toBe(1.15);
    expect(textSizeFactor(undefined)).toBe(1);
    expect(textSizeFactor(null)).toBe(1);
    expect(textSizeFactor('huge')).toBe(1);
    expect(textSizeFactor('toString')).toBe(1);
  });
});

describe('typeScale (the useTypeScale table)', () => {
  it('standard is the token scale exactly', () => {
    expect(STANDARD_TYPE_SCALE.size).toEqual(typography.size);
    expect(typeScale(1)).toBe(STANDARD_TYPE_SCALE);
  });

  it('the table at every step', () => {
    const table = Object.fromEntries(TEXT_SIZE_STEPS.map((step) => [step, typeScale(TEXT_SIZE_FACTORS[step]).size]));
    expect(table).toEqual({
      standard: { caption: 14, bodySm: 16, body: 18, bodyLg: 20, prompt: 22, title: 28, display: 36, hero: 48 },
      large: { caption: 16, bodySm: 18, body: 21, bodyLg: 23, prompt: 25, title: 30, display: 39, hero: 52 },
      larger: { caption: 18, bodySm: 21, body: 23, bodyLg: 26, prompt: 29, title: 32, display: 41, hero: 55 },
      largest: { caption: 21, bodySm: 24, body: 27, bodyLg: 30, prompt: 33, title: 35, display: 45, hero: 60 },
    });
  });

  it('reading sizes take the full factor, large type half the growth', () => {
    expect(sizeMultiplier('body', 1.5)).toBe(1.5);
    expect(sizeMultiplier('caption', 1.3)).toBe(1.3);
    expect(sizeMultiplier('prompt', 1.15)).toBe(1.15);
    expect(sizeMultiplier('title', 1.5)).toBe(1.25);
    expect(sizeMultiplier('hero', 1.3)).toBeCloseTo(1.15);
    expect(sizeMultiplier('display', 1)).toBe(1);
  });

  it('line height comes from the scaled size at a leading token (normal by default)', () => {
    const scale = typeScale(1.5);
    expect(scale.factor).toBe(1.5);
    expect(scale.lineHeight(scale.size.body)).toBeCloseTo(27 * typography.leading.normal);
    expect(scale.lineHeight(scale.size.title, 'tight')).toBeCloseTo(35 * typography.leading.tight);
  });

  it('memoises per factor and treats a factor below 1 or not finite as standard', () => {
    expect(typeScale(1.3)).toBe(typeScale(1.3));
    expect(typeScale(0.5)).toBe(STANDARD_TYPE_SCALE);
    expect(typeScale(Number.NaN)).toBe(STANDARD_TYPE_SCALE);
    expect(typeScale(Number.POSITIVE_INFINITY)).toBe(STANDARD_TYPE_SCALE);
    expect(Object.isFrozen(typeScale(1.15).size)).toBe(true);
  });
});

describe('effectiveFontScale and scaledFontCap', () => {
  it('effective scale is OS fontScale x the step', () => {
    expect(effectiveFontScale(1, 1)).toBe(1);
    expect(effectiveFontScale(1.2, 1.5)).toBeCloseTo(1.8);
    expect(effectiveFontScale(1, 1.3)).toBe(1.3);
    // A missing OS scale (0, NaN) counts as 1; a bad factor counts as standard.
    expect(effectiveFontScale(0, 1.5)).toBe(1.5);
    expect(effectiveFontScale(Number.NaN, 1.15)).toBe(1.15);
    expect(effectiveFontScale(1.4, Number.NaN)).toBe(1.4);
  });

  it('a native cap is divided by the step and never drops below 1 (React Native reads below 1 as no cap)', () => {
    expect(scaledFontCap(1.3, 1)).toBe(1.3);
    expect(scaledFontCap(1.3, 1.15)).toBeCloseTo(1.3 / 1.15);
    expect(scaledFontCap(1.3, 1.5)).toBe(1);
    expect(scaledFontCap(2, 1.5)).toBeCloseTo(4 / 3);
    expect(scaledFontCap(1, 1.5)).toBe(1);
    expect(scaledFontCap(1.3, Number.NaN)).toBe(1.3);
  });
});

describe('cappedFont: a capped text at the chosen step', () => {
  it('standard keeps the token size and the cap as written', () => {
    expect(cappedFont('body', 1, 1.3)).toEqual({ fontSize: 18, maxFontSizeMultiplier: 1.3 });
    expect(cappedFont('caption', 1, 1.3)).toEqual({ fontSize: 14, maxFontSizeMultiplier: 1.3 });
  });

  it('a larger step draws bigger and leaves the OS what is left of the budget (about cap / f)', () => {
    const large = cappedFont('body', 1.15, 1.3);
    expect(large.fontSize).toBe(21);
    expect(large.maxFontSizeMultiplier).toBeCloseTo(23.4 / 21);
    expect(large.fontSize * large.maxFontSizeMultiplier).toBeCloseTo(18 * 1.3);
  });

  it('a step past the cap is clamped to base x cap, and the OS adds nothing more', () => {
    const largest = cappedFont('body', 1.5, 1.3);
    expect(largest.fontSize).toBe(23);
    expect(largest.maxFontSizeMultiplier).toBeGreaterThanOrEqual(1);
    expect(largest.fontSize * largest.maxFontSizeMultiplier).toBeCloseTo(18 * 1.3);
    // A cap of 1 (fixed art text) never grows, and a cap below 1 counts as 1.
    expect(cappedFont('caption', 1.5, 1)).toEqual({ fontSize: 14, maxFontSizeMultiplier: 1 });
    expect(cappedFont('caption', 1.5, 0.5)).toEqual({ fontSize: 14, maxFontSizeMultiplier: 1 });
  });
});
