'use client';

import { useEffect, useRef } from 'react';
import { watchRosterChanges } from '@/lib/console/roster-broadcast';

/**
 * Reads the page's data again at once when another console tab says a roster changed (`roster-broadcast.ts`, owner
 * report 2026-10-23), without waiting for the visible-refresh gap. The latest `refresh` is called.
 */
export function useRosterChanges(refresh: () => void, enabled: boolean): void {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => (enabled ? watchRosterChanges(() => latest.current()) : undefined), [enabled]);
}
