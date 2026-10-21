import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GrownUpLayout } from '@/components/console/GrownUpLayout';

export const metadata: Metadata = {
  // Neutral until the client sets the localized `console.docTitle` (GrownUpLayout): never English-only jargon.
  title: 'Hangul Route',
  description: 'For parents, teachers and schools: create a class or family, share a code, see progress summaries.',
  robots: { index: false, follow: false },
};

/** The shared grown-up layout (F-APP-001 A-4b, section 3.7): locale, Clerk and the grown-up lock. */
export default function TeachLayout({ children }: { children: ReactNode }): JSX.Element {
  return <GrownUpLayout>{children}</GrownUpLayout>;
}
