'use client';

import { useEffect, useRef } from 'react';
import { watchVisibleRefresh } from '@/lib/console/visible-refresh';

/**
 * Reads the page's data again when the tab comes back into view, at most every 30 seconds (`watchVisibleRefresh`,
 * F-LEARN-001 section 3.11): a renamed learner shows on an open roster or report without a reload. The latest
 * `refresh` is called, so the page can pass a new closure on every render.
 */
export function useVisibleRefresh(refresh: () => void, enabled: boolean): void {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    // A page without a real document (the static export's server pass, a test stub) has no tab to watch.
    if (!enabled || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return undefined;
    return watchVisibleRefresh(document, () => latest.current());
  }, [enabled]);
}
