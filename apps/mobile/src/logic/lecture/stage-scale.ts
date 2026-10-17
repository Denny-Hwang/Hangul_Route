/**
 * Presenter stage scale (F-TCH-004 §3.6), pure.
 *
 * A slide is laid out on a logical stage `bounds.width` units wide (1280).
 * Its logical height follows the window, `width * h / w`, clamped to
 * `minHeight..maxHeight` (600..960: about 2:1 up to 4:3), so a 4:3 projector
 * gets a taller stage instead of bars. When the clamp binds the stage is
 * letterboxed and centred: one unit is the smaller of `w / width` and
 * `h / logicalHeight`, so the stage never overflows (a 21:9 window gets bars
 * left and right, a portrait window bars top and bottom). Components size
 * everything as `unit * n`, never with a CSS transform.
 *
 * The bounds are passed in (the presenter passes `presenter.stage` and the
 * compact breakpoint from the design tokens), so this module holds no layout
 * numbers of its own and imports no design-system runtime (Metro cannot
 * resolve a package subpath, and the package root pulls React Native into the
 * unit tests).
 *
 * `tooSmall`: the stage box is narrower than the compact breakpoint
 * (`layout.breakpoint.regular`, 600 px; §3.6 "about 640 px"). There the 18 px
 * text floor lifts captions and romanization well above their stage size and
 * the slide layout can overflow, so the presenter shows the "make the window
 * bigger or turn the screen" hint instead of a cramped slide.
 */

export interface StageBounds {
  readonly width: number;
  readonly minHeight: number;
  readonly maxHeight: number;
  /** Below this stage width the presenter shows the bigger-window hint (`layout.breakpoint.regular`). */
  readonly compactWidth: number;
}

export interface WindowSize {
  readonly width: number;
  readonly height: number;
}

export interface StageScale {
  /** Window pixels per stage unit. */
  unit: number;
  logicalWidth: number;
  logicalHeight: number;
  /** The stage box in window pixels. */
  stageWidth: number;
  stageHeight: number;
  /** Bars on each side when letterboxed (centred), in window pixels. */
  offsetX: number;
  offsetY: number;
  letterboxed: boolean;
  /** Taller than wide: the presenter shows a "turn the screen" hint. */
  portrait: boolean;
  /** The stage is narrower than the compact breakpoint: the presenter shows the bigger-window hint. */
  tooSmall: boolean;
}

const usable = (n: number): boolean => Number.isFinite(n) && n > 0;

export function stageScale(size: WindowSize, bounds: StageBounds): StageScale {
  const { width: w, height: h } = size;
  if (!usable(w) || !usable(h)) {
    return {
      unit: 0,
      logicalWidth: bounds.width,
      logicalHeight: bounds.minHeight,
      stageWidth: 0,
      stageHeight: 0,
      offsetX: 0,
      offsetY: 0,
      letterboxed: false,
      portrait: false,
      tooSmall: false,
    };
  }
  const natural = (bounds.width * h) / w;
  const logicalHeight = Math.min(bounds.maxHeight, Math.max(bounds.minHeight, natural));
  const portrait = h > w;
  if (logicalHeight === natural) {
    // The window has a stage shape: the stage is the window.
    return {
      unit: w / bounds.width,
      logicalWidth: bounds.width,
      logicalHeight,
      stageWidth: w,
      stageHeight: h,
      offsetX: 0,
      offsetY: 0,
      letterboxed: false,
      portrait,
      tooSmall: w < bounds.compactWidth,
    };
  }
  const unit = Math.min(w / bounds.width, h / logicalHeight);
  const stageWidth = bounds.width * unit;
  const stageHeight = logicalHeight * unit;
  return {
    unit,
    logicalWidth: bounds.width,
    logicalHeight,
    stageWidth,
    stageHeight,
    offsetX: (w - stageWidth) / 2,
    offsetY: (h - stageHeight) / 2,
    letterboxed: true,
    portrait,
    tooSmall: stageWidth < bounds.compactWidth,
  };
}

/** Text size in window pixels for `n` stage units, never below `floor` (the charter body floor, `typography.size.body`). */
export function stageText(unit: number, n: number, floor: number): number {
  return Math.max(floor, Math.round(unit * n));
}

/** The layout tokens of a phone (`layout.phoneShortSide`, `layout.phoneMaxLongSide`), passed in. */
export interface PhoneRule {
  readonly shortSide: number;
  readonly maxLongSide: number;
}

/**
 * A phone window (F-TCH-004 section 3.6 phone exception): the window's short side under
 * `shortSide` and its long side at most `maxLongSide`, on a screen whose short side is under
 * `shortSide`, with a coarse pointer (`matchMedia('(pointer: coarse)')`). The window decides the
 * layout; the screen and the pointer make sure it is a phone, so a small desktop window (800 x 500,
 * a fine pointer) or an iPad in split view (320 x 744 on a 1024 x 1366 screen) is not one. An
 * unknown screen counts as the window. A window of unknown size is not a phone.
 */
export function isPhoneWindow(
  input: { w: number; h: number; screenW?: number | null; screenH?: number | null; coarse: boolean },
  rule: PhoneRule,
): boolean {
  const { w, h, coarse } = input;
  if (!coarse || !usable(w) || !usable(h)) return false;
  const screenW = input.screenW != null && usable(input.screenW) ? input.screenW : w;
  const screenH = input.screenH != null && usable(input.screenH) ? input.screenH : h;
  return Math.min(w, h) < rule.shortSide && Math.max(w, h) <= rule.maxLongSide && Math.min(screenW, screenH) < rule.shortSide;
}

/** What the presenter draws for a running lesson: the slide, the too-small page, or (a phone held upright) the rotate page. */
export type StageView = 'slide' | 'too-small' | 'rotate';

/**
 * Section 3.6: in a phone window taller than wide the lesson shows the rotate page, never a
 * letterboxed strip; otherwise a stage under its gate shows the too-small page.
 */
export function stageView(input: { phone: boolean; window: WindowSize; tooSmall: boolean }): StageView {
  if (input.phone && input.window.height > input.window.width) return 'rotate';
  return input.tooSmall ? 'too-small' : 'slide';
}
