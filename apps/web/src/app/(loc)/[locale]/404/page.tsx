import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NotFoundPage } from '../../../../components/landing/NotFoundPage';
import { isSiteLocale } from '../../../../lib/site-locales';
import { siteNotFoundMetadata } from '../../../../lib/site-metadata';

/**
 * The 404 page of `/es` and `/ko` (AMENDMENTS-SITE-NEWUSER SN-2): exported to `out/<locale>/404.html`, which the
 * Worker's `404-page` mode serves for an unknown path under the locale (it serves the nearest 404.html), in the
 * locale's own `<html lang>`, words and links. Not in `SITE_PAGES`, so never in the sitemap; `noindex`.
 */
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return siteNotFoundMetadata(isSiteLocale(params.locale) ? params.locale : 'en');
}

export default function LocaleNotFoundPage({ params }: { params: { locale: string } }): JSX.Element {
  if (!isSiteLocale(params.locale)) notFound();
  return <NotFoundPage locale={params.locale} />;
}
