import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GrownUpLayout } from '@/components/console/GrownUpLayout';

export const metadata: Metadata = {
  title: 'Console — Hangul Route',
  description: 'For parents, teachers and schools: create a class or family, share a code, see progress summaries.',
  robots: { index: false, follow: false },
};

/** `/account/*` (F-APP-001 A-5c; `/account/billing` for every grown-up): the shared grown-up layout. */
export default function AccountLayout({ children }: { children: ReactNode }): JSX.Element {
  return <GrownUpLayout>{children}</GrownUpLayout>;
}
