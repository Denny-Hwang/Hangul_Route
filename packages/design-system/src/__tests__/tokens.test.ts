import { describe, expect, it } from 'vitest';
import {
  HOYA_VARIANTS,
  borderWidth,
  colors,
  hoyaVariantColors,
  motion,
  presenter,
  radii,
  shadows,
  spacing,
  tokens,
  touchTarget,
  typography,
  z,
  type HoyaVariant,
} from '../tokens';

describe('design tokens v1', () => {
  it('exposes brand / surface / text palettes as readonly objects', () => {
    expect(colors.brand.primary).toBeTruthy();
    expect(colors.surface.canvas).toBeTruthy();
    expect(colors.text.primary).toBeTruthy();
  });

  it('declares 7 stage tints + 5 theme tints', () => {
    expect(Object.keys(colors.stage)).toHaveLength(7);
    expect(Object.keys(colors.theme)).toHaveLength(5);
  });

  it('reserves a danger color but routes child failure to nudge (anti-shame)', () => {
    expect(colors.feedback.danger).toBeTruthy();
    expect(colors.feedback.nudge).toBeTruthy();
    expect(colors.feedback.danger).not.toBe(colors.feedback.nudge);
  });

  it('touch target floor matches CLAUDE.md §4', () => {
    expect(touchTarget.min).toBeGreaterThanOrEqual(64);
    expect(touchTarget.child).toBeGreaterThanOrEqual(touchTarget.min);
    expect(touchTarget.hero).toBeGreaterThanOrEqual(touchTarget.child);
  });

  it('border widths step up from thin to thick', () => {
    expect(borderWidth.thin).toBeGreaterThan(0);
    expect(borderWidth.base).toBeGreaterThan(borderWidth.thin);
    expect(borderWidth.thick).toBeGreaterThan(borderWidth.base);
    expect(tokens.borderWidth).toBe(borderWidth);
  });

  it('spacing uses 4pt sub-grid floor', () => {
    expect(spacing.xs % 4).toBe(0);
    expect(spacing.sm % 4).toBe(0);
    expect(spacing.md % 4).toBe(0);
    expect(spacing.lg % 4).toBe(0);
  });

  it('typography body floor is ≥18sp (young-reader legibility)', () => {
    expect(typography.size.body).toBeGreaterThanOrEqual(18);
  });

  it('radii are sorted ascending', () => {
    const values = [radii.xs, radii.sm, radii.md, radii.lg, radii.xl, radii.xxl];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });

  it('motion durations are sorted', () => {
    expect(motion.duration.instant).toBeLessThan(motion.duration.fast);
    expect(motion.duration.fast).toBeLessThan(motion.duration.base);
    expect(motion.duration.base).toBeLessThan(motion.duration.slow);
  });

  it('tokens object aggregates all token families', () => {
    expect(tokens.colors).toBe(colors);
    expect(tokens.spacing).toBe(spacing);
    expect(tokens.radii).toBe(radii);
    expect(tokens.typography).toBe(typography);
    expect(tokens.shadows).toBe(shadows);
    expect(tokens.z).toBe(z);
  });

  it('z layers ascend from base to hoyaBubble', () => {
    expect(z.base).toBeLessThan(z.raised);
    expect(z.raised).toBeLessThan(z.modal);
    expect(z.modal).toBeLessThan(z.hoyaBubble);
  });
});

