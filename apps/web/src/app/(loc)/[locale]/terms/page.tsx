import { notFound } from 'next/navigation';
import { TermsPage as Terms } from '../../../../components/landing/TermsPage';
import { isSiteLocale } from '../../../../lib/site-locales';

export default function LocaleTermsPage({ params }: { params: { locale: string } }): JSX.Element {
  if (!isSiteLocale(params.locale)) notFound();
  return <Terms locale={params.locale} />;
}
