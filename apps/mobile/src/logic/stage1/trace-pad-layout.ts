import { layout, spacing, touchTarget, typography } from '@hangul-route/design-system/src/tokens';
import type { TypeScale } from '@hangul-route/design-system/text-size';
import { TRACE_CANVAS_MIN, traceLayoutMode, traceSidePanelWidth } from '../trace-layout';

/**
 * The layout ladder of the trace page (AMENDMENTS-STAGE1-TRACE-COVERAGE §3.4, "TC-0b result"; design/screens/discover-trace/
 * trace-new-letters.md, "Arrangements"). The page must keep its canvas at least `TRACE_CANVAS_MIN` high and wide with every
 * part on screen and Continue in view, at every window the layout spec walks and at Largest text. No one arrangement does,
 * so the pad takes the **first step of a ladder** whose canvas slot is at least the floor:
 *
 * - portrait: `full` -> `beside` -> `compact` -> `short` -> `short-b`;
 * - landscape (`traceLayoutMode` of the Screen content box is `side`): `side` -> `side-short` -> `side-short-b`.
 *
 * The choice is pure and made once per page: it reads the Screen content box (the window less its gutters and insets, before
 * the reading cap), the text size scale and the page's content (its headings, whether a letter is a final), never the size
 * of the column an arrangement itself changes, so it cannot loop or flicker and the canvas keeps one size across the
 * page's letters. The part heights below are those of the TC-0b mock measured in Chromium; the pad measures its own canvas
 * slot for the final square (`traceCanvasSize`), so a font that differs only moves the canvas, never the choice's logic.
 */

export type TracePadArrangement = 'full' | 'beside' | 'compact' | 'short' | 'short-b' | 'side' | 'side-short' | 'side-short-b';

export const PORTRAIT_LADDER: readonly TracePadArrangement[] = ['full', 'beside', 'compact', 'short', 'short-b'];
export const LANDSCAPE_LADDER: readonly TracePadArrangement[] = ['side', 'side-short', 'side-short-b'];

/** What the pad needs of the page: its letters' headings (the longest holds the heading's room) and whether one is a final. */
export interface TracePadPage {
  /** The heading text of every letter of the page (`learner.minigame.trace.heading` / `.headingFinal`). */
  headings: readonly string[];
  /** A letter of the page is a final: every letter keeps the room of the final's line ("Sits at the bottom of the block"). */
  hasFinal: boolean;
}

export interface TracePadInput {
  /** The Screen content box: the window less the gutters and the safe-area insets, not capped to the reading column. */
  box: { width: number; height: number };
  /** The type scale of the chosen text size (`useTypeScale()`). */
  scale: TypeScale;
  page: TracePadPage;
  /** The page's letter count (the chips' width). */
  letters: number;
}

/** What the arrangement draws, derived from the step: the pad and `QuestPlayerView` both read this. */
export interface TracePadPlan {
  arrangement: TracePadArrangement;
  /** Landscape: canvas left, the band and controls right. */
  side: boolean;
  /** The step title slot ("Trace the new letters") is drawn above the page. */
  title: boolean;
  /** The step dots ride in the ScreenHeader's middle, between Close and Aa (the short arrangements). */
  dotsInHeader: boolean;
  /** The step count pill ("2 / 6") is drawn beside the dots (not in `short`, whose header has the room of the dots only). */
  pill: boolean;
  /** The page row ("Page 3 of 3" with the dots) is drawn; otherwise its label stays for screen readers only. */
  pageRow: boolean;
  /** The letter chips are drawn (not in `short-b` and `side-short-b`, the spec's fallback (b)). */
  chips: boolean;
  /** The chips have their own row above the heading (`full`); else they sit at the heading's line end. */
  chipsOwnRow: boolean;
  /** Hear it and Show me stand in a column beside the canvas. */
  helpersBeside: boolean;
  /** Previous and Continue: `lg` (80), `md` (64) on the short arrangements of this page only (owner decision 2026-11-26). */
  rowSize: 'lg' | 'md';
  /** Hoya's figure in the strip: the full arrangement on a tall content box (`TRACE_ROOMY_MIN_HEIGHT`). */
  roomy: boolean;
  /** The estimated canvas slot (a square's side the arrangement leaves, before the cap); `fits` says whether it reaches the floor. */
  canvasSlot: number;
  fits: boolean;
  /** The width of the column beside the canvas (landscape arrangements; 0 in portrait). */
  columnWidth: number;
}

