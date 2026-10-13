import { colors } from '../../tokens';
import type { PipContext, PipState, PipView } from './types';

export type { PipContext, PipState, PipView } from './types';

/**
 * PipRow geometry (F-ROUTE-001 R-2b, section 3.4 and 3.14;
 * design/components/PipRow/spec.md). Pure data, no React, so every shape is
 * unit-tested in node. A pip is drawn in a `size x size` box; the cursor and
 * start markers each sit in a band of `markerBand(size)` above or below it.
 *
 * The meaning is in the shape, never only in the colour: a done disc with a
 * check inside, a ring with an inner disc (known), a plain ring (open), a ring with a sparkle (new),
 * a dotted ring (later). Every outline is `border.shape` (3:1 on every surface);
 * only a done pip uses the caller's accent (the stage colour, decoration), and
 * its check in `text.primary` carries the state whatever that accent is.
 */

/** Pip side in dp per context (spec section 3.4). */
export const PIP_SIZE: Readonly<Record<PipContext, number>> = { stage: 20, cell: 24 };

/**
 * In the order of the spec's state table (section 3.4), which is also the
 * legend order. This is not the precedence: when one quest qualifies for
 * several states the app resolves done > known > new > open > later
 * (`pipStateOf`, apps/mobile logic/my-route) before it reaches this row.
 */
export const PIP_STATES: readonly PipState[] = ['done', 'known', 'open', 'new', 'later'];

/** Dashes around a `later` ring (the spec asks for at least 4 visible ones). */
export const LATER_DASHES = 8;

/** Symbolic inks, resolved to tokens by `pipInk`. */
export type PipInk = 'accent' | 'mark' | 'ink' | 'paper';

export type PipPart =
  | {
      kind: 'circle';
      cx: number;
      cy: number;
      r: number;
      fill: PipInk | 'none';
      stroke?: PipInk;
      strokeWidth?: number;
      /** `strokeDasharray` as [dash, gap]. */
      dash?: readonly [number, number];
    }
  | { kind: 'path'; d: string; fill: PipInk | 'none'; stroke?: PipInk; strokeWidth?: number };

const round = (n: number): number => Math.round(n * 100) / 100;

/** Ring stroke: 2 dp at 20 dp, growing with the pip, never thinner than 2. */
export function pipStrokeWidth(size: number): number {
  return Math.max(2, size / 10);
}

function ring(size: number): Extract<PipPart, { kind: 'circle' }> {
  const strokeWidth = pipStrokeWidth(size);
  return { kind: 'circle', cx: size / 2, cy: size / 2, r: size / 2 - strokeWidth / 2, fill: 'none', stroke: 'mark', strokeWidth };
}

/** A four-point sparkle inside the ring: four tips at 0.3 x size from the centre, four waists close in. */
function sparklePath(size: number): string {
  const c = size / 2;
  const tip = size * 0.3;
  const waist = size * 0.1;
  const pts: Array<[number, number]> = [
    [c, c - tip],
    [c + waist, c - waist],
    [c + tip, c],
    [c + waist, c + waist],
    [c, c + tip],
    [c - waist, c + waist],
    [c - tip, c],
    [c - waist, c - waist],
  ];
  return `${pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`).join(' ')} Z`;
}

/**
 * The check inside a done disc: an open three-point stroke in `ink`. It, not
 * the accent fill, tells done from open (spec 3.14: the stage colour only
 * decorates; stage2 and stage3 are 2.4:1 on paper), and `text.primary` holds
 * at least 3:1 against every stage colour and the default accent (tested).
 */
function checkPath(size: number): string {
  const pts: Array<[number, number]> = [
    [size * 0.28, size * 0.52],
    [size * 0.43, size * 0.67],
    [size * 0.72, size * 0.36],
  ];
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`).join(' ');
}

/** The parts of one pip, in a `size x size` box, drawn in order. */
export function pipParts(state: PipState, size: number): PipPart[] {
  const base = ring(size);
  switch (state) {
    case 'done': {
      const edge = pipStrokeWidth(size) * 0.75;
      return [
        { kind: 'circle', cx: size / 2, cy: size / 2, r: size / 2 - edge / 2, fill: 'accent', stroke: 'mark', strokeWidth: edge },
        { kind: 'path', d: checkPath(size), fill: 'none', stroke: 'ink', strokeWidth: pipStrokeWidth(size) },
      ];
    }
    case 'known':
      return [base, { kind: 'circle', cx: size / 2, cy: size / 2, r: size / 4, fill: 'mark' }];
    case 'open':
      return [base];
    case 'new':
      return [base, { kind: 'path', d: sparklePath(size), fill: 'mark' }];
    case 'later': {
      const period = (2 * Math.PI * base.r) / LATER_DASHES;
      return [{ ...base, dash: [period * 0.55, period * 0.45] }];
    }
  }
}

/**
 * A stage's state on the seven-segment overview of the whole journey
 * (F-ROUTE-001 section 3.3 and the coming-later rows paragraph: the Home strip
 * and the parent dashboard keep seven segments). The same union as `StageState`
 * in `apps/mobile/src/logic/my-route/`, restated because the design system does
 * not import the app.
 */
export type StageSegmentState = 'complete' | 'known' | 'explored' | 'open' | 'later';

/** In the order of the spec's stage state table. */
export const STAGE_SEGMENT_STATES: readonly StageSegmentState[] = ['complete', 'known', 'explored', 'open', 'later'];

/**
 * The parts of one stage segment, in the pip vocabulary: complete is a done
 * pip, known, open and later the pips of the same name, and explored the check
 * of a done pip without its disc, so it is never drawn as complete. Every
 * state differs in geometry (section 3.14), as on the console journey strip.
 */
