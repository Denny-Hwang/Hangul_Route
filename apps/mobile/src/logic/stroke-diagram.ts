import type { JamoStrokePoint } from '../content/jamo-strokes';

/**
 * Static stroke-order diagram — the reduced-motion "Show me" (F-007 §3.4).
 *
 * With reduced motion on, the animated dot-walk is replaced by a still
 * picture: every stroke drawn whole, a numbered badge where it starts, and
 * a short arrow along its first stretch showing which way it goes. All
 * coordinates are in the jamo skeletons' 200 × 200 viewBox.
 */

/** Badge radius in viewBox units (≈ 15 px in the 280 px trace box). */
export const BADGE_RADIUS = 11;
const ARROW_LENGTH = 30;
const ARROW_GAP = 3;
const ARROW_HEAD = 8;
const MIN_ARROW = 8;

export interface StrokeArrow {
  /** Shaft along the stroke. */
  d: string;
  /** Two-winged head at `tip`. */
  head: string;
  tail: JamoStrokePoint;
  tip: JamoStrokePoint;
}

export interface StrokeDiagramItem {
  /** 1-based writing order. */
  order: number;
  /** The whole stroke as SVG path data. */
  d: string;
  /** Centre of the order badge — the stroke start, nudged along if taken. */
  badge: JamoStrokePoint;
  /** Direction cue, or null when the stroke is too short to carry one. */
  arrow: StrokeArrow | null;
}

export function pointsToPathD(points: readonly JamoStrokePoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return [`M ${first!.x} ${first!.y}`, ...rest.map((p) => `L ${p.x} ${p.y}`)].join(' ');
}

function strokeLength(stroke: readonly JamoStrokePoint[]): number {
  let total = 0;
  for (let i = 1; i < stroke.length; i++) {
    total += Math.hypot(stroke[i]!.x - stroke[i - 1]!.x, stroke[i]!.y - stroke[i - 1]!.y);
  }
  return total;
}

