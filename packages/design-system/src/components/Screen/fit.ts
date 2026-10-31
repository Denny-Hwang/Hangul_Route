import { createContext, useContext } from 'react';

/**
 * Whether a `Screen`'s content fits its window (docs/specs/AMENDMENTS-TOUCH.md KT-D3, section 5). A `TapBoard` reads it
 * to choose its web `touch-action`: a board on a screen that fits stops the browser from panning, so a graze is never
 * cancelled; on a screen that scrolls the vertical pan stays. `scrollY` is the screen's scroll offset now (native only,
 * 0 on the web), so a board on the old native architecture can move a rectangle it measured before a scroll.
 */
export interface ScreenFit {
  fits: boolean;
  scrollY(): number;
}

const NOT_KNOWN: ScreenFit = { fits: false, scrollY: () => 0 };

/** Outside any `Screen` a board assumes the page may scroll: the vertical pan stays. */
export const ScreenFitContext = createContext<ScreenFit>(NOT_KNOWN);

export function useScreenFit(): ScreenFit {
  return useContext(ScreenFitContext);
}

/** Content fits when it is no taller than the viewport, give or take a pixel of rounding. */
export function contentFits(contentHeight: number, viewportHeight: number): boolean {
  return viewportHeight > 0 && contentHeight <= viewportHeight + 1;
}

interface ScrollNode {
  scrollHeight: number;
  clientHeight: number;
  children?: ArrayLike<unknown>;
}

type ResizeObserverLike = new (cb: () => void) => { observe(target: unknown): void; disconnect(): void };

/**
 * The web fit, read from the DOM: the scroll node fits when its content is no taller than it. Observed on the scroll
 * node (the window, rotation) and its content (text size, content that grows). Returns the stop, or `null` where the
 * browser has no ResizeObserver (the board then keeps the vertical pan, the safe side).
 */
export function observeWebFit(node: ScrollNode | null | undefined, onFit: (fits: boolean) => void, Observer: ResizeObserverLike | undefined): (() => void) | null {
  if (node === null || node === undefined || typeof Observer !== 'function') return null;
  const check = (): void => onFit(contentFits(node.scrollHeight, node.clientHeight));
  const observer = new Observer(check);
  observer.observe(node);
  for (const child of Array.from(node.children ?? [])) observer.observe(child);
  check();
  return () => observer.disconnect();
}
