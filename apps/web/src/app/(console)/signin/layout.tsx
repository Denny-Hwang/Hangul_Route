import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GrownUpLayout } from '@/components/console/GrownUpLayout';

export const metadata: Metadata = {
  title: 'Grown-ups sign in — Hangul Route',
  description: 'Sign in for parents, caregivers and teachers. Learners never need an account.',
  robots: { index: false, follow: false },
};

/** `/signin` (F-APP-001 A-4b): the shared grown-up layout, where this page is exempt from the sign-in check and the lock. */
export default function SignInLayout({ children }: { children: ReactNode }): JSX.Element {
  return <GrownUpLayout>{children}</GrownUpLayout>;
}
