import { typography } from '@hangul-route/design-system/tokens';
import type { UiLocale } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import type { SitePage } from '../../lib/site-metadata';
import { WRAP, rem, siteCssVars } from '../../lib/site-style';
import { SiteFooter } from './SiteFooter';
import { SiteHeader, type PersonaPage, type SiteChromeVariant } from './SiteHeader';

export interface SiteShellProps {
  locale: UiLocale;
  page: SitePage;
  /** The persona page being shown (marked in the header nav). */
  current?: PersonaPage;
  variant?: SiteChromeVariant;
  children: ReactNode;
}

/**
 * The frame of every page of the layered site (F-SITE-002 §3.2, §6): the skip link and the header, `main#content`
 * (the skip target), the footer. The root sets the token custom properties `globals.css` reads in its `hr-site-*`
 * rules and the body text size in rem, so a visitor's browser text size enlarges every line (§3.11).
 */
export function SiteShell({ locale, page, current, variant = 'default', children }: SiteShellProps): JSX.Element {
  return (
    <div className="hr-site" style={{ ...siteCssVars(), fontSize: rem(typography.size.body), lineHeight: typography.leading.normal }}>
      <SiteHeader locale={locale} current={current} variant={variant} />
      <main id="content" tabIndex={-1} className="hr-site-wrap" style={{ ...WRAP, outline: 'none' }}>
        {children}
      </main>
      <SiteFooter locale={locale} page={page} variant={variant} />
    </div>
  );
}