type Base = Omit<TracePadPlan, 'roomy' | 'canvasSlot' | 'fits' | 'columnWidth'>;

const PLANS: Record<TracePadArrangement, Base> = {
  full: { arrangement: 'full', side: false, title: true, dotsInHeader: false, pill: true, pageRow: true, chips: true, chipsOwnRow: true, helpersBeside: false, rowSize: 'lg' },
  beside: { arrangement: 'beside', side: false, title: true, dotsInHeader: false, pill: true, pageRow: true, chips: true, chipsOwnRow: false, helpersBeside: true, rowSize: 'lg' },
  compact: { arrangement: 'compact', side: false, title: false, dotsInHeader: false, pill: true, pageRow: true, chips: true, chipsOwnRow: false, helpersBeside: true, rowSize: 'lg' },
  short: { arrangement: 'short', side: false, title: false, dotsInHeader: true, pill: false, pageRow: false, chips: true, chipsOwnRow: false, helpersBeside: true, rowSize: 'md' },
  'short-b': { arrangement: 'short-b', side: false, title: false, dotsInHeader: true, pill: false, pageRow: false, chips: false, chipsOwnRow: false, helpersBeside: true, rowSize: 'md' },
  side: { arrangement: 'side', side: true, title: true, dotsInHeader: false, pill: true, pageRow: true, chips: true, chipsOwnRow: false, helpersBeside: false, rowSize: 'lg' },
  'side-short': { arrangement: 'side-short', side: true, title: false, dotsInHeader: true, pill: true, pageRow: false, chips: true, chipsOwnRow: false, helpersBeside: false, rowSize: 'md' },
  'side-short-b': { arrangement: 'side-short-b', side: true, title: false, dotsInHeader: true, pill: true, pageRow: false, chips: false, chipsOwnRow: false, helpersBeside: false, rowSize: 'md' },
};

/** The plan of an arrangement with no measurement (the fallback before a box is known, and the pad's own tests). */
export function planOf(arrangement: TracePadArrangement): TracePadPlan {
  return { ...PLANS[arrangement], roomy: false, canvasSlot: 0, fits: false, columnWidth: 0 };
}

// ---- Part heights and widths (dp), from the mock's Chromium measurements -----------------------------------------------------

/** The ScreenHeader row (`touchTarget.min`) and the gap `headerStyle` leaves under it. */
const HEADER = touchTarget.min + spacing.xs;
/** The columns of the reading cap (`layout.maxWidth.reading`). */
const READING = layout.maxWidth.reading;
/** A step dot's height (`Progress` dots). */
const DOT = spacing.md;
/** The mean advance of a system-font character as a share of its size, for a wrap estimate. */
const CHAR = 0.46;
/** The same for the bold heading. */
const HEAD_CHAR = 0.5;
/** The same for a semibold button label ("Hear it" is about 56 dp wide at 16). */
const BTN_CHAR = 0.5;
/** The longest line the strip can hold (praise, "Beautiful! That looks like the letter."), in characters. */
const STRIP_CHARS = 38;
/** "Sits at the bottom of the block", in characters. */
const FINAL_CHARS = 31;
/** The labels of the buttons (the English set; the longest words of es and ko are wider only in es, which wraps the row, not the choice). */
const LABELS = { hear: 7, show: 7, clear: 5, next: 11 } as const;
/** A button's own horizontal room: `spacing.lg` padding each side, plus a ghost button's 2 dp borders. */
const BTN_PAD = 2 * spacing.lg;
/** The speaker glyph and its gap in Hear it. */
const ICON = spacing.xl + spacing.sm;

const lh = (size: number, leading: keyof typeof typography.leading): number => size * typography.leading[leading];

interface Parts {
  stepbar: number;
  title: number;
  pagerow: number;
  chipH: number;
  chipsW: number;
  heading: number;
  headingW: number;
  finalLine: number;
  /** The final's line, in characters and in type size, for its wrap. */
  finalChars: number;
  finalSize: number;
  strip: (width: number, roomy: boolean) => number;
  hear: number;
  show: number;
  clear: number;
  next: number;
}

