import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography, z } from '@hangul-route/design-system/tokens';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAPTION_HIT_OVERFLOW,
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
    expect(SITE_SIZES.tileMin).toBe(rem(touchTarget.child + spacing.sm));
    expect(SITE_SIZES.tileMin).toBe('5.5rem');
    expect(SITE_SIZES.leadMeasure).toBe('34em');
    expect(SITE_SIZES.heroArtMax).toBe(`${5 * spacing.xxxl}px`);
    expect(SITE_SIZES.heroArtMax).toBe('240px');
    expect(SITE_SIZES.heroArtMaxWide).toBe(`${layout.maxWidth.reading / 2}px`);
    expect(SITE_SIZES.heroRatio).toBe('1.4fr');
    expect(SITE_SIZES.hoyaShare).toBe('62%');
  });
});

describe('cardShadow', () => {
  it('is shadows.card with its colour and opacity', () => {
    const { shadowOffset, shadowRadius, shadowOpacity } = shadows.card;
    expect(cardShadow()).toBe(`${shadowOffset.width}px ${shadowOffset.height}px ${shadowRadius}px rgba(42, 31, 20, ${shadowOpacity})`);
  });
});

describe('siteCssVars', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'globals.css'), 'utf8');
  const vars = siteCssVars() as Record<string, string>;

  it('sets exactly the custom properties globals.css reads (none unused, none missing)', () => {
    const read = new Set([...css.matchAll(/var\((--hr-site-[a-z0-9-]+)\)/g)].map((m) => m[1]));
    expect(new Set(Object.keys(vars))).toEqual(read);
  });

  it('each one is a token value', () => {
    expect(vars['--hr-site-brand']).toBe(colors.brand.primary);
    expect(vars['--hr-site-focus']).toBe(colors.border.focus);
    expect(vars['--hr-site-border-subtle']).toBe(colors.border.subtle);
    for (const key of ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'xxxl'] as const) {
      expect(vars[`--hr-site-${key}`]).toBe(`${spacing[key]}px`);
    }
    expect(vars['--hr-site-gutter-compact']).toBe(`${layout.gutter.compact}px`);
    expect(vars['--hr-site-border-thick']).toBe(`${borderWidth.thick}px`);
    expect(vars['--hr-site-touch-min']).toBe(`${touchTarget.min}px`);
    expect(vars['--hr-site-size-prompt']).toBe(rem(typography.size.prompt));
    expect(vars['--hr-site-z-sticky']).toBe(String(z.sticky));
    expect(vars['--hr-site-tile-min']).toBe(SITE_SIZES.tileMin);
    expect(vars['--hr-site-hero-art-max']).toBe(SITE_SIZES.heroArtMax);
    expect(vars['--hr-site-hero-art-max-wide']).toBe(SITE_SIZES.heroArtMaxWide);
    expect(vars['--hr-site-hero-ratio']).toBe(SITE_SIZES.heroRatio);
    expect(vars['--hr-site-sunken']).toBe(colors.surface.sunken);
    expect(vars['--hr-site-size-caption']).toBe(rem(typography.size.caption));
    expect(vars['--hr-site-size-body-sm']).toBe(rem(typography.size.bodySm));
    expect(vars['--hr-site-text-muted']).toBe(colors.text.muted);
    expect(vars['--hr-site-caption-overflow']).toBe(`calc(${CAPTION_HIT_OVERFLOW})`);
    expect(CAPTION_HIT_OVERFLOW).toBe(`((${touchTarget.min}px - ${rem(typography.size.caption)} * ${typography.leading.normal}) / 2)`);
    const tokenValues = new Set<string>([
      ...Object.values(colors).flatMap((group) => Object.values(group as Record<string, string>)),
      ...Object.values(spacing).map((v) => `${v}px`),
      ...Object.values(layout.gutter).map((v) => `${v}px`),
      ...Object.values(borderWidth).map((v) => `${v}px`),
      ...Object.values(typography.size).map((v) => rem(v)),
      `${touchTarget.min}px`,
      String(z.sticky),
      SITE_SIZES.footerColumnMin,
      SITE_SIZES.tileMin,
      SITE_SIZES.heroArtMax,
      SITE_SIZES.heroArtMaxWide,
      SITE_SIZES.heroRatio,
      // Derived from tokens only (touchTarget.min, the caption size and normal leading), checked above.
      `calc(${CAPTION_HIT_OVERFLOW})`,
    ]);
    for (const [key, value] of Object.entries(vars)) expect(tokenValues, key).toContain(value);
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
    expect(WRAP).toEqual({ maxWidth: layout.maxWidth.full, marginLeft: 'auto', marginRight: 'auto' });
  });

  it('visually hidden text keeps a 1 px box', () => {
    expect(VISUALLY_HIDDEN).toMatchObject({ position: 'absolute', width: 1, height: 1, overflow: 'hidden' });
  });
});
