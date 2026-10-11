import { LOCALE_META } from '@hangul-route/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { SiteDocument } from '../../../components/SiteDocument';
import { HIDDEN_LOCALE_ATTR, isShippedSiteLocale, isSiteLocale, siteLocaleParams } from '../../../lib/site-locales';

/**
 * The site in another UI locale — `/es`, `/ko` and their About and legal pages
 * (F-I18N-001 §3.4, PR 11b). It lives inside `[locale]`, so the static HTML carries `<html lang>`.
 * Every site locale is rendered; one that has not shipped (all are shown on a QA build) is marked
 * `noindex` and with `HIDDEN_LOCALE_ATTR`, and `scripts/prune-hidden-locales.mjs` removes it from `out/`
 * after `next build`. Any other path is a 404. Per-locale metadata and hreflang come with PR 11c.
 */
export const dynamicParams = false;

export function generateStaticParams(): Array<{ locale: string }> {
  return siteLocaleParams();
}

/** On top of the site metadata (`app/layout.tsx`): a hidden locale is never indexed, even if a copy got out. */
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  if (isSiteLocale(params.locale) && isShippedSiteLocale(params.locale)) return {};
  return { robots: { index: false, follow: false } };
}

export default function LocaleSiteLayout({ children, params }: { children: ReactNode; params: { locale: string } }): JSX.Element {
  const { locale } = params;
  if (!isSiteLocale(locale)) notFound();
  const htmlAttrs = isShippedSiteLocale(locale) ? undefined : { [HIDDEN_LOCALE_ATTR]: locale };
  return (
    <SiteDocument lang={LOCALE_META[locale].htmlLang} htmlAttrs={htmlAttrs}>
      {children}
    </SiteDocument>
  );
}
