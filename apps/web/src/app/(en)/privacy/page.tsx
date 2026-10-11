import type { Metadata } from 'next';
import { PrivacyPage as Privacy } from '../../../components/landing/PrivacyPage';
import { siteMetadataFor } from '../../../lib/site-metadata';

/** Per-locale metadata with hreflang alternates once a second locale ships (F-I18N-001 PR 11c). */
export function generateMetadata(): Metadata {
  return siteMetadataFor('en', '/privacy');
}

export default function PrivacyPage(): JSX.Element {
  return <Privacy locale="en" />;
}
