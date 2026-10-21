import type { WindowSize } from './stage-scale';

/**
 * The presenter's layout numbers that are not tokens (design/screens/presenter/README.md
 * "Constants"), each named once beside `stage-scale.ts`. Stage numbers are in stage units
 * (multiply by `unit`); factors multiply a token. Pure: the token values themselves are applied in
 * `screens/presenter/stage-metrics.ts` (this module imports no design-system runtime, like
 * `stage-scale.ts`).
 */

/** `StrokeHint size = unit x 360` (spec section 3.6). */
export const STROKE_PANEL = 360;
/** The stroke skeletons' viewBox (`jamo-strokes.ts`). */
export const STROKE_VIEWBOX = 200;
/** Stroke width and start dot on the 200 viewBox (README Constants, "stroke guide"). */
export const STROKE_LINE = 14;
export const STROKE_DOT_RADIUS = 14;
export const STROKE_DOT_RING = 4;
/** Hoya on title slides, in units. */
export const HOYA_STAGE = 240;
/** A story scene on its slide and a story title's cover: the 400 x 300 scene canvas at one unit per point (slide-story.md). */
export const SCENE_STAGE = 400;
/** The class code panel width, in units (README D7). */
export const CODE_PANEL = 400;

/** Card and word pictures match the stroke panel, so slides line up (README Constants `--art-lg`), in units. */
export const ART_LG = 360;
/** The activity slide's [ Start timer ]: at least `touchTarget.hero`, else `unit x 112` tall (README Constants). */
export const STAGE_CTA_HEIGHT = 112;

/**
 * The shape and number marker (README Constants `--marker`): 2 x `presenter.size.body` = 80 units,
 * drawn on a 100 viewBox with a 6 stroke; the numeral is 40 (30 inside the triangle and the star,
 * which have less room) on the baseline given per shape. The order slide uses it (PR 7) and the
 * quiz options will (PR 9).
 */
export const MARKER_BODY_FACTOR = 2;
export const MARKER_VIEWBOX = 100;
export const MARKER_STROKE = 6;
export const MARKER_GEOMETRY = {
  circle: { kind: 'circle', cx: 50, cy: 50, r: 44, numeral: 40, baseline: 64 },
  triangle: { kind: 'path', d: 'M50 6 L95 90 L5 90 Z', numeral: 30, baseline: 74 },
  square: { kind: 'rect', x: 8, y: 8, size: 84, rx: 6, numeral: 40, baseline: 64 },
  star: { kind: 'path', d: 'M50 4 L62 36 L96 37 L69 58 L79 92 L50 72 L21 92 L31 58 L4 37 L38 36 Z', numeral: 30, baseline: 63 },
} as const;
export type MarkerShape = keyof typeof MARKER_GEOMETRY;

/** The class tools of PR 9 (README Constants), in stage units unless named as rem or a factor. */
/** The full-screen timer ring (`--ring`), in units; its numbers are `presenter.size.display`. */
export const RING_STAGE = 420;
/** The corner timer ring is a control: 10 x `spacing.lg` px (`--ring-corner`, 160). */
export const RING_CORNER_FACTOR = 10;
/**
 * The small cheering Hoya over "Hoya's answer" at a quiz reveal, in units. The mock's 96 beside the
 * line pushed the question to a second row at 1280 x 720 and the 140-unit option letters out of
 * their cards; stacked at 64 the question row stays one speaker high (slide-quiz.md).
 */
export const QUIZ_ANSWER_HOYA = 64;
/** Grid thumbnails: at least 13 x 8 rem (`--thumb-w`, `--thumb-h`). */
export const THUMB_W_REM = 13;
export const THUMB_H_REM = 8;
/** The help overlay: 56 rem wide (`--help-w`); key columns 10 rem (`--key-col`); a key cap at least 2.25 rem (`--kbd-min`). */
export const HELP_W_REM = 56;
export const KEY_COL_REM = 10;
export const KBD_MIN_REM = 2.25;
/** The status chips' flex basis beside the bar controls (`--status-min`); below it they wrap above the buttons (D1). */
export const STATUS_MIN_REM = 12;
/** The timer ticks this often while it runs (m:ss changes once a second; the ring moves smoothly enough). */
export const TIMER_TICK_MS = 250;

/**
 * The reading slides (AMENDMENTS-LECTURE-V2 LV-S1; design/screens/presenter/lecture-v2.md "Constants"),
 * in stage units unless named as a share.
 */
/** The picture beside a sentence (`--pic-md`). */
export const PIC_MD = 300;
/** A pattern's gap box (`--slot-w`): two Hangul blocks at `presenter.size.title`. */
export const SLOT_W = 160;
/** The gap box's height as a share of the frame's text size (`.slot`: 0.9 em). */
export const SLOT_H_EM = 0.9;
/** A pattern example's number circle (`.example .seq-num`). */
export const EXAMPLE_NUMBER = 64;
/** The realia sheet on the stage (`--sheet-w`): leaves 716 units for its caption and key words. */
export const SHEET_W = 420;
/**
 * Price cards stand side by side (RealiaSheet's market stall), so their sheet is wider: three cards
 * each hold a price (5,000 won, ocheon won) in Hangul and its romanization on one line at the stage
 * sizes.
 */
