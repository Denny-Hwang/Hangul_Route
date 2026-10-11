import type { Metadata } from 'next';
import { LandingPage } from '../../components/landing/LandingPage';
import { siteMetadataFor } from '../../lib/site-metadata';

/** Per-locale metadata with hreflang alternates once a second locale ships (F-I18N-001 PR 11c). */
export function generateMetadata(): Metadata {
  return siteMetadataFor('en', '/');
}

export default function HomePage(): JSX.Element {
  return <LandingPage locale="en" />;
}
