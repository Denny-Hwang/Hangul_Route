'use client';

import { useRouter } from 'next/navigation';
import { AdminInviteView } from '@/components/console/AdminInvitePage';
import { SignInColumn } from '@/components/console/SignInParts';
import { useConsoleAuth } from '@/components/console/auth-context';
import { useConsole } from '@/components/console/use-console';

/**
 * `/account/invite` — [SA] the school administrator invite page (AMENDMENTS-SEATS-ADMINS section 6.6, `APP_ROUTES.adminInvite`).
 * Inside the shared grown-up layout like every `/account` page: signed out, the gate goes to
 * `/signin?next=/account/invite` (the token already stashed by the gate, never in that address); locked, the lock's
 * Sign in again and PIN come back here. Signed in, `AdminInviteView` reads the stash and asks.
 */
export default function AdminInvitePage(): JSX.Element {
  const router = useRouter();
  const { ready, session, api, m } = useConsole();
  const auth = useConsoleAuth();
  if (!ready || !session) return <SignInColumn>{null}</SignInColumn>;
  return (
    <AdminInviteView
      api={api}
      who={session.email ?? session.displayName}
      m={m}
      go={(href) => router.replace(href)}
      switchAccount={(signInUrl) => void auth.signOut(signInUrl, { keepInvite: true })}
    />
  );
}
