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

/** Whether a sticky bar this tall may stay sticky in a window this tall: at most `maxShare` of it (any bar while the window is unknown). */
export function stickyFits(barHeight: number, windowHeight: number, maxShare: number): boolean {
  return !(windowHeight > 0) || barHeight <= windowHeight * maxShare;
}

/**
 * A sticky bottom bar that steps aside when it would cover too much (AMENDMENTS-LECTURE-V2 section 18.3, row LV-4):
 * like `useStickyClearance`, and the bar is `stuck` only while its height, less the parts marked
 * `data-sticky-extra` (a status line that comes and goes), is at most `maxShare` of the window. A landscape phone
 * or 200 % text can make the bar tall; it then sits at the end of the page (`stuck` false, no scroll padding)
 * instead of covering the page. Measured again when the bar resizes and when the window does (a phone turned).
 */
export function useFittingStickyBar<T extends HTMLElement>(maxShare: number): { ref: RefCallback<T>; stuck: boolean } {
  const [bar, setBar] = useState<{ height: number; base: number } | null>(null);
  const [view, setView] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) {
      setBar(null);
      return;
    }
    const measure = (): void => {
      const height = el.getBoundingClientRect().height;
      let extra = 0;
      el.querySelectorAll?.('[data-sticky-extra]').forEach((node) => {
        extra += node.getBoundingClientRect().height;
      });
      setBar({ height, base: height - extra });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(measure);
    observer.current.observe(el);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
    const read = (): void => setView(typeof window.innerHeight === 'number' ? window.innerHeight : 0);
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  const stuck = bar === null || stickyFits(bar.base, view, maxShare);
  const clearance = bar !== null && stuck ? bar.height : null;
  useEffect(() => {
    if (clearance === null || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const before = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = stickyClearance(clearance);
    return () => {
      root.style.scrollPaddingBottom = before;
    };
  }, [clearance]);
  useEffect(() => () => observer.current?.disconnect(), []);
  return { ref, stuck };
}
