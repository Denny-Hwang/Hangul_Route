import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TermsPage as Terms } from '../../../../components/landing/TermsPage';
import { isSiteLocale } from '../../../../lib/site-locales';
import { siteMetadataFor } from '../../../../lib/site-metadata';

/** The page's metadata in its locale, with hreflang alternates once a second locale ships (F-I18N-001 PR 11c). */
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return siteMetadataFor(isSiteLocale(params.locale) ? params.locale : 'en', '/terms');
}

export default function LocaleTermsPage({ params }: { params: { locale: string } }): JSX.Element {
  if (!isSiteLocale(params.locale)) notFound();
  return <Terms locale={params.locale} />;
}