function parts(i: TracePadInput): Parts {
  const s = i.scale.size;
  const btn = (chars: number, extra: number): number => Math.max(touchTarget.min, Math.ceil(chars * s.bodySm * BTN_CHAR) + BTN_PAD + extra);
  const chipH = Math.max(spacing.xxl, Math.ceil(lh(s.bodyLg, 'tight')) + 2 * 3);
  const chipW = Math.max(spacing.xxl, Math.ceil(s.bodyLg) + 2 * spacing.xs + 2 * 3);
  const longest = i.page.headings.reduce((n, h) => Math.max(n, h.length), 0);
  return {
    stepbar: Math.max(DOT, Math.ceil(lh(s.caption, 'normal')) + 2 * spacing.xxs),
    title: Math.ceil(lh(s.title, 'tight')),
    pagerow: Math.max(DOT, Math.ceil(lh(s.caption, 'normal'))),
    chipH,
    chipsW: i.letters * chipW + Math.max(0, i.letters - 1) * spacing.xs,
    heading: Math.ceil(lh(s.prompt, 'tight')),
    headingW: Math.ceil(longest * s.prompt * HEAD_CHAR),
    finalLine: i.page.hasFinal ? Math.ceil(lh(s.body, 'normal')) : 0,
    finalChars: FINAL_CHARS,
    finalSize: s.body * 0.4,
    strip: (width, roomy) => {
      const text = width - 2 * spacing.md - 2 * 2 - (roomy ? 40 + spacing.sm : 0);
      const perLine = Math.max(1, Math.floor(text / (s.bodySm * CHAR)));
      const lines = Math.ceil(STRIP_CHARS / perLine);
      return Math.max(touchTarget.min + 2 * 2, Math.ceil(lines * lh(s.bodySm, 'normal')) + 2 * spacing.sm + 2 * 2);
    },
    hear: btn(LABELS.hear, ICON),
    show: btn(LABELS.show, 0),
    clear: btn(LABELS.clear, 2 * 2),
    next: btn(LABELS.next, 2 * 2),
  };
}

/** Rows a wrapping row of buttons takes in `width` (gap `spacing.sm`). */
function rowsOf(widths: readonly number[], width: number): number {
  let rows = 1;
  let used = 0;
  for (const w of widths) {
    const need = used === 0 ? w : used + spacing.sm + w;
    if (used > 0 && need > width) {
      rows += 1;
      used = w;
    } else used = need;
  }
  return rows;
}
const rowsHeight = (rows: number): number => rows * touchTarget.min + (rows - 1) * spacing.sm;

/** The heading's line(s) with the chips: beside the heading when both fit one line, else the chips under it. */
function headRow(p: Parts, plan: Base, width: number): number {
  const chipsInline = plan.chips && !plan.chipsOwnRow;
  const sameLine = chipsInline && p.headingW + spacing.md + p.chipsW <= width;
  // A heading wider than the column wraps (200 % text); its line count holds for every letter of the page.
  const lines = Math.max(1, Math.ceil(p.headingW / Math.max(1, width)));
  let h = Math.max(lines * p.heading, sameLine ? p.chipH : 0);
  if (chipsInline && !sameLine) h += spacing.xs + p.chipH;
  if (p.finalLine > 0) h += spacing.xs + p.finalLine * Math.max(1, Math.ceil((p.finalChars * p.finalSize) / Math.max(1, width)));
  return h;
}

/** The band above the canvas: the page row, the chips' own row, the heading with the chips and a final's line. */
function bandHeight(p: Parts, plan: Base, width: number): number {
  const rows = [plan.pageRow ? p.pagerow : 0, plan.chips && plan.chipsOwnRow ? p.chipH : 0, headRow(p, plan, width)].filter((h) => h > 0);
  return rows.reduce((a, b) => a + b, 0) + Math.max(0, rows.length - 1) * spacing.sm;
}

