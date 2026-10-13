import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LearnersPage } from '../../../../components/landing/LearnersPage';
import { isSiteLocale } from '../../../../lib/site-locales';
import { siteMetadataFor } from '../../../../lib/site-metadata';

/** `/es/learners`, `/ko/learners` (F-SITE-002 §3.4): the page's metadata in its locale, hreflang once a locale ships. */
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return siteMetadataFor(isSiteLocale(params.locale) ? params.locale : 'en', '/learners');
}

export default function LocaleLearnersPage({ params }: { params: { locale: string } }): JSX.Element {
  if (!isSiteLocale(params.locale)) notFound();
  return <LearnersPage locale={params.locale} />;
}
