import type { ReactNode } from 'react';
import { SiteDocument } from '../../components/SiteDocument';

/** The English site — `/`, `/about`, `/privacy`, `/terms` (F-I18N-001 §3.4, PR 11b). */
export default function EnglishSiteLayout({ children }: { children: ReactNode }): JSX.Element {
  return <SiteDocument lang="en">{children}</SiteDocument>;
}
