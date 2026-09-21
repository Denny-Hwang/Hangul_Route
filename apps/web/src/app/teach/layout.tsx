import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Console — Hangul Route',
  description: 'For parents, teachers and schools: create a class or family, share a code, see progress summaries.',
  robots: { index: false, follow: false },
};

export default function TeachLayout({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>;
}
