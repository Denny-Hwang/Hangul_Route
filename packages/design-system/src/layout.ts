import { layout, spacing, touchTarget } from './tokens';

/**
 * Safe-area layout math (audit p2-L2, UX-09). Pure so it is testable without a
 * renderer; `Screen` and the app's bottom tab bar build their padding here.
 *
 * Insets come from react-native-safe-area-context: the status bar / notch on
 * top, the home indicator at the bottom, and the notch on the left or right in
 * landscape. On the web they are the CSS `env(safe-area-inset-*)` values.
 */

export type ScreenEdge = 'top' | 'right' | 'bottom' | 'left';

export const ALL_SCREEN_EDGES: readonly ScreenEdge[] = ['top', 'right', 'bottom', 'left'];

/** Screens inside the bottom tab navigator: the tab bar owns the bottom inset. */
export const TAB_SCREEN_EDGES: readonly ScreenEdge[] = ['top', 'right', 'left'];

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export interface ScreenPadding {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
}

/**
 * Base padding plus the safe-area inset on each edge the screen owns. A screen
 * inside the tab navigator leaves `bottom` out — the tab bar already sits over
 * the home indicator.
 */
export function screenPadding(
  base: number,
  insets: EdgeInsets,
  edges: readonly ScreenEdge[] = ALL_SCREEN_EDGES,
): ScreenPadding {
  const inset = (edge: ScreenEdge): number => (edges.includes(edge) ? Math.max(0, insets[edge]) : 0);
  return {
    paddingTop: base + inset('top'),
    paddingRight: base + inset('right'),
    paddingBottom: base + inset('bottom'),
    paddingLeft: base + inset('left'),
  };
}

export interface TabBarMetrics {
  height: number;
  paddingTop: number;
  paddingBottom: number;
  /** Side padding: the landscape-notch inset or the centring margin, whichever is larger. */
  paddingLeft: number;
  paddingRight: number;
}

/**
 * Bottom tab bar sized from the bottom inset: the tab row keeps the 64pt
 * touch-target floor and sits fully above the home indicator, with a small
 * gap where there is no inset.
 *
 * On a wide window the row is centred inside `layout.maxWidth.full` and clears
 * a landscape notch: each side pads by `max(side inset, (windowWidth - maxWidth.full) / 2)`
 * (F-LAYOUT-001 §3.2). Both extra arguments are optional, so one-argument callers
 * keep today's metrics (side padding 0).
 */
export function tabBarMetrics(
  bottomInset: number,
  sideInsets: { left: number; right: number } = { left: 0, right: 0 },
  windowWidth = 0,
): TabBarMetrics {
  const paddingTop = spacing.xs;
  const paddingBottom = Math.max(spacing.sm, bottomInset);
  const centring = Number.isFinite(windowWidth) ? Math.max(0, (windowWidth - layout.maxWidth.full) / 2) : 0;
  return {
    height: paddingTop + touchTarget.min + paddingBottom,
    paddingTop,
    paddingBottom,
    paddingLeft: Math.max(sideInsets.left, centring, 0),
    paddingRight: Math.max(sideInsets.right, centring, 0),
  };
}

// ---------------------------------------------------------------------------
// Layout classes (F-LAYOUT-001 §3.1)
// ---------------------------------------------------------------------------

export type WidthClass = 'compact' | 'regular' | 'wide';
export type FormFactor = 'phone' | 'tablet';

export interface LayoutClass {
  width: WidthClass;
  /** Window height below `layout.shortHeight`. */
  short: boolean;
  /** `landscape` iff width > height (an unknown size is `portrait`). */
  orientation: 'portrait' | 'landscape';
  /** `phone` iff min(w, h) < phoneShortSide and max(w, h) <= phoneMaxLongSide. */
  form: FormFactor;
  /** 2 iff `width === 'wide'` and not `short`. */
  panes: 1 | 2;
  /**
   * Landscape and window width >= `layout.sideBySideMin`, at ANY height (reader,
   * Discover; F-STORY-002 §3.3). Games decide per screen whether to honour it on a short window.
   */
  sideBySide: boolean;
  gutter: number;
  maxWidth: { reading: number; full: number };
  /** `layout.mediaScale[width]`; 1 when `short`. Apply it with `scaleMedia` / `useMediaSize`. */
  mediaScale: number;
  cardColumns: number;
  windowWidth: number;
  windowHeight: number;
}

