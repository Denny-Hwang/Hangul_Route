// The English 404 page, the page the export writes to out/404.html; the Worker serves the nearest 404.html for an
// unknown path (apps/web/wrangler.toml), so `/es/...` and `/ko/...` get their own (`(loc)/[locale]/404`). The body is
// the site's (F-SITE-002 §3.7, AMENDMENTS-SITE-NEWUSER SN-2): the header and footer, the page's h1 and two ways on.
import type { Metadata } from 'next';
import { SiteDocument } from '../components/SiteDocument';
import { NotFoundPage } from '../components/landing/NotFoundPage';
import { siteNotFoundMetadata } from '../lib/site-metadata';

/** One `<title>`, and `noindex` alone: Next adds that line to this page itself. */
export const metadata: Metadata = siteNotFoundMetadata('en', true);

export default function EnglishNotFoundPage(): JSX.Element {
  return (
    <SiteDocument lang="en">
      <NotFoundPage locale="en" />
    </SiteDocument>
  );
}