export function stageSegmentParts(state: StageSegmentState, size: number): PipPart[] {
  switch (state) {
    case 'complete':
      return pipParts('done', size);
    case 'explored':
      return pipParts('done', size).filter((part) => part.kind === 'path');
    case 'known':
    case 'open':
    case 'later':
      return pipParts(state, size);
  }
}

/** Height of the band the cursor marker sits in, above the pip. */
export function markerBand(size: number): number {
  return size * 0.45;
}

/** Height of the band the start pin sits in, below the pip: taller than the cursor's so the pin reads at 20 dp. */
export function startBand(size: number): number {
  return size * 0.75;
}

/** The cursor marker: a solid triangle centred over the pip, pointing down at it, in band coordinates. */
export function cursorMarkerParts(size: number): PipPart[] {
  const band = markerBand(size);
  const half = size * 0.3;
  const height = size * 0.3;
  const tipY = band - size * 0.12;
  const c = size / 2;
  const d = `M${round(c - half)} ${round(tipY - height)} L${round(c + half)} ${round(tipY - height)} L${round(c)} ${round(tipY)} Z`;
  return [{ kind: 'path', d, fill: 'ink' }];
}

/**
 * The start marker: a solid map-pin drop (the outline of the `pin` icon glyph,
 * scaled into the band) with a paper dot, in band coordinates. The tag "You
 * started here" on the stage row uses the same pin glyph.
 */
export function startMarkerParts(size: number): PipPart[] {
  const band = startBand(size);
  const top = size * 0.06;
  // The pin glyph spans y 2.5 to 21.5 and x 5 to 19 on its 24 grid, head centre (12, 9.5), radius 7.
  const s = (band - top) / 19;
  const c = size / 2;
  const x = (gx: number): number => round(c + (gx - 12) * s);
  const y = (gy: number): number => round(top + (gy - 2.5) * s);
  const r = round(7 * s);
  const d =
    `M${x(12)} ${y(21.5)} C${x(9.5)} ${y(18.5)} ${x(5)} ${y(14)} ${x(5)} ${y(9.5)} ` +
    `A${r} ${r} 0 0 1 ${x(19)} ${y(9.5)} C${x(19)} ${y(14)} ${x(14.5)} ${y(18.5)} ${x(12)} ${y(21.5)} Z`;
  return [
    { kind: 'path', d, fill: 'ink' },
    { kind: 'circle', cx: c, cy: top + 7 * s, r: 7 * s * 0.4, fill: 'paper' },
  ];
}

/** A symbolic ink as a colour token; `accent` is the caller's done-pip fill. */
export function pipInk(ink: PipInk | 'none', accent: string): string {
  switch (ink) {
    case 'accent':
      return accent;
    case 'mark':
      return colors.border.shape;
    case 'ink':
      return colors.text.primary;
    case 'paper':
      return colors.surface.paper;
    case 'none':
      return 'none';
  }
}

export interface PipCell {
  key: string;
  state: PipState;
  isCursor: boolean;
  isStart: boolean;
  /**
   * Space after this pip: the pip gap inside a group, the group gap after the
   * last pip of a group that another group follows, 0 after the last pip. The
   * gap trails, so a group that wraps onto a new line starts flush left.
   */
  trailingGap: number;
}

/** The groups flattened into one wrapping row; empty groups are skipped. */
export function pipRowCells(groups: readonly (readonly PipView[])[], gaps: { pip: number; group: number }): PipCell[] {
  const nonEmpty = groups.filter((group) => group.length > 0);
  return nonEmpty.flatMap((group, groupIndex) =>
    group.map((pip, index) => ({
      key: pip.key,
      state: pip.state,
      isCursor: pip.isCursor ?? false,
      isStart: pip.isStart ?? false,
      trailingGap: index < group.length - 1 ? gaps.pip : groupIndex < nonEmpty.length - 1 ? gaps.group : 0,
    })),
  );
}

/** One line of a measured row (`pipRowLines`): its pips and the marker bands they use. */
export interface PipRowLine {
  cells: PipCell[];
  bands: { top: boolean; bottom: boolean };
}

/**
 * The lines a row of `width` wraps its cells into, the way the wrapping row
 * fills them (route order, `pipGap` between pips, a trailing group gap counted
 * with its pip). Each line reserves only the marker bands its own pips use, so
 * a second line without the cursor or the start pin is just the pips
 * (AMENDMENTS-ROUTE-LEARNING-ROUTE LR-11: the route card at 320). A pip wider
 * than the width takes a line of its own.
 */
export function pipRowLines(cells: readonly PipCell[], width: number, size: number, pipGap: number): PipRowLine[] {
  const lines: PipCell[][] = [];
  let line: PipCell[] = [];
  let used = 0;
  for (const cell of cells) {
    const outer = size + Math.max(0, cell.trailingGap - pipGap);
    const needed = line.length === 0 ? outer : used + pipGap + outer;
    if (line.length > 0 && needed > width) {
      lines.push(line);
      line = [cell];
      used = outer;
    } else {
      line.push(cell);
      used = needed;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.map((cellsOfLine) => ({
    cells: cellsOfLine,
    bands: { top: cellsOfLine.some((c) => c.isCursor), bottom: cellsOfLine.some((c) => c.isStart) },
  }));
}

/** Which marker bands the row reserves: only the ones a pip uses. */
export function pipRowBands(groups: readonly (readonly PipView[])[]): { top: boolean; bottom: boolean } {
  const all = groups.flat();
  return { top: all.some((p) => p.isCursor === true), bottom: all.some((p) => p.isStart === true) };
}
