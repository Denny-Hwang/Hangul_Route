import type { ReactNode } from 'react';
import { SiteDocument } from '../../components/SiteDocument';

/**
 * `/teach`, `/parent` and `/design-preview` (F-I18N-001 §3.4, PR 11b). No URL prefix: the console picks its
 * locale on the client (`LocaleProvider` in `teach/layout.tsx`), so the static HTML stays `en`.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }): JSX.Element {
  return <SiteDocument lang="en">{children}</SiteDocument>;
}
