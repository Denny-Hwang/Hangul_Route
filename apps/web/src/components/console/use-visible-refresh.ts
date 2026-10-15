'use client';

import { useEffect, useRef } from 'react';
import { VISIBLE_POLL_MS, watchVisibleRefresh, type RefreshEvents } from '@/lib/console/visible-refresh';

export interface UseVisibleRefreshOptions {
  /** A roster page: also read slowly while the tab stays in view (`VISIBLE_POLL_MS`). Never a report page. */
  poll?: boolean;
}

/**
 * Reads the page's data again when the tab comes back into view or the window gets focus, at most every 30 seconds
 * (`watchVisibleRefresh`, F-LEARN-001 section 3.11): a renamed learner shows on an open roster or report without a
 * reload. The latest `refresh` is called, so the page can pass a new closure on every render.
 */
export function useVisibleRefresh(refresh: () => void, enabled: boolean, options: UseVisibleRefreshOptions = {}): void {
  const latest = useRef(refresh);
  latest.current = refresh;
  const poll = options.poll === true;
  useEffect(() => {
    // A page without a real document (the static export's server pass, a test stub) has no tab to watch.
    if (!enabled || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return undefined;
    const win: RefreshEvents | null = typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
    return watchVisibleRefresh(document, () => latest.current(), { win, pollMs: poll ? VISIBLE_POLL_MS : null });
  }, [enabled, poll]);
}