function estimatePortrait(i: TracePadInput, plan: Base): { slot: number; roomy: boolean } {
  const p = parts(i);
  const width = Math.min(i.box.width, READING);
  const short = plan.dotsInHeader;
  const gapC = short ? spacing.sm : spacing.lg;
  const gap = short ? spacing.sm : spacing.md;
  const roomy = plan.arrangement === 'full' && i.box.height >= 700;
  // QuestPlayerView's chrome: the header; then (unless the dots ride in it) the step dots row, then the title slot.
  const chrome = HEADER + (plan.dotsInHeader ? gapC : p.stepbar + gapC + (plan.title ? p.title + gapC : 0));
  const pinned = plan.rowSize === 'lg' ? spacing.md + touchTarget.child + spacing.lg : spacing.sm + touchTarget.min;
  const band = bandHeight(p, plan, width);
  const strip = p.strip(width, roomy);
  const row = plan.helpersBeside ? [p.clear, p.next] : [p.hear, p.show, p.clear, p.next];
  const controls = rowsHeight(rowsOf(row, width));
  const used = chrome + band + strip + controls + pinned + 3 * gap;
  const slotH = i.box.height - used;
  const helpers = plan.helpersBeside ? Math.max(p.hear, p.show) + gap : 0;
  return { slot: Math.floor(Math.min(slotH, width - helpers)), roomy };
}

function estimateSide(i: TracePadInput, plan: Base): { slot: number; colW: number } {
  const p = parts(i);
  const width = Math.min(i.box.width, READING);
  const short = plan.dotsInHeader;
  const gapC = short ? spacing.sm : spacing.lg;
  const chrome = HEADER + (short ? gapC : p.stepbar + gapC + (plan.title ? p.title + gapC : 0));
  // side-short: the column's gaps step down to `spacing.xs`, so its band, strip, buttons and pinned row fit a 390 high window.
  const gap = short ? spacing.xs : spacing.sm;
  const pinnedH = plan.rowSize === 'lg' ? spacing.md + touchTarget.child + spacing.lg : spacing.xs + touchTarget.min;
  // side: the pinned row spans both columns under them; side-short: it sits at the foot of the right column.
  const boxH = i.box.height - chrome - (short ? 0 : pinnedH);
  const row = [p.hear, p.show, p.clear, p.next];
  const rowW = row.reduce((a, b) => a + b, 0) + (row.length - 1) * spacing.sm;
  // the column: side holds a wrapping row in the panel width; side-short is as wide as its one row of buttons (at most 70 %).
  const colW = short ? Math.min(Math.max(traceSidePanelWidth(width), rowW), Math.floor(width * 0.7)) : traceSidePanelWidth(width);
  const band = bandHeight(p, plan, colW);
  const controls = short ? touchTarget.min : rowsHeight(rowsOf(row, colW));
  const column = band + p.strip(colW, false) + controls + (short ? pinnedH : 0) + 3 * gap;
  const canvas = Math.min(boxH, width - colW - spacing.lg);
  // The column must fit the box's height as well, or a part would be pushed off screen.
  return { slot: Math.floor(column > boxH ? Math.min(canvas, TRACE_CANVAS_MIN - 1) : canvas), colW };
}

/** Every step of the ladder the box allows, with its estimated canvas slot (the choice is the first that fits). */
export function ladderPlans(input: TracePadInput): TracePadPlan[] {
  const ladder = traceLayoutMode(input.box) === 'side' ? LANDSCAPE_LADDER : PORTRAIT_LADDER;
  return ladder.map((name) => {
    const base = PLANS[name];
    const est = base.side ? { ...estimateSide(input, base), roomy: false } : { ...estimatePortrait(input, base), colW: 0 };
    return { ...base, roomy: est.roomy, canvasSlot: est.slot, fits: est.slot >= TRACE_CANVAS_MIN, columnWidth: est.colW };
  });
}

/**
 * The arrangement of a page: the first step of the ladder whose canvas slot is at least `TRACE_CANVAS_MIN`; the ladder's
 * last step when none is (the pad then draws a floor-sized canvas, as Trace Stroke does under its own floor).
 */
export function traceArrangement(input: TracePadInput): TracePadPlan {
  const plans = ladderPlans(input);
  return plans.find((plan) => plan.fits) ?? (plans[plans.length - 1] as TracePadPlan);
}
