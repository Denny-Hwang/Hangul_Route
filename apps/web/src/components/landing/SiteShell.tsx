import { typography } from '@hangul-route/design-system/tokens';
import { DEFAULT_LOCALE, type UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { localeBannerOffers } from '../../data/landing-copy';
import { shownSiteLocales, type SitePage } from '../../lib/site-metadata';
import { WRAP, rem, siteCssVars } from '../../lib/site-style';
import { LocaleBanner } from './LocaleBanner';
import { SiteFooter } from './SiteFooter';
import { SiteHeader, type PersonaPage, type SiteChromeVariant } from './SiteHeader';

export interface SiteShellProps {
  locale: UiLocale;
  page: SitePage;
  /** The persona page being shown (marked in the header nav and the footer Guide group). */
  current?: PersonaPage;
  variant?: SiteChromeVariant;
  /** [SN] A 404 page: its `page` is `/` (links go home), but its header is not the home's (AMENDMENTS-SITE-NEWUSER §3.2). */
  notFound?: boolean;
  children: ReactNode;
}

/**
 * The frame of every page of the layered site (F-SITE-002 §3.2, §6): the skip link and the header, `main#content`
 * (the skip target), the footer. The root sets the token custom properties `globals.css` reads in its `hr-site-*`
 * rules and the body text size in rem, so a visitor's browser text size enlarges every line (§3.11).
 *
 * [SN] AMENDMENTS-SITE-NEWUSER §3.2: the "View in <language>" banner opens `main` on every English page (it was on `/`
 * only), offering the same page in the suggested locale; not on the legal variant. It is client-only, so the static
 * HTML is unchanged; session dismissal holds across pages.
 */
export function SiteShell({ locale, page, current, variant = 'default', notFound = false, children }: SiteShellProps): JSX.Element {
  const shown = shownSiteLocales();
  const banner = locale === DEFAULT_LOCALE && variant === 'default' && shown.length > 1;
  return (
    <div className="hr-site" style={{ ...siteCssVars(), fontSize: rem(typography.size.body), lineHeight: typography.leading.normal }}>
      <SiteHeader locale={locale} page={page} home={page === '/' && !notFound} current={current} variant={variant} />
      <main id="content" tabIndex={-1} className="hr-site-wrap" style={{ ...WRAP, outline: 'none' }}>
        {banner ? <LocaleBanner offers={localeBannerOffers(shown, page)} /> : null}
        {children}
      </main>
      <SiteFooter locale={locale} page={page} current={current} variant={variant} />
    </div>
  );
}
