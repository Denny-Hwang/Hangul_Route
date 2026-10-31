'use client';

import { ConsoleErrorPage, reloadPage } from '@/components/console/ConsoleErrorPage';

/**
 * The grown-up pages' error boundary (AMENDMENTS-GROWNUP-UX GX-14, section 9 P5): a page that fails to draw shows the
 * console's own error page in the device's language with Try again, which loads the page again (`reloadPage`). The
 * error itself is never shown or sent anywhere: it may carry a name or an id.
 */
export default function ConsoleError(_props: { error: Error & { digest?: string }; reset: () => void }): JSX.Element {
  return <ConsoleErrorPage retry={reloadPage} />;
}
