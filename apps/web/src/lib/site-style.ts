import { borderWidth, colors, layout, radii, shadows, spacing, touchTarget, typography, z } from '@hangul-route/design-system/tokens';
import type { CSSProperties } from 'react';

/**
 * Shared style values of the layered site (F-SITE-002 §3.2, §3.11; design/screens/site/README.md). Every value
 * comes from a design token; the few that are not tokens are named here with the token they derive from.
 *
 * Text sizes are rendered in rem (token / 16) and the breakpoints in `globals.css` are written in em, so a
 * visitor's browser text-size setting (200 % text) enlarges every line and moves the layout switches with it.
 * Inline styles beat stylesheet rules, so a property that changes at a breakpoint or on hover / focus lives in
 * `globals.css` (the `hr-site-*` rules), which reads its token values from the custom properties `siteCssVars()`
 * sets on the site root. Nothing here is a colour or spacing literal.
 */

/** The browser's default text size the rem and em units are measured against (CSS px). */
const ROOT_PX = 16;

/** `px` as rem, so the size follows the browser's text-size setting. */
export function rem(px: number): string {
  return `${px / ROOT_PX}rem`;
}

/**
 * The site's breakpoints in em (px / 16 at default text). Written mobile first in `globals.css`: the narrow rule is
 * the default and a `min-width` query overrides it, never a `max-width` query (no fractional width falls between).
 * The site does not use `layout.breakpoint` (600 / 900): those are the learner app's window classes.
 */
export const SITE_BREAKPOINTS = {
  /** 720 px: the phone / wide switch of the header and the page layouts (spec §3.2: four 64 px links need it). */
  wide: 45,
  /** 960 px: from here the wide header shows the brand name next to the mark (measured in S-D). */
  brandName: 60,
  /** 360 px: the brand mark steps in (below it the name alone keeps Sign in on one row at 320 px). */
  mark: 22.5,
  /** 1120 px (`layout.maxWidth.full`): the side gutter widens once the content reaches its maximum width. */
  gutter: layout.maxWidth.full / ROOT_PX,
} as const;

/** Named constants of the site layout that are not tokens; each derives from one (S-D README, "Constants"). */
export const SITE_SIZES = {
  /** Reading measure of a lead line, about 60 characters. */
  leadMeasure: '34em',
  /** Footer column minimum: 2 x `spacing.jumbo` at default text, in rem so large text falls back to one column. */
  footerColumnMin: rem(2 * spacing.jumbo),
  /**
   * Card tile minimum on `/learners`: `touchTarget.child` plus `spacing.sm` (88 px at default text), so three tiles
   * fit across at 320 px and fewer as text grows.
   */
  tileMin: rem(touchTarget.child + spacing.sm),
} as const;

/** `#RRGGBB` as `r, g, b`, so a shadow can take the token colour with the token opacity. */
function rgbOf(hex: string): string {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16)).join(', ');
}

/** The `shadows.card` token as a CSS box-shadow. */
export function cardShadow(): string {
  const { shadowColor, shadowOffset, shadowOpacity, shadowRadius } = shadows.card;
  return `${shadowOffset.width}px ${shadowOffset.height}px ${shadowRadius}px rgba(${rgbOf(shadowColor)}, ${shadowOpacity})`;
}

/**
 * The custom properties `globals.css` reads in the `hr-site-*` rules (breakpoints, hover, focus, the fold chevron).
 * Set once on the site root (`SiteShell`), so the stylesheet holds no value of its own.
 */
