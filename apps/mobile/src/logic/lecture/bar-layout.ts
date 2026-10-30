/**
 * The docked control bar's order and its wrap rule (AMENDMENTS-PRESENTER-NAV section 5.1, owner
 * choices O6 and O9; mock design/screens/presenter/stage-and-bar.md "Navigation (PN-0b)", "Docked
 * bar"), pure. The bar measures its controls' real widths (labels in the device language at the
 * chosen text size) and this decides:
 *
 * - **Order** (O6): `[ Previous ]` at the start of the band, the status chips, then Exit, Full screen,
 *   Slides, Blank, Timer and Sound, and `[[ Next / Reveal ]]` at the end; Sound always sits between
 *   Exit and Next. On a wide touch window (O9: `WIDE_TOUCH_MIN` px or wider with touch seen, an
 *   interactive whiteboard) Previous moves to just before Next. The focus order is this order.
 * - **Wrap**: one row when it holds Previous, the chips' basis (`STATUS_MIN`), every tool and Next;
 *   else the tools take a row above and Previous and Next stay on the bottom row at its two ends
 *   (together at its end under O9); and if the tools do not fit their row either, Timer, Blank and
 *   Slides move into a **More** button on the bottom row, just before Next (just before Previous
 *   under O9). A tool never shrinks; only a band too narrow for even More's two rows (no tablet
 *   PN-0b measured) lets the tools left on it take a second tools row rather than clip one. The
 *   focus order of a wrapped band stays Previous, the chips, the tools, More, Next, so the step
 *   pair stays first and last.
 *
 * Like `stage-gesture.ts`, it imports no design-system runtime: widths and gaps come in as numbers.
 */

/** O9: a touch window at least this wide (an interactive whiteboard) puts Previous beside Next. */
export const WIDE_TOUCH_MIN = 1600;

export type DockedTool = 'exit' | 'fullscreen' | 'grid' | 'blank' | 'timer' | 'sound';

/** The tools in their order on the band: Exit first and Sound last, so Exit is never beside Next. */
export const DOCKED_TOOLS: readonly DockedTool[] = ['exit', 'fullscreen', 'grid', 'blank', 'timer', 'sound'];

/** What More takes when two rows do not hold the tools: Slides, Blank and Timer (the sheet lists them Slides, Timer, Blank). */
export const MORE_TOOLS: readonly DockedTool[] = ['grid', 'blank', 'timer'];

/** A part of the band, in focus (DOM) order. */
export type DockedSlot = 'prev' | 'chips' | 'tools' | 'more' | 'next';

export interface DockedBarLayout {
  /**
   * 1: everything on one row; 2: the tools on a row above Previous and Next; 3: only on a band too
   * narrow for even More's two rows (a narrow mouse window at a large text size, never a tablet PN-0b
   * measured), the tools left on the band wrap onto a second tools row instead of being clipped.
   */
  rows: 1 | 2 | 3;
  /** Timer, Blank and Slides are in More. */
  more: boolean;
}

export interface DockedBarFit {
  /** The width the band's content has (the band less its side padding), in window px. */
  room: number;
  /** Previous and Next / Reveal as drawn (their real widths). */
  prev: number | undefined;
  next: number | undefined;
  /** Each tool's real width; a tool not yet measured is missing. */
  tools: Readonly<Partial<Record<DockedTool, number>>>;
  /** The tools the device has (Full screen only where the browser has it), in `DOCKED_TOOLS` order. */
  present: readonly DockedTool[];
  /** The chips' basis: kept on one row even with no chip, so a chip that appears never moves the stage. */
  statusMin: number;
  /** Between the band's parts (Previous, the chips, the tools, More, Next). */
  gap: number;
  /** Between two tools. */
  toolGap: number;
}

/** Sub-pixel layout rounding never wraps a band that fits. */
const EPSILON = 0.5;

/** O9: touch seen on a window `WIDE_TOUCH_MIN` px wide or wider. */
export function wideTouchWindow(width: number, touchSeen: boolean): boolean {
  return touchSeen && width >= WIDE_TOUCH_MIN;
}

/** The tools drawn on the band: every present tool, less the ones More holds. */
export function bandTools(present: readonly DockedTool[], more: boolean): DockedTool[] {
  return present.filter((tool) => !more || !MORE_TOOLS.includes(tool));
}

/** The tools More holds, in the order its sheet lists them. */
export function moreTools(present: readonly DockedTool[]): DockedTool[] {
  return (['grid', 'timer', 'blank'] as const).filter((tool) => present.includes(tool));
}

/** The width of a row of tools: their widths and the gaps between them; undefined while one is not measured. */
export function toolsWidth(tools: readonly DockedTool[], widths: Readonly<Partial<Record<DockedTool, number>>>, toolGap: number): number | undefined {
  let sum = 0;
  for (const tool of tools) {
    const width = widths[tool];
    if (width === undefined) return undefined;
    sum += width;
  }
  return sum + Math.max(0, tools.length - 1) * toolGap;
}

/** Whether the band has its room and every control's width, so the wrap rule decides on real widths. */
export function dockedBarMeasured(fit: DockedBarFit): boolean {
  return fit.room > 0 && fit.prev !== undefined && fit.next !== undefined && toolsWidth(fit.present, fit.tools, fit.toolGap) !== undefined;
}

/**
 * The wrap rule. Until every control has been measured the band is laid out on one row (the
 * measurement itself), so the first decision is made on real widths.
 */
export function dockedBarLayout(fit: DockedBarFit): DockedBarLayout {
  const tools = toolsWidth(fit.present, fit.tools, fit.toolGap);
  if (tools === undefined || fit.prev === undefined || fit.next === undefined || !dockedBarMeasured(fit)) return { rows: 1, more: false };
  const oneRow = fit.prev + fit.statusMin + tools + fit.next + 3 * fit.gap;
  if (oneRow <= fit.room + EPSILON) return { rows: 1, more: false };
  if (tools <= fit.room + EPSILON) return { rows: 2, more: false };
  // More takes Timer, Blank and Slides; the tools left (Exit, Full screen, Sound) must still fit their row.
  const left = toolsWidth(bandTools(fit.present, true), fit.tools, fit.toolGap) ?? 0;
  if (left <= fit.room + EPSILON) return { rows: 2, more: true };
  return { rows: 3, more: true };
}

/** The band's parts in focus order (which is the visual order on one row). */
export function dockedOrder(layout: DockedBarLayout, wideTouch: boolean): DockedSlot[] {
  const more: DockedSlot[] = layout.more ? ['more'] : [];
  return wideTouch ? ['chips', 'tools', ...more, 'prev', 'next'] : ['prev', 'chips', 'tools', ...more, 'next'];
}
