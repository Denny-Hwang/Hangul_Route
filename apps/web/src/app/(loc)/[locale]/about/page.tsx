import { notFound } from 'next/navigation';
import { AboutPage as About } from '../../../../components/landing/AboutPage';
import { isSiteLocale } from '../../../../lib/site-locales';

export default function LocaleAboutPage({ params }: { params: { locale: string } }): JSX.Element {
  if (!isSiteLocale(params.locale)) notFound();
  return <About locale={params.locale} />;
}
