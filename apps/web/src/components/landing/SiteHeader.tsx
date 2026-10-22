import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import { learnerStart, signIn } from '../../lib/site-links';
import { SITE_PAGES } from '../../lib/site-metadata';
import { sitePath } from '../../lib/site-path';
import { HIT, HIT_SIZE, WRAP, rem } from '../../lib/site-style';

/** The persona pages, in nav order (F-SITE-002 §3.4 to §3.6). */
export const PERSONA_PAGES = ['learners', 'parents', 'teachers'] as const;
export type PersonaPage = (typeof PERSONA_PAGES)[number];

/**
 * The persona pages the export holds, in nav order: those whose path is in `SITE_PAGES`. The header and the footer
 * link only these, so no site link points at a page that has not shipped (S-4b adds `/parents` and `/teachers` to
 * `SITE_PAGES`, and their links appear with them).
 */
export const SHIPPED_PERSONA_PAGES: readonly PersonaPage[] = PERSONA_PAGES.filter((page) =>
  (SITE_PAGES as readonly string[]).includes(`/${page}`),
);

/** `default` on every site page; `legal` on /privacy and /terms: no Sign in and no Start learning (OD-14). */
export type SiteChromeVariant = 'default' | 'legal';

export interface SiteHeaderProps {
  locale: UiLocale;
  /** The persona page being shown, marked in the nav with `aria-current="page"`. */
  current?: PersonaPage;
  variant?: SiteChromeVariant;
}

/** The current page's non-colour marker: a thick `brand.primary` underline (mock design/screens/site/header.md). */
const CURRENT_MARK = {
  color: colors.text.primary,
  textDecorationLine: 'underline',
  textDecorationColor: colors.brand.primary,
  textDecorationThickness: borderWidth.thick,
  textUnderlineOffset: spacing.sm,
} as const;

/**
 * The site header (F-SITE-002 §3.2, §6; wireframe design/wireframes/site/header-footer.md; mock
 * design/screens/site/header.md). DOM order is the visual order at every width: skip link, brand, Start learning,
 * the persona links (the shipped ones), Sign in. Below 720 px (45em) Start learning and the nav carry `hr-site-wide-only`, which
 * `globals.css` sets to `display: none` (out of layout and the Tab order), so phones get one row: the brand and
 * Sign in. Nothing is behind a menu. The legal variant drops Sign in and Start learning (OD-14).
 *
 * Links to the app (Start learning, Sign in) are plain `<a>` in the same tab (they leave the site route group);
 * the brand and the persona links stay inside it (`next/link`). Every control is at least 64 x 64.
 */
export function SiteHeader({ locale, current, variant = 'default' }: SiteHeaderProps): JSX.Element {
  const t = getMessages(locale).landing;
  const full = variant === 'default';
  return (
    <>
      <a
        href="#content"
        className="hr-site-skip"
        style={{
          ...HIT,
          padding: `0 ${spacing.lg}px`,
          backgroundColor: colors.surface.paper,
          color: colors.text.primary,
          fontWeight: typography.weight.bold,
          borderRadius: radii.md,
        }}
      >
        {t.nav.skip}
      </a>
      <header className="hr-site-header" style={{ backgroundColor: colors.surface.canvas, borderBottom: `${borderWidth.thin}px solid ${colors.border.subtle}` }}>
        <div
          className="hr-site-wrap"
          style={{
            ...WRAP,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: spacing.xs,
            rowGap: 0,
            paddingTop: spacing.sm,
            paddingBottom: spacing.sm,
          }}
        >
          <Link
            href={sitePath(locale, '/')}
            className="hr-site-brand"
            style={{ ...HIT, justifyContent: 'flex-start', gap: spacing.sm, paddingRight: spacing.sm, color: colors.text.primary }}
          >
            {/* Not aria-hidden: from 720 to 959 px the mark is the brand's only visible label, so it is part of the
                link's accessible name (WCAG 2.5.3 Label in Name). */}
            <span
              className="hr-site-brand-mark"
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                width: spacing.xxxl,
                height: spacing.xxxl,
                borderRadius: radii.circle,
                backgroundColor: colors.brand.primary,
                color: colors.text.inverse,
                fontWeight: typography.weight.bold,
                fontSize: rem(typography.size.bodyLg),
              }}
            >
              {t.brand.mark}
            </span>
            {/* The name may wrap: with large text in a font wider than the system one, one line could pass 320 px. */}
            <span className="hr-site-brand-name" style={{ fontWeight: typography.weight.bold, fontSize: rem(typography.size.bodyLg) }}>
              {t.brand.name}
            </span>
          </Link>
          {full ? (
            <a
              href={learnerStart(locale)}
              className="hr-site-wide-only hr-site-header-start hr-site-primary"
              style={{ ...HIT_SIZE, padding: `0 ${spacing.xl}px`, borderRadius: radii.pill, fontWeight: typography.weight.bold, whiteSpace: 'nowrap' }}
            >
              {t.nav.start}
            </a>
          ) : null}
          <nav aria-label={t.nav.label} className="hr-site-wide-only hr-site-nav" style={{ alignItems: 'center', columnGap: spacing.xxs }}>
            {SHIPPED_PERSONA_PAGES.map((page) => (
              <Link
                href={sitePath(locale, `/${page}`)}
                key={page}
                className="hr-site-nav-link"
                aria-current={page === current ? 'page' : undefined}
                style={{
                  ...HIT,
                  padding: `0 ${spacing.md}px`,
                  fontWeight: typography.weight.semibold,
                  whiteSpace: 'nowrap',
                  ...(page === current ? CURRENT_MARK : {}),
                }}
              >
                {t.nav[page]}
              </Link>
            ))}
          </nav>
          {full ? (
            <a
              href={signIn(undefined, locale)}
              className="hr-site-signin"
              style={{
                ...HIT,
                padding: `0 ${spacing.lg}px`,
                borderWidth: borderWidth.base,
                borderStyle: 'solid',
                borderRadius: radii.pill,
                color: colors.text.primary,
                fontWeight: typography.weight.semibold,
                whiteSpace: 'nowrap',
              }}
            >
              {t.nav.signIn}
            </a>
          ) : null}
        </div>
      </header>
    </>
  );
}