describe('Hoya fur variants (F-LEARN-001 §3.6)', () => {
  it('lists the five variants, orange first', () => {
    expect(HOYA_VARIANTS).toEqual(['orange', 'blue', 'green', 'purple', 'pink']);
  });

  it('orange is the existing gold fur, unchanged', () => {
    expect(hoyaVariantColors('orange')).toEqual({ fur: colors.hoya.fur, furDark: colors.hoya.furDark });
  });

  it.each([
    ['blue', colors.hoya.furBlue, colors.hoya.furBlueDark],
    ['green', colors.hoya.furGreen, colors.hoya.furGreenDark],
    ['purple', colors.hoya.furPurple, colors.hoya.furPurpleDark],
    ['pink', colors.hoya.furPink, colors.hoya.furPinkDark],
  ] as const)('%s maps to its flat colors.hoya.fur* pair', (variant, fur, furDark) => {
    expect(hoyaVariantColors(variant)).toEqual({ fur, furDark });
  });

  it('gives every variant a different fur and a different shade', () => {
    const furs = HOYA_VARIANTS.map((v) => hoyaVariantColors(v).fur);
    const darks = HOYA_VARIANTS.map((v) => hoyaVariantColors(v).furDark);
    expect(new Set(furs).size).toBe(HOYA_VARIANTS.length);
    expect(new Set(darks).size).toBe(HOYA_VARIANTS.length);
  });

  it('an unknown variant (persisted junk) falls back to orange', () => {
    expect(hoyaVariantColors('teal' as HoyaVariant)).toEqual(hoyaVariantColors('orange'));
  });

  it('keeps the eight new fur keys flat inside colors.hoya so the parity test sees them', () => {
    const keys = Object.keys(colors.hoya);
    for (const k of ['furBlue', 'furBlueDark', 'furGreen', 'furGreenDark', 'furPurple', 'furPurpleDark', 'furPink', 'furPinkDark']) {
      expect(keys).toContain(k);
    }
    expect(Object.values(colors.hoya).every((v) => typeof v === 'string')).toBe(true);
  });
});

describe('WordArt content colours, colors.vocab (F-VOC-002 §3.4, W3)', () => {
  const VOCAB_KEYS = [
    'red',
    'orange',
    'yellow',
    'green',
    'blue',
    'purple',
    'skyBlue',
    'brown',
    'gray',
    'white',
    'black',
    'pink',
  ];

  it('declares exactly the twelve colour-word tones, in table order', () => {
    expect(Object.keys(colors.vocab)).toEqual(VOCAB_KEYS);
  });

  it('sits between rarity and border, so the palette table order is unchanged around it', () => {
    const groups = Object.keys(colors);
    expect(groups.indexOf('vocab')).toBe(groups.indexOf('rarity') + 1);
    expect(groups.indexOf('border')).toBe(groups.indexOf('vocab') + 1);
  });

  it('every tone is an opaque #RRGGBB value and no two tones are the same', () => {
    const values = Object.values(colors.vocab);
    for (const v of values) expect(v).toMatch(/^#[0-9A-F]{6}$/);
    expect(new Set(values).size).toBe(values.length);
  });

  it('the content red is its own value, never the reserved feedback.danger', () => {
    expect(colors.vocab.red).not.toBe(colors.feedback.danger);
    expect(Object.values(colors.vocab)).not.toContain(colors.feedback.danger);
    expect(Object.values(colors.vocab)).not.toContain(colors.feedback.dangerLight);
  });

  it('the content black is warm, never pure black (colors.v1.md rule 3)', () => {
    expect(colors.vocab.black).not.toBe('#000000');
  });
});

describe('presenter tokens (F-TCH-004 §3.6)', () => {
  it('is a 1280-unit logical stage whose height clamps between 4:3 and 2:1', () => {
    expect(presenter.stage).toEqual({ width: 1280, minHeight: 600, maxHeight: 960 });
    expect(presenter.stage.width / presenter.stage.maxHeight).toBeCloseTo(4 / 3, 5);
    expect(presenter.stage.width / presenter.stage.minHeight).toBeLessThanOrEqual(2.15);
  });

  it('steps type down from the glyph to the caption, and caption is the smallest projected size', () => {
    const { glyph, display, title, prompt, body, caption } = presenter.size;
    expect([glyph, display, title, prompt, body, caption]).toEqual([380, 140, 80, 56, 40, 28]);
    const steps = [glyph, display, title, prompt, body, caption];
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]!);
    expect(Math.min(...Object.values(presenter.size))).toBe(caption);
  });

  it('names the bundled Hangul subset family and the four quiz marker shapes in number order', () => {
    expect(presenter.font).toBe('HR Presenter KR');
    expect(presenter.marker.shapes).toEqual(['circle', 'triangle', 'square', 'star']);
  });

  it('auto-hides the control bar after 3 s', () => {
    expect(presenter.autoHideMs).toBe(3000);
  });

  it('dims the non-correct quiz options to 0.8 opacity after the reveal (no failure colour)', () => {
    expect(presenter.dimOpacity).toBe(0.8);
  });

  it('is part of the tokens aggregate', () => {
    expect(tokens.presenter).toBe(presenter);
  });
});
