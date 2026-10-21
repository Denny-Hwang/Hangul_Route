'use client';

import type { Messages, UiLocale } from '@hangul-route/i18n';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { createConsoleApi, type ConsoleApi } from '@/lib/console/api';
import { apiBaseUrl } from '@/lib/console/config';
import { signInHome } from '@/lib/console/grown-up-lock';
import { signedOutTarget } from '@/lib/console/signin-flow';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { useConsoleAuth } from './auth-context';

export interface ConsoleSessionView {
  accountId: string;
  displayName: string;
  email?: string;
}

export interface ConsoleView {
  ready: boolean;
  session: ConsoleSessionView | null;
  api: ConsoleApi | null;
  signOut: () => void;
  /** The dictionary for the console's UI locale (F-I18N-001 §3.2). */
  m: Messages;
  locale: UiLocale;
}

/**
 * Session, API and messages for console pages; sends a signed-out visitor to
 * `/signin?next=<this page and its query>` (F-CONSOLE-001 §3.2, F-AUTH-002; F-APP-001 section 3.7).
 * `m` / `locale` follow the header language select.
 */
export function useConsole(): ConsoleView {
  const router = useRouter();
  const auth = useConsoleAuth();
  const { messages: m, locale } = useConsoleLocale();

  useEffect(() => {
    if (auth.ready && !auth.session) router.replace(signedOutTarget(window.location.pathname, window.location.search));
  }, [auth.ready, auth.session, router]);

  const api = useMemo(() => {
    const endpoint = apiBaseUrl();
    return auth.session && endpoint ? createConsoleApi({ endpoint, token: auth.getToken }) : null;
  }, [auth.session, auth.getToken]);

  // Sign out goes to `/signin?lang=<this page's language>` (AMENDMENTS-DISPLAY-NAV section 6).
  const signOut = (): void => {
    void auth.signOut().finally(() => router.replace(signInHome(locale)));
  };

  return { ready: auth.ready, session: auth.session, api, signOut, m, locale };
}
