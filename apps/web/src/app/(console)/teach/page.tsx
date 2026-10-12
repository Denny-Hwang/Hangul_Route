'use client';

import { personaHint } from '@hangul-route/content-schema';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { GrownUpRouter } from '@/components/console/GrownUpRouter';
import { SignInColumn } from '@/components/console/SignInParts';
import { useConsoleAuth } from '@/components/console/auth-context';

/**
 * `/teach` — the teacher persona's entry, now a router page (F-APP-001 A-4b, section 3.7). No UI
 * beyond "Taking you to …" and a Go now link. It reads a hint from `?persona=` or `?as=` when
 * present, otherwise none (old `/teach` bookmarks were the sign-in of every grown-up, families
 * included). Signed out, the shared layout sends it to `/signin` with that hint (and `next` when
 * the URL has a query); signed in, it goes to the persona home with that hint.
 */
function TeachRouter(): JSX.Element {
  const params = useSearchParams() ?? new URLSearchParams();
  const auth = useConsoleAuth();
  return <SignInColumn>{auth.ready && auth.session ? <GrownUpRouter next={null} hint={personaHint(params)} /> : null}</SignInColumn>;
}

export default function TeachRouterPage(): JSX.Element {
  return (
    <Suspense fallback={<SignInColumn>{null}</SignInColumn>}>
      <TeachRouter />
    </Suspense>
  );
}
