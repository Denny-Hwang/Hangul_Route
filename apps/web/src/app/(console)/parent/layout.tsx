import type { ReactNode } from 'react';
import { LocaleProvider } from '@/lib/i18n/locale-context';

/**
 * The `/parent` demo reads the console dictionary in the console's locale (F-I18N-001 PR 10c):
 * the same client-side `LocaleProvider` as `/teach` (stored choice, else the browser languages,
 * among the shipped locales), so the static HTML stays English.
 */
export default function ParentLayout({ children }: { children: ReactNode }): JSX.Element {
  return <LocaleProvider>{children}</LocaleProvider>;
}
