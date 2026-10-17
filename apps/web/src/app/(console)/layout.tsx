import type { ReactNode } from 'react';
import { SiteDocument } from '../../components/SiteDocument';

/**
 * `/teach`, `/parent` and `/design-preview` (F-I18N-001 §3.4, PR 11b). No URL prefix: the console picks its
 * locale on the client (`LocaleProvider` in `GrownUpLayout`), so the static HTML stays `en`. The root font size
 * follows the device's chosen text size (owner items 6 and 7): the provider sets `--hr-text-scale` and the root
 * `font-size: calc(100% * var(--hr-text-scale, 1))` from the device record before the grown-up gate paints, and
 * every console type size is in rem.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }): JSX.Element {
  return <SiteDocument lang="en">{children}</SiteDocument>;
}
