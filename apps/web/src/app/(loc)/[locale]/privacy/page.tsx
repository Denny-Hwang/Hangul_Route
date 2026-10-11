import { notFound } from 'next/navigation';
import { PrivacyPage as Privacy } from '../../../../components/landing/PrivacyPage';
import { isSiteLocale } from '../../../../lib/site-locales';

export default function LocalePrivacyPage({ params }: { params: { locale: string } }): JSX.Element {
  if (!isSiteLocale(params.locale)) notFound();
  return <Privacy locale={params.locale} />;
}