export function siteCssVars(): CSSProperties {
  const vars: Record<string, string> = {
    '--hr-site-brand': colors.brand.primary,
    '--hr-site-brand-dark': colors.brand.primaryDark,
    '--hr-site-brand-light': colors.brand.primaryLight,
    '--hr-site-text': colors.text.primary,
    '--hr-site-text-secondary': colors.text.secondary,
    '--hr-site-on-primary': colors.text.onPrimary,
    '--hr-site-border-strong': colors.border.strong,
    '--hr-site-focus': colors.border.focus,
    '--hr-site-border-subtle': colors.border.subtle,
    '--hr-site-xxs': `${spacing.xxs}px`,
    '--hr-site-xs': `${spacing.xs}px`,
    '--hr-site-sm': `${spacing.sm}px`,
    '--hr-site-md': `${spacing.md}px`,
    '--hr-site-lg': `${spacing.lg}px`,
    '--hr-site-xl': `${spacing.xl}px`,
    '--hr-site-xxl': `${spacing.xxl}px`,
    '--hr-site-xxxl': `${spacing.xxxl}px`,
    '--hr-site-gutter-compact': `${layout.gutter.compact}px`,
    '--hr-site-gutter-regular': `${layout.gutter.regular}px`,
    '--hr-site-gutter-wide': `${layout.gutter.wide}px`,
    '--hr-site-border-thin': `${borderWidth.thin}px`,
    '--hr-site-border-base': `${borderWidth.base}px`,
    '--hr-site-border-thick': `${borderWidth.thick}px`,
    '--hr-site-touch-min': `${touchTarget.min}px`,
    '--hr-site-size-body': rem(typography.size.body),
    '--hr-site-size-body-lg': rem(typography.size.bodyLg),
    '--hr-site-size-prompt': rem(typography.size.prompt),
    '--hr-site-size-display': rem(typography.size.display),
    '--hr-site-size-title': rem(typography.size.title),
    '--hr-site-size-hero': rem(typography.size.hero),
    '--hr-site-z-sticky': String(z.sticky),
    '--hr-site-footer-col-min': SITE_SIZES.footerColumnMin,
    '--hr-site-tile-min': SITE_SIZES.tileMin,
  };
  return vars as CSSProperties;
}

/**
 * The hit area of every link and button on the site: at least `touchTarget.min` by `touchTarget.min` (padding, not font
 * size). Without `display`, for the header items whose display `globals.css` switches at a breakpoint.
 */
export const HIT_SIZE: CSSProperties = {
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: touchTarget.min,
  minWidth: touchTarget.min,
};

/** `HIT_SIZE` as an inline-flex box: every link and button the stylesheet does not show or hide. */
export const HIT: CSSProperties = { display: 'inline-flex', ...HIT_SIZE };

/**
 * The page column: content up to `layout.maxWidth.full`, centred; the side gutter is set by `globals.css`
 * (`hr-site-wrap`). Physical margins, not `margin-inline`: iOS 14.0 to 14.4 Safari lacks the logical properties, and
 * every site locale is left to right.
 */
export const WRAP: CSSProperties = {
  maxWidth: layout.maxWidth.full,
  marginLeft: 'auto',
  marginRight: 'auto',
};

/** Visually hidden but read by screen readers (a heading that keeps the outline in order). */
export const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * The shape of every primary action (the hero pill: `touchTarget.child`, `size.prompt`). Its colours, which change on
 * hover, are the `hr-site-primary` rule's (brand.primary, brand.primaryDark on hover, text.onPrimary).
 */
export const PRIMARY_ACTION: CSSProperties = {
  ...HIT,
  minHeight: touchTarget.child,
  padding: `0 ${spacing.xxl}px`,
  borderRadius: radii.pill,
  fontWeight: typography.weight.bold,
  fontSize: rem(typography.size.prompt),
  textAlign: 'center',
};

/**
 * The shape of a secondary action (an outline pill: `touchTarget.min`, `size.bodyLg`). Its colours are the
 * `hr-site-secondary` rule's (brand.primary outline and label; brand.primaryLight fill with a brand.primaryDark label
 * on hover, since brand.primary on brand.primaryLight is below AA for normal text).
 */
export const SECONDARY_ACTION: CSSProperties = {
  ...HIT,
  padding: `0 ${spacing.xl}px`,
  borderRadius: radii.pill,
  borderWidth: borderWidth.base,
  borderStyle: 'solid',
  fontWeight: typography.weight.bold,
  fontSize: rem(typography.size.bodyLg),
  textAlign: 'center',
};