/** 0, NaN, negative and infinite sizes (the first web frame can report 0) count as unknown = 0. */
function knownSize(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Pure: a window size to the layout class. Boundaries are inclusive on the upper
 * class (`width >= 600` is `regular`, `>= 900` is `wide`). An unknown width is
 * `compact`; an unknown height is never `short` and never makes the window landscape.
 */
export function layoutClassFor(size: { width: number; height: number }): LayoutClass {
  const w = knownSize(size.width);
  const h = knownSize(size.height);
  const width: WidthClass = w >= layout.breakpoint.wide ? 'wide' : w >= layout.breakpoint.regular ? 'regular' : 'compact';
  const short = h > 0 && h < layout.shortHeight;
  const orientation = w > 0 && h > 0 && w > h ? 'landscape' : 'portrait';
  const form: FormFactor =
    Math.min(w, h) < layout.phoneShortSide && Math.max(w, h) <= layout.phoneMaxLongSide ? 'phone' : 'tablet';
  return {
    width,
    short,
    orientation,
    form,
    panes: width === 'wide' && !short ? 2 : 1,
    sideBySide: orientation === 'landscape' && w >= layout.sideBySideMin,
    gutter: layout.gutter[width],
    maxWidth: { reading: layout.maxWidth.reading, full: layout.maxWidth.full },
    mediaScale: short ? 1 : layout.mediaScale[width],
    cardColumns: layout.columns.cards[width],
    windowWidth: w,
    windowHeight: h,
  };
}

/** The only way a component scales a size with the window: `Math.round(base * mediaScale)`. */
export function scaleMedia(base: number, mediaScale: number): number {
  return Math.round(base * mediaScale);
}

// ---------------------------------------------------------------------------
// Screen width cap, gutter and sticky footer (F-LAYOUT-001 §3.2)
// ---------------------------------------------------------------------------

export type ScreenWidth = 'reading' | 'full' | 'bleed';

/** The content cap inside `Screen`; `bleed` has none. The background stays full-bleed either way. */
export function screenMaxWidth(width: ScreenWidth): number | undefined {
  return width === 'bleed' ? undefined : layout.maxWidth[width];
}

export interface ScreenFrameInput {
  width: ScreenWidth;
  widthClass: WidthClass;
  padded: boolean;
  insets: EdgeInsets;
  edges: readonly ScreenEdge[];
  hasFooter: boolean;
}

export interface ScreenFrame {
  /** Padding of the content (scroll content or fixed body). */
  body: ScreenPadding;
  /** Padding around the sticky footer slot; null without a footer. */
  footer: ScreenPadding | null;
  maxWidth: number | undefined;
}

/**
 * Everything `Screen` needs to lay itself out. The gutter is the width class's
 * (`layout.gutter`, which is `spacing.lg` on compact: phones are unchanged);
 * insets stack on the gutter, outside the cap. With a footer the bottom edge
 * moves to the footer, so the footer sits inside the bottom safe-area padding
 * and the content keeps only the gutter below it.
 */
export function screenFrame(i: ScreenFrameInput): ScreenFrame {
  const base = i.padded ? layout.gutter[i.widthClass] : 0;
  const maxWidth = screenMaxWidth(i.width);
  if (!i.hasFooter) return { body: screenPadding(base, i.insets, i.edges), footer: null, maxWidth };
  const withoutBottom = i.edges.filter((e) => e !== 'bottom');
  const full = screenPadding(base, i.insets, i.edges);
  return {
    body: screenPadding(base, i.insets, withoutBottom),
    footer: {
      paddingTop: 0,
      paddingRight: full.paddingRight,
      paddingBottom: full.paddingBottom,
      paddingLeft: full.paddingLeft,
    },
    maxWidth,
  };
}
