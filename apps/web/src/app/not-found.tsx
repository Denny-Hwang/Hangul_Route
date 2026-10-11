// Next's own 404 body, the page the export has always written to out/404.html (the Worker serves it for
// unknown paths). Kept as it was; only the document around it is ours now (see layout.tsx).
import NotFound from 'next/dist/client/components/not-found-error';
import { SiteDocument } from '../components/SiteDocument';

export default function NotFoundPage(): JSX.Element {
  return (
    <SiteDocument lang="en">
      <NotFound />
    </SiteDocument>
  );
}
