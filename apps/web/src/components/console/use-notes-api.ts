'use client';

import { useMemo } from 'react';
import { apiBaseUrl } from '@/lib/console/config';
import { createNotesApi, type NotesApi } from '@/lib/console/notes';
import { useConsoleAuth } from './auth-context';

/** The account note routes (F-FEEDBACK-001 section 7.2) with the console session's bearer; null while signed out or with no API base. */
export function useNotesApi(): NotesApi | null {
  const auth = useConsoleAuth();
  return useMemo(() => {
    const endpoint = apiBaseUrl();
    return auth.session && endpoint ? createNotesApi({ endpoint, token: auth.getToken }) : null;
  }, [auth.session, auth.getToken]);
}
