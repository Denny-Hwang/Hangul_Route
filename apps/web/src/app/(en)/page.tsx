import type { Metadata } from 'next';
import { HomePage as Home } from '../../components/landing/HomePage';
import { siteMetadataFor } from '../../lib/site-metadata';

/** Per-locale metadata with hreflang alternates once a second locale ships (F-I18N-001 PR 11c). */
export function generateMetadata(): Metadata {
  return siteMetadataFor('en', '/');
}

export default function HomePage(): JSX.Element {
  return <Home locale="en" />;
}
