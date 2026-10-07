'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { createConsoleApi, type ConsoleApi } from '@/lib/console/api';
import { apiBaseUrl } from '@/lib/console/config';
import { ROUTES } from '@/lib/console/routing';
import { useConsoleAuth } from './auth-context';

export interface ConsoleSessionView {
  accountId: string;
  displayName: string;
  email?: string;
}

/** Session + API for console pages; sends a signed-out visitor to /teach (F-CONSOLE-001 §3.2, F-AUTH-002). */
export function useConsole(): { ready: boolean; session: ConsoleSessionView | null; api: ConsoleApi | null; signOut: () => void } {
  const router = useRouter();
  const auth = useConsoleAuth();

  useEffect(() => {
    if (auth.ready && !auth.session) router.replace(ROUTES.signIn);
  }, [auth.ready, auth.session, router]);

  const api = useMemo(() => {
    const endpoint = apiBaseUrl();
    return auth.session && endpoint ? createConsoleApi({ endpoint, token: auth.getToken }) : null;
  }, [auth.session, auth.getToken]);

  const signOut = (): void => {
    void auth.signOut().finally(() => router.replace(ROUTES.signIn));
  };

  return { ready: auth.ready, session: auth.session, api, signOut };
}
