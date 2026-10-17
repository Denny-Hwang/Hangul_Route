'use client';

import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { rem } from '@/lib/console/rem';

/**
 * PageBack (AMENDMENTS-DISPLAY-NAV section 7.3, row DN-6; mock design/screens/app-shell/adult-frame.md, revision
 * 2026-10-16): the one way back of a console page that is not a persona home or a nav target, at the top left of the
 * content above the h1, the same place on every page and width. A link to the page above (never `history.back()`, so
 * a page opened in a new tab still goes somewhere): the `arrow-left` glyph and the page's own back message (the
 * space's name, or "Back to {page}" on a space's own page). At least one touch target tall, `size.body` bold primary
 * text, no border (it is a link); the label wraps rather than scroll the page at any text size.
 */
export interface PageBackLink {
  href: string;
  label: string;
}

/** The glyph beside the label (the mock's 24 on the 24 grid). */
export const PAGE_BACK_GLYPH = spacing.xl;

/** The rules (a class, so the focus ring and the wrap need no inline style); `AdultFrame` mounts them once. */
export const PAGE_BACK_CSS = `
.hr-page-back{display:inline-flex;align-items:center;gap:${spacing.xs}px;min-height:${touchTarget.min}px;min-width:${touchTarget.min}px;max-width:100%;box-sizing:border-box;padding:${spacing.xs}px ${spacing.md}px ${spacing.xs}px ${spacing.xs}px;margin:0 0 ${spacing.sm}px -${spacing.xs}px;border-radius:${radii.pill}px;color:${colors.text.primary};font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};text-decoration:none;overflow-wrap:anywhere}
.hr-page-back svg{flex:none}
.hr-page-back:hover{background:${colors.surface.sunken}}
.hr-page-back:focus-visible{outline:${borderWidth.thick}px solid ${colors.border.focus};outline-offset:${spacing.xxs}px}`;

export function PageBack({ href, label, testId = 'page-back' }: PageBackLink & { testId?: string }): JSX.Element {
  return (
    <Link className="hr-page-back" href={href} data-testid={testId}>
      <IconSvg name="arrow-left" size={PAGE_BACK_GLYPH} color={colors.text.primary} />
      <span>{label}</span>
    </Link>
  );
}
