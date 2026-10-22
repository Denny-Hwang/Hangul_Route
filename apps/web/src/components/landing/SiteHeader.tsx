import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { LOCALE_META, getMessages, type UiLocale } from '@hangul-route/i18n';
import Link from 'next/link';
import { learnerStart, signIn } from '../../lib/site-links';
import { SITE_PAGES, shownSiteLocales, type SitePage } from '../../lib/site-metadata';
import { sitePath } from '../../lib/site-path';
import { HIT, HIT_SIZE, WRAP, rem } from '../../lib/site-style';
import { LanguageMenu, type LanguageMenuItem } from './LanguageMenu';

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
  /**
   * The page being shown: the language control links the same page in each shown locale. The 404 pages pass `/`
   * (their path is unknown at build time, and an unknown path in another locale would be another 404).
   */
  page?: SitePage;
  /**
   * [SN] The home `/` (AMENDMENTS-SITE-NEWUSER §3.2, OD-SN-1, OD-SN-2): the header Start stays wide-only (the hero's
   * Start learning is on the first screen) and the brand name shows on phones from 22.5em. Defaults to `page === '/'`;
   * the 404 pages, which pass `page="/"`, pass `home={false}`.
   */
  home?: boolean;
  /** The persona page being shown, marked in the nav with `aria-current="page"`. */
  current?: PersonaPage;
  variant?: SiteChromeVariant;
}

/** The language control's links: the same page in every shown locale, named by its endonym (never a message). */
export function languageMenuItems(locale: UiLocale, page: SitePage, shown: readonly UiLocale[] = shownSiteLocales()): LanguageMenuItem[] {
  return shown.map((target) => ({
    href: sitePath(target, page),
    endonym: LOCALE_META[target].endonym,
    lang: LOCALE_META[target].htmlLang,
    current: target === locale,
  }));
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
 * The site header (F-SITE-002 §3.2, §6, amended by AMENDMENTS-SITE-NEWUSER §3.2; wireframes
 * design/wireframes/site/header-footer.md and newuser-header-language.md; mocks design/screens/site/header.md and
 * design/screens/site/newuser/). DOM order is the visual order at every width: skip link, brand, Start, the persona
 * links (the shipped ones), Language, Sign in. Phones (below 45em): `[brand] … [Start][Language][Sign in]` on one row,
 * Start pushed right; the nav carries `hr-site-wide-only` (`display: none` below 45em, out of layout and the Tab
 * order). [SN] The Start pill shows at every width except on `/`, where it keeps `hr-site-wide-only` (OD-SN-1); its
 * visible label is `nav.startShort` and its accessible name `nav.start`, which contains it (WCAG 2.5.3). The brand mark
 * shows at every width, its box in rem; the name shows from 30em to 45em and from 60em, and on `/` from 22.5em
 * (OD-SN-2). The legal variant drops Sign in and Start (OD-14) and keeps the language control.
 *
 * Links to the app (Start learning, Sign in) are plain `<a>` in the same tab (they leave the site route group);
 * the brand and the persona links stay inside it (`next/link`). Every control is at least 64 x 64.
 */
export function SiteHeader({ locale, page = '/', home = page === '/', current, variant = 'default' }: SiteHeaderProps): JSX.Element {
  const t = getMessages(locale).landing;
  const full = variant === 'default';
  // The phone Start pill is drawn on every full header but the home's; without it the language control takes the
  // auto margin that pushes the controls right.
  const phoneStart = full && !home;
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
        {/* The row is the language menu's containing block (`hr-site-header-row`), so the open menu stays on screen
            when large text wraps the control to a second row. Its column gap is the stylesheet's (0 below 45em). */}
        <div
          className="hr-site-wrap hr-site-header-row"
          style={{
            ...WRAP,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            rowGap: 0,
            paddingTop: spacing.sm,
            paddingBottom: spacing.sm,
          }}
        >
          <Link
            href={sitePath(locale, '/')}
            className={home ? 'hr-site-brand hr-site-brand-home' : 'hr-site-brand'}
            style={{ ...HIT, justifyContent: 'flex-start', gap: spacing.sm, paddingRight: spacing.sm, color: colors.text.primary }}
          >
            {/* Not aria-hidden: where the name is hidden the mark is the brand's only visible label, so it is part of the
                link's accessible name (WCAG 2.5.3 Label in Name). Its box is in rem, so enlarged text cannot split it. */}
            <span
              className="hr-site-brand-mark"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: rem(spacing.xxxl),
                height: rem(spacing.xxxl),
                flexShrink: 0,
                whiteSpace: 'nowrap',
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
              aria-label={t.nav.start}
              className={phoneStart ? 'hr-site-header-start hr-site-primary' : 'hr-site-wide-only hr-site-header-start hr-site-primary'}
              style={{ ...HIT_SIZE, borderRadius: radii.pill, fontWeight: typography.weight.bold, whiteSpace: 'nowrap' }}
            >
              {t.nav.startShort}
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
          <LanguageMenu label={t.footer.language} items={languageMenuItems(locale, page)} push={!phoneStart} />
          {full ? (
            <a
              href={signIn(undefined, locale)}
              className="hr-site-signin"
              style={{
                ...HIT,
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
