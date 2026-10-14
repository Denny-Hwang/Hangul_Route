import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LicensesPage as Licenses } from '../../../../components/landing/LicensesPage';
import { isSiteLocale } from '../../../../lib/site-locales';
import { siteMetadataFor } from '../../../../lib/site-metadata';

/** The page's metadata in its locale, with hreflang alternates once a second locale ships (F-I18N-001 PR 11c). */
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return siteMetadataFor(isSiteLocale(params.locale) ? params.locale : 'en', '/licenses');
}

export default function LocaleLicensesPage({ params }: { params: { locale: string } }): JSX.Element {
  if (!isSiteLocale(params.locale)) notFound();
  return <Licenses locale={params.locale} />;
}
