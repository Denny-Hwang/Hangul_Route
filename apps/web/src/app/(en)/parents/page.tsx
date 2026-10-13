import type { Metadata } from 'next';
import { ParentsPage } from '../../../components/landing/ParentsPage';
import { siteMetadataFor } from '../../../lib/site-metadata';

/** `/parents` (F-SITE-002 §3.5): its own title and description, with hreflang alternates once a second locale ships. */
export function generateMetadata(): Metadata {
  return siteMetadataFor('en', '/parents');
}

export default function EnglishParentsPage(): JSX.Element {
  return <ParentsPage locale="en" />;
}
