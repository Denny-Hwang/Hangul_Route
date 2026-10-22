'use client';

import { personaHint } from '@hangul-route/content-schema';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ClerkReverify } from '@/components/console/ClerkSignIn';
import { GrownUpRouter } from '@/components/console/GrownUpRouter';
import { SignInColumn } from '@/components/console/SignInParts';
import { useConsoleAuth } from '@/components/console/auth-context';
import { wantsSchoolFocus } from '@/lib/console/teacher-home';

/**
 * `/teach` — the teacher persona's entry, now a router page (F-APP-001 A-4b, section 3.7). No UI
 * beyond "Taking you to …" and a Go now link. It reads a hint from `?persona=` or `?as=` when
 * present, otherwise none (old `/teach` bookmarks were the sign-in of every grown-up, families
 * included). Signed out, the shared layout sends it to `/signin` with that hint (and `next` when
 * the URL has a query); signed in, it goes to the persona home with that hint. A sign-in record
 * that reaches it (the router's Go now, or Clerk following a return URL here) gets the same
 * reverification as on `/signin`. [OA] `?focus=school` (the chooser's School row) is the teacher hint and is carried
 * to the teacher home, which moves focus to its first school card.
 */
function TeachRouter(): JSX.Element {
  const params = useSearchParams() ?? new URLSearchParams();
  const auth = useConsoleAuth();
  // [OA] The chooser's School row (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 5.3, row OA-4b): `focus=school` is the
  // teacher home at its School group, so it reads as the teacher hint and travels on to the home.
  const schoolFocus = wantsSchoolFocus(params);
  const hint = personaHint(params) ?? (schoolFocus ? 'teacher' : null);
  return (
    <SignInColumn>
      {auth.ready && auth.session ? (
        <GrownUpRouter next={null} hint={hint} schoolFocus={schoolFocus} reverify={auth.mode === 'clerk' ? (props) => <ClerkReverify {...props} /> : undefined} />
      ) : null}
    </SignInColumn>
  );
}

export default function TeachRouterPage(): JSX.Element {
  return (
    <Suspense fallback={<SignInColumn>{null}</SignInColumn>}>
      <TeachRouter />
    </Suspense>
  );
}
