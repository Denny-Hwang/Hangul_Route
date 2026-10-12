'use client';

import { useEffect, useState } from 'react';
import { useMessages } from '@/lib/i18n/locale-context';
import { RouterPanel, SignInColumn } from './SignInParts';

/**
 * A legacy grown-up page on the app host (F-APP-001 sections 3.7, 3.8 and 3.13): `/teach/start`
 * (A-4b) and `/teach/billing` (A-5c) forward to their new page with the whole query (a Stripe
 * `?checkout=` return included), by one `location.replace`. The polite line and the visible link
 * are the router's.
 */
export function legacyTarget(to: string, search: string): string {
  const query = search.startsWith('?') ? search.slice(1) : search;
  return query ? `${to}?${query}` : to;
}

export function LegacyRedirect({ to, replace }: { to: string; replace?: (url: string) => void }): JSX.Element {
  const m = useMessages();
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    const target = legacyTarget(to, window.location.search);
    setHref(target);
    (replace ?? ((url: string) => window.location.replace(url)))(target);
  }, [to, replace]);
  return (
    <SignInColumn>
      <RouterPanel line={m.a11y.shell.redirecting} goNowLabel={m.console.signIn.router.goNow} href={href ?? to} />
    </SignInColumn>
  );
}
