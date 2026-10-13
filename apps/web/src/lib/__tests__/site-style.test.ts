import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography, z } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import {
  HIT,
  HIT_SIZE,
  PRIMARY_ACTION,
  SECONDARY_ACTION,
  SITE_BREAKPOINTS,
  SITE_SIZES,
  VISUALLY_HIDDEN,
  WRAP,
  cardShadow,
  rem,
  siteCssVars,
} from '../site-style';

/**
 * Style values of the layered site (F-SITE-002 §3.2, §3.11; design/screens/site/README.md "Constants"): text in rem,
 * breakpoints in em, every value from a token.
 */
describe('rem', () => {
  it('measures a token against the 16 px browser default', () => {
    expect(rem(16)).toBe('1rem');
    expect(rem(typography.size.body)).toBe('1.125rem');
    expect(rem(typography.size.prompt)).toBe('1.375rem');
  });
});

describe('SITE_BREAKPOINTS', () => {
  it('are the S-D constants in em: 720, 960 and 360 px, and the full content width', () => {
    expect(SITE_BREAKPOINTS).toEqual({ wide: 45, brandName: 60, mark: 22.5, gutter: 70 });
    expect(SITE_BREAKPOINTS.gutter * 16).toBe(layout.maxWidth.full);
  });
});

describe('SITE_SIZES', () => {
  it('derive from tokens and scale with text', () => {
    expect(SITE_SIZES.footerColumnMin).toBe(rem(2 * spacing.jumbo));
    expect(SITE_SIZES.tileMin).toBe('5.5rem');
    expect(SITE_SIZES.leadMeasure).toBe('34em');
  });
});

describe('cardShadow', () => {
  it('is shadows.card with its colour and opacity', () => {
    const { shadowOffset, shadowRadius, shadowOpacity } = shadows.card;
    expect(cardShadow()).toBe(`${shadowOffset.width}px ${shadowOffset.height}px ${shadowRadius}px rgba(42, 31, 20, ${shadowOpacity})`);
  });
});

describe('siteCssVars', () => {
  const vars = siteCssVars() as Record<string, string>;

  it('names every value globals.css reads, each one a token', () => {
    expect(vars['--hr-site-brand']).toBe(colors.brand.primary);
    expect(vars['--hr-site-brand-dark']).toBe(colors.brand.primaryDark);
    expect(vars['--hr-site-brand-light']).toBe(colors.brand.primaryLight);
    expect(vars['--hr-site-text']).toBe(colors.text.primary);
    expect(vars['--hr-site-text-secondary']).toBe(colors.text.secondary);
    expect(vars['--hr-site-on-primary']).toBe(colors.text.onPrimary);
    expect(vars['--hr-site-border-strong']).toBe(colors.border.strong);
    expect(vars['--hr-site-focus']).toBe(colors.border.focus);
    expect(vars['--hr-site-sunken']).toBe(colors.surface.sunken);
    for (const key of ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'xxxl'] as const) {
      expect(vars[`--hr-site-${key}`]).toBe(`${spacing[key]}px`);
    }
    expect(vars['--hr-site-gutter-regular']).toBe(`${layout.gutter.regular}px`);
    expect(vars['--hr-site-gutter-wide']).toBe(`${layout.gutter.wide}px`);
    expect(vars['--hr-site-border-base']).toBe(`${borderWidth.base}px`);
    expect(vars['--hr-site-border-thick']).toBe(`${borderWidth.thick}px`);
    expect(vars['--hr-site-surface-paper']).toBe(colors.surface.paper);
    expect(vars['--hr-site-size-body']).toBe(rem(typography.size.body));
    expect(vars['--hr-site-size-body-lg']).toBe(rem(typography.size.bodyLg));
    expect(vars['--hr-site-size-prompt']).toBe(rem(typography.size.prompt));
    expect(vars['--hr-site-size-display']).toBe(rem(typography.size.display));
    expect(vars['--hr-site-footer-col-min']).toBe(SITE_SIZES.footerColumnMin);
    expect(vars['--hr-site-tile-min']).toBe(SITE_SIZES.tileMin);
    expect(vars['--hr-site-size-title']).toBe(rem(typography.size.title));
    expect(vars['--hr-site-size-hero']).toBe(rem(typography.size.hero));
    expect(vars['--hr-site-z-sticky']).toBe(String(z.sticky));
    expect(vars['--hr-site-canvas']).toBe(colors.surface.canvas);
    expect(vars['--hr-site-muted']).toBe(colors.text.muted);
    expect(vars['--hr-site-border-subtle']).toBe(colors.border.subtle);
    expect(vars['--hr-site-gutter-compact']).toBe(`${layout.gutter.compact}px`);
    expect(vars['--hr-site-border-thin']).toBe(`${borderWidth.thin}px`);
    expect(vars['--hr-site-touch-min']).toBe(`${touchTarget.min}px`);
    expect(vars['--hr-site-size-caption']).toBe(rem(typography.size.caption));
    expect(vars['--hr-site-size-body-sm']).toBe(rem(typography.size.bodySm));
  });

  it('every custom property is in the --hr-site- namespace', () => {
    expect(Object.keys(vars).every((key) => key.startsWith('--hr-site-'))).toBe(true);
  });
});

describe('shared style objects', () => {
  it('every control has a 64 x 64 hit area', () => {
    for (const style of [HIT, PRIMARY_ACTION, SECONDARY_ACTION]) {
      expect(Number(style.minHeight)).toBeGreaterThanOrEqual(touchTarget.min);
      expect(style.minWidth).toBe(touchTarget.min);
    }
  });

  it('the primary action is the hero pill: touchTarget.child, size.prompt in rem; colours live in the stylesheet (hover)', () => {
    expect(PRIMARY_ACTION).toMatchObject({ minHeight: touchTarget.child, borderRadius: radii.pill, fontSize: rem(typography.size.prompt) });
    expect(PRIMARY_ACTION).not.toHaveProperty('backgroundColor');
    expect(PRIMARY_ACTION).not.toHaveProperty('color');
  });

  it('the secondary action is an outline pill; colours live in the stylesheet (hover)', () => {
    expect(SECONDARY_ACTION).toMatchObject({ borderWidth: borderWidth.base, borderStyle: 'solid', fontSize: rem(typography.size.bodyLg) });
    expect(SECONDARY_ACTION).not.toHaveProperty('color');
  });

  it('HIT_SIZE leaves display to the stylesheet; HIT is inline-flex', () => {
    expect(HIT_SIZE).not.toHaveProperty('display');
    expect(HIT).toEqual({ display: 'inline-flex', ...HIT_SIZE });
  });

  it('the column is capped at layout.maxWidth.full and centred', () => {
    expect(WRAP).toEqual({ maxWidth: layout.maxWidth.full, marginInline: 'auto' });
  });

  it('visually hidden text keeps a 1 px box', () => {
    expect(VISUALLY_HIDDEN).toMatchObject({ position: 'absolute', width: 1, height: 1, overflow: 'hidden' });
  });
});
