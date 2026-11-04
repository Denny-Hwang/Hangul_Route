import { createContext, useContext } from 'react';

/**
 * Whether a `Screen`'s content fits its window (docs/specs/AMENDMENTS-TOUCH.md KT-D3, section 5), and where its boards
 * register. A board reads `fits` to re-measure on native when it changes; a `Screen` turns native scrolling off only
 * while it fits and holds a registered board (and no text field is focused), so a form is never locked.
 */
export interface ScreenFit {
  fits: boolean;
  /** A mounted `TapBoard` registers; returns its unregister. */
  registerBoard(): () => void;
}

const NO_SCREEN: ScreenFit = { fits: false, registerBoard: () => () => undefined };

/** Outside any `Screen` a board assumes the page may scroll. */
export const ScreenFitContext = createContext<ScreenFit>(NO_SCREEN);

export function useScreenFit(): ScreenFit {
  return useContext(ScreenFitContext);
}

/** Native `scrollEnabled` (section 5): off only while the screen fits, holds a board and has no focused text field. */
export function nativeScrollEnabled(fits: boolean, boards: number, typing: boolean): boolean {
  return !(fits && boards > 0 && !typing);
}

/** The offset after scrolling by `delta`, kept inside the content (0 to content minus viewport). */
export function clampOffset(offset: number, delta: number, content: number, viewport: number): number {
  return Math.min(Math.max(0, offset + delta), Math.max(0, content - viewport));
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
