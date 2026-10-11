import type { Metadata } from 'next';
import { TermsPage as Terms } from '../../../components/landing/TermsPage';
import { siteMetadataFor } from '../../../lib/site-metadata';

/** Per-locale metadata with hreflang alternates once a second locale ships (F-I18N-001 PR 11c). */
export function generateMetadata(): Metadata {
  return siteMetadataFor('en', '/terms');
}

export default function TermsPage(): JSX.Element {
  return <Terms locale="en" />;
}
