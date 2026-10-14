import { borderWidth, layout, radii, spacing, touchTarget } from '@hangul-route/design-system/tokens';
import type { WindowSize } from './stage-scale';

/**
 * The presenter's layout numbers that are not tokens (design/screens/presenter/README.md
 * "Constants"), each named once beside `stage-scale.ts` and derived from tokens where the design
 * derives it. Stage numbers are in stage units (multiply by `unit`); control numbers are real
 * pixels. Pure.
 */

/** The docked control-bar band: one row of hero buttons with `spacing.md` above and below (README D1). */
export const BAR_BAND = touchTarget.hero + 2 * spacing.md;

/** Every slide keeps this margin inside the stage, in units. */
export const STAGE_PADDING = spacing.xxxl;
/** Gap between slide parts, and inside a part, in units. */
export const STAGE_GAP = spacing.xxxl;
export const STAGE_GAP_INNER = spacing.xl;
/** Borders on the stage: a 1 or 2 px border vanishes on a projector. */
export const STAGE_BORDER = borderWidth.thick;
export const STAGE_RADIUS = radii.xl;

/** `StrokeHint size = unit x 360` (spec section 3.6). */
export const STROKE_PANEL = 360;
/** The stroke skeletons' viewBox (`jamo-strokes.ts`). */
export const STROKE_VIEWBOX = 200;
/** Stroke width and start dot on the 200 viewBox (README Constants, "stroke guide"). */
export const STROKE_LINE = 14;
export const STROKE_DOT_RADIUS = 14;
export const STROKE_DOT_RING = 4;
/** Hoya on title slides and the state pages, in units. */
export const HOYA_STAGE = 240;
/** The class code panel width, in units (README D7). */
export const CODE_PANEL = 400;

/** End slide fit rule (README D7): at most this many rows of letters and of words, then one "+ n more" pill. */
export const END_MAX_ROWS = 2;

/** Control-bar buttons: at least `touchTarget.hero` square, at most 1.5 x wide; Next / Reveal at least 1.5 x. */
export const CTL_MAX_WIDTH = 1.5 * touchTarget.hero;
export const NEXT_MIN_WIDTH = 1.5 * touchTarget.hero;
/** The start screen's one primary button. */
export const START_BUTTON_HEIGHT = 1.25 * touchTarget.hero;
/** A teacher page's readable column (the start screen and the state pages), px. */
export const TEACHER_COLUMN = layout.maxWidth.reading;

/** The start screen waits this long at most for the presenter font (spec section 3.6). */
export const FONT_WAIT_MS = 1500;

/** Touch: a horizontal swipe of at least 60 px with |dx| >= 1.5 |dy| (spec section 3.5). */
export const SWIPE_MIN = 60;
export const SWIPE_RATIO = 1.5;
/** A tap on the left third of the stage goes back, elsewhere forward. */
export const TAP_BACK_FRACTION = 1 / 3;

/** The stage box: the window minus the docked bar band, which stays when the bar hides (README D1). */
export function stageBox(window: WindowSize, band: number = BAR_BAND): WindowSize {
  return { width: Math.max(0, window.width), height: Math.max(0, window.height - band) };
}

/** A control drawn on the stage (the speaker) never drops below the bar's target size. */
export function stageButtonSize(unit: number, units: number = touchTarget.hero): number {
  return Math.max(touchTarget.hero, Math.round(unit * units));
}

/** `n` stage units in window pixels (geometry, not text: text goes through `stageText`). */
export function units(unit: number, n: number): number {
  return Math.round(unit * n);
}

