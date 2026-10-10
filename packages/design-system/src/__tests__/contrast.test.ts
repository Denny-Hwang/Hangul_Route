import { describe, expect, it } from 'vitest';
import { WCAG_AA_LARGE, WCAG_AA_NORMAL, contrastRatio, relativeLuminance } from '../contrast';
import { colors } from '../tokens';

describe('contrastRatio (WCAG 2.x)', () => {
  it('spans 1:1 to 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('is symmetric in its arguments', () => {
    expect(contrastRatio('#2A1F14', '#FCF8F1')).toBe(contrastRatio('#FCF8F1', '#2A1F14'));
  });

  it('matches the published reference values', () => {
    // WebAIM checker: #767676 on white is the classic 4.54:1 grey.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
    expect(relativeLuminance('#FFFFFF')).toBe(1);
    expect(relativeLuminance('#000000')).toBe(0);
  });

  it('accepts lowercase hex and rejects anything that is not #RRGGBB', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(() => relativeLuminance('#FFF')).toThrow(/#RRGGBB/);
    expect(() => relativeLuminance('rgba(0,0,0,0.4)')).toThrow(/#RRGGBB/);
  });
});

/**
 * UX-10 contract: every text/fill pairing the components actually render
 * meets WCAG AA. A token change that breaks one of these fails CI here.
 */
describe('token contrast contract (WCAG AA)', () => {
  const surfaces = {
    'surface.canvas': colors.surface.canvas,
    'surface.paper': colors.surface.paper,
    'surface.sunken': colors.surface.sunken,
  } as const;
  // HoyaBubble tones: idle (paper) / cheering (successLight) / thinking (nudgeLight).
  const bubbles = {
    'surface.paper': colors.surface.paper,
    'feedback.successLight': colors.feedback.successLight,
    'feedback.nudgeLight': colors.feedback.nudgeLight,
  } as const;

  const normalText: Array<[string, string, string]> = [
    // Button fills — label on resting and pressed fill.
    ['text.onPrimary on brand.primary', colors.text.onPrimary, colors.brand.primary],
    ['text.onPrimary on brand.primaryDark', colors.text.onPrimary, colors.brand.primaryDark],
    ['text.onSecondary on brand.secondary', colors.text.onSecondary, colors.brand.secondary],
    ['text.onSecondary on brand.secondaryDark', colors.text.onSecondary, colors.brand.secondaryDark],
    ['text.inverse on feedback.success', colors.text.inverse, colors.feedback.success],
    ['text.inverse on feedback.successDark', colors.text.inverse, colors.feedback.successDark],
    ['text.primary on feedback.nudge', colors.text.primary, colors.feedback.nudge],
    // Pill labels on their tints.
    ['brand.primaryDark on brand.primaryLight', colors.brand.primaryDark, colors.brand.primaryLight],
    ['brand.secondaryDark on brand.secondaryLight', colors.brand.secondaryDark, colors.brand.secondaryLight],
  ];
  // Ghost buttons, brand-tone headings, captions and tab labels sit on every surface.
  for (const [name, bg] of Object.entries(surfaces)) {
    normalText.push([`brand.primary (ghost / brand text) on ${name}`, colors.brand.primary, bg]);
    normalText.push([`text.primary on ${name}`, colors.text.primary, bg]);
    normalText.push([`text.secondary on ${name}`, colors.text.secondary, bg]);
    normalText.push([`text.muted on ${name}`, colors.text.muted, bg]);
  }
  for (const [name, bg] of Object.entries(bubbles)) {
    normalText.push([`text.primary (bubble Korean) on ${name}`, colors.text.primary, bg]);
    normalText.push([`text.secondary (bubble romanization) on ${name}`, colors.text.secondary, bg]);
  }
  // Muted captions also sit inside brand cards (Card tone="brand").
  normalText.push(['text.muted on brand.primaryLight', colors.text.muted, colors.brand.primaryLight]);

  it.each(normalText)('%s ≥ 4.5:1', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  it('a correct tile label (large text) reads on its success tint', () => {
    expect(contrastRatio(colors.feedback.success, colors.feedback.successLight)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  it('pressed fills stay darker than resting fills (visible press feedback)', () => {
    expect(relativeLuminance(colors.brand.primaryDark)).toBeLessThan(relativeLuminance(colors.brand.primary));
    expect(relativeLuminance(colors.brand.secondaryDark)).toBeLessThan(relativeLuminance(colors.brand.secondary));
    expect(relativeLuminance(colors.feedback.successDark)).toBeLessThan(relativeLuminance(colors.feedback.success));
  });

  it('keeps the text hierarchy: muted is lighter than secondary, secondary lighter than primary', () => {
    expect(relativeLuminance(colors.text.muted)).toBeGreaterThan(relativeLuminance(colors.text.secondary));
    expect(relativeLuminance(colors.text.secondary)).toBeGreaterThan(relativeLuminance(colors.text.primary));
  });
});
