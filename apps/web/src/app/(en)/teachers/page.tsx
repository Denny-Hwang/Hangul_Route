import type { Metadata } from 'next';
import { TeachersPage } from '../../../components/landing/TeachersPage';
import { siteMetadataFor } from '../../../lib/site-metadata';

/** `/teachers` (F-SITE-002 §3.6): its own title and description, with hreflang alternates once a second locale ships. */
export function generateMetadata(): Metadata {
  return siteMetadataFor('en', '/teachers');
}

export default function EnglishTeachersPage(): JSX.Element {
  return <TeachersPage locale="en" />;
}
