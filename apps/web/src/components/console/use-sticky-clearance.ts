'use client';

import { spacing } from '@hangul-route/design-system/tokens';
import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react';

/** The page's `scroll-padding-bottom` for a sticky bar this tall: its height rounded up, plus a small gap. */
export function stickyClearance(barHeight: number): string {
  return `${Math.max(0, Math.ceil(barHeight)) + spacing.sm}px`;
}

/**
 * A sticky bottom bar's clearance (AMENDMENTS-LESSON-CHOOSER section 6, WCAG 2.4.11): the ref goes on the bar;
 * while it is mounted the document's `scroll-padding-bottom` is the bar's measured height (measured again when it
 * wraps, as at 200 % text), so keyboard focus on a row the bar covers scrolls the row above the bar. The previous
 * value comes back when the bar leaves the page. Without `ResizeObserver` (tests, old browsers) the first measure stays; without a
 * document (server render) nothing is set.
 */
export function useStickyClearance<T extends HTMLElement>(): RefCallback<T> {
  const [height, setHeight] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    // The bar left the page (the readout replaced the builder): the padding goes with it.
    if (!el) {
      setHeight(null);
      return;
    }
    const measure = (): void => setHeight(el.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(measure);
    observer.current.observe(el);
  }, []);
  useEffect(() => {
    if (height === null || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const before = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = stickyClearance(height);
    return () => {
      root.style.scrollPaddingBottom = before;
    };
  }, [height]);
  useEffect(() => () => observer.current?.disconnect(), []);
  return ref;
}
