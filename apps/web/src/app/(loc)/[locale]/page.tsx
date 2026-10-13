import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomePage as Home } from '../../../components/landing/HomePage';
import { isSiteLocale } from '../../../lib/site-locales';
import { siteMetadataFor } from '../../../lib/site-metadata';

/** The page's metadata in its locale, with hreflang alternates once a second locale ships (F-I18N-001 PR 11c). */
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return siteMetadataFor(isSiteLocale(params.locale) ? params.locale : 'en', '/');
}

export default function LocaleHomePage({ params }: { params: { locale: string } }): JSX.Element {
  if (!isSiteLocale(params.locale)) notFound();
  return <Home locale={params.locale} />;
}