export const SHEET_CARDS_W = 600;
/**
 * The widest a sheet grows when the text floor (18 px) makes its romanization bigger than its stage
 * units on a small phone: it keeps at least 436 units of the 1184-unit content area for the caption
 * and the key words.
 */
export const SHEET_MAX_W = 700;
/**
 * A sheet with more lines than this draws each line's romanization beside its Korean, not under
 * it, so a five-board trail sign still fits the 504-unit content area at 1280 x 720.
 */
export const SHEET_ROOMY_LINES = 4;
/** A read-along turn is at most this share of the content width (slide-read-along.md). */
export const TURN_MAX_SHARE = '78%';
/**
 * The question slides (LV-S2; design/screens/presenter/lecture-v2.md "Constants"): a picture option
 * of a listen or realia question (`--pic-opt`), so two rows of options and the prompt line fit the
 * 504-unit content area; it shrinks with its row, never grows.
 */
export const PIC_OPT = 112;
/**
 * A realia question's lead line ("Look closely and find the answer.", then "Hoya's answer" in its place)
 * is at least this wide beside the key word; in a narrower column it goes under the key word, so the
 * answer line never has less room than the lead line and nothing moves at the reveal (V7).
 */
export const REALIA_ASK_MIN = 240;
/**
 * The narrowest column beside a realia sheet that holds picture options in the 2 x 2 grid (two cards of a
 * marker and a picture); a narrower one (a price-card sheet grown for a phone's text floor) lists them as rows.
 */
export const REALIA_GRID_MIN = 480;

/** End slide fit rule (README D7): at most this many rows of letters and of words, then one "+ n more" pill. */
export const END_MAX_ROWS = 2;

/** Control-bar buttons are at most 1.5 x `touchTarget.hero` wide; Next / Reveal at least 1.5 x (README Constants). */
export const CTL_MAX_FACTOR = 1.5;
export const NEXT_MIN_FACTOR = 1.5;
/** The start screen's Start button is 1.25 x `touchTarget.hero` tall. */
export const START_BUTTON_FACTOR = 1.25;
/** Hoya on a state page is 1.5 x `touchTarget.hero`. */
export const STATE_HOYA_FACTOR = 1.5;
/** Rem counts of the teacher pages (README Constants), in multiples of the 16 px root size (`typography.size.bodySm`). */
export const READABLE_LINE_REM = 32;
export const EXIT_DIALOG_REM = 40;

/** The start screen waits this long at most for the presenter font (spec section 3.6). */
export const FONT_WAIT_MS = 1500;
/** SVG text does not read React Native's 'System' family; the stroke diagram's numerals use the browser's UI stack. */
export const SVG_UI_FONT = 'system-ui, sans-serif';

/**
 * The control bar takes the pointer again only this long after it shows (owner report 2026-10-16):
 * a touch on a hidden bar brings it back, and its press, which lands after the bar is drawn, must
 * not press the button that appeared under the finger.
 */
export const BAR_SHOW_GRACE_MS = 400;

/** Touch: a horizontal swipe of at least 60 px with |dx| >= 1.5 |dy| (spec section 3.5). */
export const SWIPE_MIN = 60;
export const SWIPE_RATIO = 1.5;
/** A tap on the left third of the stage goes back, elsewhere forward. */
export const TAP_BACK_FRACTION = 1 / 3;

/** The docked control-bar band: one row of hero buttons with `spacing.md` above and below (README D1). */
export function barBand(hero: number, gap: number): number {
  return hero + 2 * gap;
}

/**
 * `PHONE_STAGE_MIN`, the phone gate (F-TCH-004 section 3.6 phone exception; README Constants): in a
 * phone window the stage is judged too small only below this width, so 568 x 320, the smallest
 * landscape phone in use, draws slides, while every other window keeps `layout.breakpoint.regular`
 * (600). Text keeps the 18 px floor either way.
 */
export const PHONE_STAGE_MIN = 560;

/**
 * The compact bar's strip at the bottom of a phone stage (section 3.6): as tall as the bar's own
 * footprint, its `touchTarget.min` row and `spacing.sm` padding (`min + 2 x gap`). A tap there shows
 * or hides the bar instead of stepping.
 */
export function phoneBarStrip(min: number, gap: number): number {
  return min + 2 * gap;
}

/** The safe-area insets of the window (the notch and the home indicator), in window pixels. */
export interface StageInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export const NO_INSETS: StageInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const inset = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * The stage box: the window minus the safe-area insets and the docked bar band, which stays when
 * the bar hides (README D1). A phone window passes a band of 0: its compact bar floats over the
 * stage's bottom edge instead.
 */
export function stageBox(window: WindowSize, band: number, insets: StageInsets): WindowSize {
  return {
    width: Math.max(0, window.width - inset(insets.left) - inset(insets.right)),
    height: Math.max(0, window.height - band - inset(insets.top) - inset(insets.bottom)),
  };
}

/**
 * A control drawn on the stage (the speaker) is `hero` stage units, never below the bar's target
 * size `hero`; in a phone window the floor is the phone's touch target (`floor`, `touchTarget.min`).
 */
export function stageButtonSize(unit: number, hero: number, floor: number = hero): number {
  return Math.max(floor, Math.round(unit * hero));
}

/** `n` stage units in window pixels (geometry, not text: text goes through `stageText`). */
export function units(unit: number, n: number): number {
  return Math.round(unit * n);
}
