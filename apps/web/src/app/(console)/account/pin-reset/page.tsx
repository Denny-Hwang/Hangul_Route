'use client';

import { PinResetView } from '@/components/console/PinResetPage';
import { SignInColumn } from '@/components/console/SignInParts';
import { useConsoleAuth } from '@/components/console/auth-context';
import { useConsole } from '@/components/console/use-console';

/**
 * `/account/pin-reset` — [OA] reset the grown-up PIN by signing in (AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 7.5 and
 * 8.5, row OA-6). Inside the shared grown-up layout like every `/account` page: signed out, the gate goes to
 * `/signin?next=/account/pin-reset` (the reset leg, which writes no trusted epoch and no PIN owner); locked, the lock's
 * Sign in again comes back here. Signed in and open, `PinResetView` checks and hands off. No API call.
 */
export default function PinResetPage(): JSX.Element {
  const { ready, session } = useConsole();
  const auth = useConsoleAuth();
  if (!ready || !session) return <SignInColumn>{null}</SignInColumn>;
  return <PinResetView accountId={session.accountId} reverifySecret={auth.reverifySecret} passkeys={auth.localeUser?.passkeys ?? null} />;
}
