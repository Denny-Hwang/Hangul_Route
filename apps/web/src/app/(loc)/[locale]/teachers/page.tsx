import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TeachersPage } from '../../../../components/landing/TeachersPage';
import { isSiteLocale } from '../../../../lib/site-locales';
import { siteMetadataFor } from '../../../../lib/site-metadata';

/** `/es/teachers`, `/ko/teachers` (F-SITE-002 §3.6): the page's metadata in its locale, hreflang once a locale ships. */
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return siteMetadataFor(isSiteLocale(params.locale) ? params.locale : 'en', '/teachers');
}

export default function LocaleTeachersPage({ params }: { params: { locale: string } }): JSX.Element {
  if (!isSiteLocale(params.locale)) notFound();
  return <TeachersPage locale={params.locale} />;
}
