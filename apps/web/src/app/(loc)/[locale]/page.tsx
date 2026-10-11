import { notFound } from 'next/navigation';
import { LandingPage } from '../../../components/landing/LandingPage';
import { isSiteLocale } from '../../../lib/site-locales';

export default function LocaleHomePage({ params }: { params: { locale: string } }): JSX.Element {
  if (!isSiteLocale(params.locale)) notFound();
  return <LandingPage locale={params.locale} />;
}
