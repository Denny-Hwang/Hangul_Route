import type { Metadata } from 'next';
import { LearnersPage } from '../../../components/landing/LearnersPage';
import { siteMetadataFor } from '../../../lib/site-metadata';

/** `/learners` (F-SITE-002 §3.4): its own title and description, with hreflang alternates once a second locale ships. */
export function generateMetadata(): Metadata {
  return siteMetadataFor('en', '/learners');
}

export default function EnglishLearnersPage(): JSX.Element {
  return <LearnersPage locale="en" />;
}
