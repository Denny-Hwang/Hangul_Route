'use client';

import { spacing } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefCallback } from 'react';

/** The custom property the grouped picker's search, chips, rows and buttons read as `scroll-margin-bottom`. */
export const STICKY_CLEARANCE_VAR = '--hr-sticky-clearance';

/** The style that carries a sticky bar's height (plus a small gap) to the elements under it. */
export function clearanceStyle(barHeight: number): CSSProperties {
  return { [STICKY_CLEARANCE_VAR]: `${Math.max(0, Math.ceil(barHeight)) + spacing.sm}px` } as CSSProperties;
}

/**
 * A sticky bottom bar's clearance (AMENDMENTS-LESSON-CHOOSER section 6, WCAG 2.4.11): the ref goes
 * on the bar, the style on an ancestor of what scrolls under it. Keyboard focus that scrolls a
 * row into view then stops above the bar, at any text size (the bar is measured, and measured
 * again when it wraps). Without `ResizeObserver` (tests, old browsers) the first measure stays.
 */
export function useStickyClearance<T extends HTMLElement>(): [RefCallback<T>, CSSProperties] {
  const [height, setHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const measure = (): void => setHeight(el.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(measure);
    observer.current.observe(el);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, clearanceStyle(height)];
}
