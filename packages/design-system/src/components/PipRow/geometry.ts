import { colors } from '../../tokens';
import type { PipContext, PipState, PipView } from './types';

export type { PipContext, PipState, PipView } from './types';

/**
 * PipRow geometry (F-ROUTE-001 R-2b, section 3.4 and 3.14;
 * design/components/PipRow/spec.md). Pure data, no React, so every shape is
 * unit-tested in node. A pip is drawn in a `size x size` box; the cursor and
 * start markers each sit in a band of `markerBand(size)` above or below it.
 *
 * The meaning is in the shape, never only in the colour: a done disc, a ring
 * with an inner disc (known), a plain ring (open), a ring with a sparkle (new),
 * a dotted ring (later). Every outline is `border.shape` (3:1 on every surface);
 * only a done pip uses the caller's accent (the stage colour, decoration).
 */

/** Pip side in dp per context (spec section 3.4). */
export const PIP_SIZE: Readonly<Record<PipContext, number>> = { stage: 20, cell: 24 };

/** In the spec's precedence order. */
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

/** The parts of one pip, in a `size x size` box, drawn in order. */
export function pipParts(state: PipState, size: number): PipPart[] {
  const base = ring(size);
  switch (state) {
    case 'done': {
      const edge = pipStrokeWidth(size) * 0.75;
      return [{ kind: 'circle', cx: size / 2, cy: size / 2, r: size / 2 - edge / 2, fill: 'accent', stroke: 'mark', strokeWidth: edge }];
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
  /** Space before this pip: 0 for the first, the pip gap inside a group, the group gap before a new group. */
  leadingGap: number;
}

/** The groups flattened into one wrapping row; empty groups are skipped. */
export function pipRowCells(groups: readonly (readonly PipView[])[], gaps: { pip: number; group: number }): PipCell[] {
  const cells: PipCell[] = [];
  for (const group of groups) {
    group.forEach((pip, index) => {
      cells.push({
        key: pip.key,
        state: pip.state,
        isCursor: pip.isCursor ?? false,
        isStart: pip.isStart ?? false,
        leadingGap: cells.length === 0 ? 0 : index === 0 ? gaps.group : gaps.pip,
      });
    });
  }
  return cells;
}

/** Which marker bands the row reserves: only the ones a pip uses. */
export function pipRowBands(groups: readonly (readonly PipView[])[]): { top: boolean; bottom: boolean } {
  const all = groups.flat();
  return { top: all.some((p) => p.isCursor === true), bottom: all.some((p) => p.isStart === true) };
}
