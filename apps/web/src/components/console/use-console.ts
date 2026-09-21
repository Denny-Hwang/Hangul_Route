'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createConsoleApi, type ConsoleApi } from '@/lib/console/api';
import { apiBaseUrl } from '@/lib/console/config';
import { ROUTES } from '@/lib/console/routing';
import { clearSession, readSession, type ConsoleSession } from '@/lib/console/session';

/** Session + API for console pages; sends a signed-out visitor to /teach. */
export function useConsole(): { ready: boolean; session: ConsoleSession | null; api: ConsoleApi | null; signOut: () => void } {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<ConsoleSession | null>(null);

  useEffect(() => {
    const s = readSession();
    setSession(s);
    setReady(true);
    if (!s) router.replace(ROUTES.signIn);
  }, [router]);

  const api = useMemo(() => {
    const endpoint = apiBaseUrl();
    return session && endpoint ? createConsoleApi({ endpoint, token: session.token }) : null;
  }, [session]);

  const signOut = (): void => {
    clearSession();
    setSession(null);
    router.replace(ROUTES.signIn);
  };

  return { ready, session, api, signOut };
}