/** The point `distance` units along the polyline, clamped to its ends. */
export function pointAlong(stroke: readonly JamoStrokePoint[], distance: number): JamoStrokePoint {
  if (stroke.length === 0) return { x: 0, y: 0 };
  if (distance <= 0 || stroke.length === 1) return { ...stroke[0]! };
  let walked = 0;
  for (let i = 1; i < stroke.length; i++) {
    const a = stroke[i - 1]!;
    const b = stroke[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg > 0 && walked + seg >= distance) {
      const t = (distance - walked) / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    walked += seg;
  }
  return { ...stroke[stroke.length - 1]! };
}

/** The stretch of the polyline between two arc-length distances. */
function subStroke(stroke: readonly JamoStrokePoint[], from: number, to: number): JamoStrokePoint[] {
  const out = [pointAlong(stroke, from)];
  let walked = 0;
  for (let i = 1; i < stroke.length; i++) {
    walked += Math.hypot(stroke[i]!.x - stroke[i - 1]!.x, stroke[i]!.y - stroke[i - 1]!.y);
    if (walked > from && walked < to) out.push({ ...stroke[i]! });
  }
  out.push(pointAlong(stroke, to));
  return out;
}

function arrowFor(stroke: readonly JamoStrokePoint[], startAt: number): StrokeArrow | null {
  const total = strokeLength(stroke);
  const from = startAt + BADGE_RADIUS + ARROW_GAP;
  const to = Math.min(from + ARROW_LENGTH, total);
  if (to - from < MIN_ARROW) return null;
  const shaft = subStroke(stroke, from, to);
  const tail = shaft[0]!;
  const tip = shaft[shaft.length - 1]!;
  const back = pointAlong(stroke, to - ARROW_HEAD);
  const angle = Math.atan2(tip.y - back.y, tip.x - back.x);
  const wing = (turn: number): JamoStrokePoint => ({
    x: tip.x - ARROW_HEAD * Math.cos(angle + turn),
    y: tip.y - ARROW_HEAD * Math.sin(angle + turn),
  });
  const left = wing(Math.PI / 6);
  const right = wing(-Math.PI / 6);
  return {
    d: pointsToPathD(shaft),
    head: pointsToPathD([left, tip, right]),
    tail,
    tip,
  };
}

export function buildStrokeDiagram(target: readonly (readonly JamoStrokePoint[])[]): StrokeDiagramItem[] {
  const items: StrokeDiagramItem[] = [];
  for (const stroke of target) {
    if (stroke.length === 0) continue;
    const total = strokeLength(stroke);
    // Two strokes can start on the same spot (ㄹ's 2nd and 3rd): slide the
    // later badge along its own stroke until the numbers stop overlapping.
    let at = 0;
    let badge = pointAlong(stroke, at);
    const taken = (p: JamoStrokePoint): boolean =>
      items.some((it) => Math.hypot(it.badge.x - p.x, it.badge.y - p.y) < BADGE_RADIUS * 2);
    while (taken(badge) && at + BADGE_RADIUS / 2 <= total) {
      at += BADGE_RADIUS / 2;
      badge = pointAlong(stroke, at);
    }
    items.push({
      order: items.length + 1,
      d: pointsToPathD(stroke),
      badge,
      arrow: arrowFor(stroke, at),
    });
  }
  return items;
}

/** How long the still diagram stays up: long enough to read each number. */
export function staticHintHoldMs(strokeCount: number): number {
  return Math.min(5000, Math.max(2000, 1400 + 700 * strokeCount));
}

// ── Text alternative for the still diagram (screen readers) ──

const DIRECTION_WORDS = [
  'right',
  'down and right',
  'down',
  'down and left',
  'left',
  'up and left',
  'up',
  'up and right',
] as const;

/** Screen y grows downward, so atan2(dy, dx) = 0 is right and +90° is down. */
function directionWord(dx: number, dy: number): string {
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return DIRECTION_WORDS[((octant % 8) + 8) % 8]!;
}

/** Legs shorter than this share of the stroke are wobble, not a turn. */
const MIN_LEG_SHARE = 0.15;
const MAX_LEGS = 3;

/** One stroke in words: "right, then down", "a loop", "down and left". */
export function describeStroke(stroke: readonly JamoStrokePoint[]): string {
  const total = strokeLength(stroke);
  if (stroke.length < 2 || total === 0) return 'a dot';
  const first = stroke[0]!;
  const last = stroke[stroke.length - 1]!;
  // Ends where it starts: a ring (ㅇ, ㅁ), or an out-and-back line.
  if (Math.hypot(last.x - first.x, last.y - first.y) < total * 0.1) return 'a loop';

  const legs: Array<{ word: string; length: number }> = [];
  for (let i = 1; i < stroke.length; i++) {
    const a = stroke[i - 1]!;
    const b = stroke[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    const word = directionWord(b.x - a.x, b.y - a.y);
    const prev = legs[legs.length - 1];
    if (prev && prev.word === word) prev.length += length;
    else legs.push({ word, length });
  }
  const major = legs.filter((l) => l.length >= total * MIN_LEG_SHARE);
  const words = major.filter((l, i) => i === 0 || l.word !== major[i - 1]!.word).map((l) => l.word);
  if (words.length === 0 || words.length > MAX_LEGS) {
    return `curving ${directionWord(last.x - first.x, last.y - first.y)}`;
  }
  return words.join(', then ');
}

/**
 * The still diagram as one sentence per stroke, in writing order:
 * "Stroke order. 1: right, then down. 2: a loop." Read aloud by the diagram's
 * accessibility label — the picture itself carries no text for a screen reader.
 */
export function describeStrokeOrder(target: readonly (readonly JamoStrokePoint[])[]): string {
  const strokes = target.filter((s) => s.length > 0);
  if (strokes.length === 0) return 'Stroke order guide';
  const parts = strokes.map((s, i) => `${i + 1}: ${describeStroke(s)}`);
  const head = strokes.length === 1 ? 'Stroke order. One stroke' : `Stroke order. ${strokes.length} strokes`;
  return `${head}. ${parts.join('. ')}.`;
}
