import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GrownUpLayout } from '@/components/console/GrownUpLayout';

export const metadata: Metadata = {
  title: 'Console — Hangul Route',
  description: 'For parents, teachers and schools: create a class or family, share a code, see progress summaries.',
  robots: { index: false, follow: false },
};

/** `/parent` and `/parent/space/**` (F-APP-001 A-5b, the family persona): the shared grown-up layout. */
export default function ParentLayout({ children }: { children: ReactNode }): JSX.Element {
  return <GrownUpLayout>{children}</GrownUpLayout>;
}
