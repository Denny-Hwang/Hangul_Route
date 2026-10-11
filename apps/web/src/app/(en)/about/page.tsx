import type { Metadata } from 'next';
import { AboutPage as About } from '../../../components/landing/AboutPage';
import { siteMetadataFor } from '../../../lib/site-metadata';

/** Per-locale metadata with hreflang alternates once a second locale ships (F-I18N-001 PR 11c). */
export function generateMetadata(): Metadata {
  return siteMetadataFor('en', '/about');
}

export default function AboutPage(): JSX.Element {
  return <About locale="en" />;
}
