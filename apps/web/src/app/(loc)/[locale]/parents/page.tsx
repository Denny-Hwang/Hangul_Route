import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ParentsPage } from '../../../../components/landing/ParentsPage';
import { isSiteLocale } from '../../../../lib/site-locales';
import { siteMetadataFor } from '../../../../lib/site-metadata';

/** `/es/parents`, `/ko/parents` (F-SITE-002 §3.5): the page's metadata in its locale, hreflang once a locale ships. */
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return siteMetadataFor(isSiteLocale(params.locale) ? params.locale : 'en', '/parents');
}

export default function LocaleParentsPage({ params }: { params: { locale: string } }): JSX.Element {
  if (!isSiteLocale(params.locale)) notFound();
  return <ParentsPage locale={params.locale} />;
}
