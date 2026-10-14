import type { Metadata } from 'next';
import { LicensesPage as Licenses } from '../../../components/landing/LicensesPage';
import { siteMetadataFor } from '../../../lib/site-metadata';

/** Per-locale metadata with hreflang alternates once a second locale ships (F-I18N-001 PR 11c). */
export function generateMetadata(): Metadata {
  return siteMetadataFor('en', '/licenses');
}

export default function LicensesPage(): JSX.Element {
  return <Licenses locale="en" />;
}
