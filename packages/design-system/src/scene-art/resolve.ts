/**
 * Pure geometry for scene art (F-STORY-002 §3.9.3): turn a `SceneArt`
 * description and a registry into one flat, transformed node list. No React,
 * no react-native; both renderers draw what this returns.
 */
import { isColorToken } from './tokens-map';
import {
  SCENE_CANVAS,
  type Band,
  type ColorToken,
  type ItemDef,
  type ItemKind,
  type LeafShape,
  type SceneArtLike,
  type Shape,
} from './types';

export type Registry = Readonly<Record<string, ItemDef>>;

/** SVG matrix(a b c d e f): x' = a x + c y + e, y' = b x + d y + f. */
export type Matrix = readonly [number, number, number, number, number, number];

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ResolvedNode {
  shape: LeafShape;
  /** Item-local coordinates to canvas coordinates. */
  matrix: Matrix;
  /** Draw order: -1 for the setting, then the layer's position after band sorting. */
  rank: number;
  /** Index in `art.layers`, -1 for the setting. */
  layerIndex: number;
  ref: string;
}

export interface ResolvedLayer {
  layerIndex: number;
  ref: string;
  band: Band;
  rank: number;
  kind: ItemKind | 'card';
  shapes: number;
  /** Canvas-space bounds; null for a card (its size is the renderer's). */
  bounds: Bounds | null;
}

/** A `card:<id>` layer, passed through for the react-native renderer. */
export interface ResolvedCard {
  ref: string;
  x: number;
  y: number;
  s: number;
  flip: boolean;
  layerIndex: number;
  rank: number;
}

export interface ResolveIssue {
  kind: 'unresolved-setting' | 'unresolved-ref' | 'invalid-tint' | 'tint-unsupported';
  ref: string;
  layerIndex: number;
}

export interface ResolvedScene {
  /** Setting first, then layers in draw order. */
  nodes: ResolvedNode[];
  layers: ResolvedLayer[];
  cards: ResolvedCard[];
  issues: ResolveIssue[];
  stats: { layers: number; shapes: number; colors: ColorToken[]; bounds: Bounds | null };
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const BAND_ORDER: Record<Band, number> = { back: 0, mid: 1, front: 2 };

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4 + 0; // + 0 turns -0 into 0
}

function multiply(p: Matrix, g: Matrix): Matrix {
  return [
    p[0] * g[0] + p[2] * g[1],
    p[1] * g[0] + p[3] * g[1],
    p[0] * g[2] + p[2] * g[3],
    p[1] * g[2] + p[3] * g[3],
    p[0] * g[4] + p[2] * g[5] + p[4],
    p[1] * g[4] + p[3] * g[5] + p[5],
  ];
}

function rounded(m: Matrix): Matrix {
  return [round4(m[0]), round4(m[1]), round4(m[2]), round4(m[3]), round4(m[4]), round4(m[5])];
}

/** translate(tx, ty) rotate(rot) scale(s, flip ? -s : s), the group's own frame. */
function groupMatrix(g: Extract<Shape, { t: 'group' }>): Matrix {
  const rad = ((g.rot ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const s = g.s ?? 1;
  const sx = g.flip ? -s : s;
  return [cos * sx, sin * sx, -sin * s, cos * s, g.tx ?? 0, g.ty ?? 0];
}

/** Item-local to canvas: the anchor (w / 2, h) lands on (x, y); flip mirrors about the anchor. */
function placement(def: ItemDef, x: number, y: number, s: number, flip: boolean): Matrix {
  const a = flip ? -s : s;
  return [a, 0, 0, s, x - a * (def.box.w / 2), y - s * def.box.h];
}

// --- paths ----------------------------------------------------------------

export interface PathSegment {
  cmd: 'M' | 'L' | 'H' | 'V' | 'C' | 'Q' | 'A' | 'Z';
  args: number[];
}

const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, A: 7, Z: 0 } as const;
type Cmd = keyof typeof ARITY;
const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;

/**
 * Parses the absolute-only path grammar (M L H V C Q A Z, whitespace
 * separated or tight). Returns null for anything else.
 */
export function parsePath(d: string): PathSegment[] | null {
  const groups: Array<{ cmd: Cmd; nums: number[] }> = [];
  let i = 0;
  while (i < d.length) {
    const ch = d[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i += 1;
    } else if (Object.hasOwn(ARITY, ch)) {
      groups.push({ cmd: ch as Cmd, nums: [] });
      i += 1;
    } else {
      NUMBER.lastIndex = i;
      const m = NUMBER.exec(d);
      const current = groups[groups.length - 1];
      if (!m || !current) return null;
      current.nums.push(Number(m[0]));
      i = NUMBER.lastIndex;
    }
  }
  if (groups[0]?.cmd !== 'M') return null;
  const out: PathSegment[] = [];
  for (const { cmd, nums } of groups) {
    const n = ARITY[cmd];
    if (n === 0) {
      if (nums.length > 0) return null;
      out.push({ cmd: 'Z', args: [] });
      continue;
    }
    if (nums.length === 0 || nums.length % n !== 0) return null;
    for (let k = 0; k < nums.length; k += n) {
      const args = nums.slice(k, k + n);
      if (cmd === 'A' && (!(args[3] === 0 || args[3] === 1) || !(args[4] === 0 || args[4] === 1))) return null;
      out.push({ cmd: k > 0 && cmd === 'M' ? 'L' : cmd, args });
    }
  }
  return out;
}

type Pt = [number, number];

const ARC_SAMPLES = 32;

function arcPoints(x0: number, y0: number, rxIn: number, ryIn: number, rotDeg: number, fa: number, fs: number, x1: number, y1: number): Pt[] {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if ((x0 === x1 && y0 === y1) || rx === 0 || ry === 0) return [[x1, y1]];
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x0 - x1) / 2;
  const dy = (y0 - y1) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const k = Math.sqrt(lambda);
    rx *= k;
    ry *= k;
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x0 + x1) / 2;
  const cy = sin * cxp + cos * cyp + (y0 + y1) / 2;
  const t1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
  const t2 = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx);
  let dt = t2 - t1;
  if (fs === 0 && dt > 0) dt -= 2 * Math.PI;
  if (fs === 1 && dt < 0) dt += 2 * Math.PI;
  const pts: Pt[] = [];
  for (let k = 1; k < ARC_SAMPLES; k += 1) {
    const t = t1 + (dt * k) / ARC_SAMPLES;
    pts.push([cx + rx * cos * Math.cos(t) - ry * sin * Math.sin(t), cy + rx * sin * Math.cos(t) + ry * cos * Math.sin(t)]);
  }
  pts.push([x1, y1]);
  return pts;
}

function pathPoints(d: string): Pt[] {
  const segs = parsePath(d);
  if (!segs) return [];
  const pts: Pt[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const { cmd, args } of segs) {
    if (cmd === 'Z') {
      cx = sx;
      cy = sy;
      continue;
    }
    if (cmd === 'H') {
      cx = args[0]!;
    } else if (cmd === 'V') {
      cy = args[0]!;
    } else if (cmd === 'A') {
      pts.push(...arcPoints(cx, cy, args[0]!, args[1]!, args[2]!, args[3]!, args[4]!, args[5]!, args[6]!));
      cx = args[5]!;
      cy = args[6]!;
    } else {
      for (let k = 0; k < args.length; k += 2) pts.push([args[k]!, args[k + 1]!]);
      cx = args[args.length - 2]!;
      cy = args[args.length - 1]!;
    }
    if (cmd === 'M') {
      sx = cx;
      sy = cy;
    }
    if (cmd === 'H' || cmd === 'V') pts.push([cx, cy]);
  }
  return pts;
}

// --- bounds, counts, palette ---------------------------------------------

/** Extreme points of a leaf in its own coordinates (boxes for round shapes). */
function hull(s: LeafShape): Pt[] {
  switch (s.t) {
    case 'rect':
      return [[s.x, s.y], [s.x + s.w, s.y], [s.x, s.y + s.h], [s.x + s.w, s.y + s.h]];
    case 'circle':
      return [[s.cx - s.r, s.cy - s.r], [s.cx + s.r, s.cy - s.r], [s.cx - s.r, s.cy + s.r], [s.cx + s.r, s.cy + s.r]];
    case 'ellipse':
      return [[s.cx - s.rx, s.cy - s.ry], [s.cx + s.rx, s.cy - s.ry], [s.cx - s.rx, s.cy + s.ry], [s.cx + s.rx, s.cy + s.ry]];
    case 'line':
      return [[s.x1, s.y1], [s.x2, s.y2]];
    case 'poly':
      return s.pts;
    case 'path':
      return pathPoints(s.d);
    default:
      return []; // an unknown kind from untrusted data draws nothing
  }
}

function collect(shapes: readonly Shape[], m: Matrix, out: Pt[]): void {
  for (const shape of shapes) {
    if (shape.t === 'group') {
      collect(shape.kids, multiply(m, groupMatrix(shape)), out);
    } else {
      for (const [x, y] of hull(shape)) out.push([m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
    }
  }
}

function bboxOf(pts: readonly Pt[]): Bounds | null {
  if (pts.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX: round4(minX), minY: round4(minY), maxX: round4(maxX), maxY: round4(maxY) };
}

/** Bounds of shapes in their own coordinates (stroke width ignored); null when nothing is drawn. */
export function boundsOf(shapes: readonly Shape[], matrix: Matrix = IDENTITY): Bounds | null {
  const pts: Pt[] = [];
  collect(shapes, matrix, pts);
  return bboxOf(pts);
}

function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a || !b) return a ?? b;
  return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) };
}

/** Leaf shapes drawn; groups are containers and do not count. */
export function nodeCount(shapes: readonly Shape[]): number {
  return shapes.reduce((n, s) => n + (s.t === 'group' ? nodeCount(s.kids) : 1), 0);
}

function addPalette(shapes: readonly Shape[], into: Set<ColorToken>): void {
  for (const s of shapes) {
    if (s.t === 'group') {
      addPalette(s.kids, into);
    } else {
      if (s.fill && s.fill !== 'none') into.add(s.fill);
      if (s.stroke) into.add(s.stroke);
    }
  }
}

/** Distinct colour tokens an item uses, sorted. */
export function paletteOf(item: Pick<ItemDef, 'nodes'>): ColorToken[] {
  const set = new Set<ColorToken>();
  addPalette(item.nodes, set);
  return [...set].sort();
}

/** The cheap picture for small sizes: no detail shapes, no hairline strokes. */
export function thumbVariant(nodes: readonly Shape[]): Shape[] {
  const out: Shape[] = [];
  for (const shape of nodes) {
    if (shape.d) continue;
    if (shape.t === 'group') {
      const kids = thumbVariant(shape.kids);
      if (kids.length > 0) out.push({ ...shape, kids });
      continue;
    }
    if (shape.sw === 'thin' && shape.stroke) {
      const { stroke: _stroke, sw: _sw, ...rest } = shape;
      if (rest.fill === undefined || rest.fill === 'none') continue;
      out.push(rest as Shape);
    } else {
      out.push(shape);
    }
  }
  return out;
}

// --- resolution -------------------------------------------------------------

function recolor(shapes: readonly Shape[], from: ColorToken, to: ColorToken): Shape[] {
  return shapes.map((s) => {
    const next = { ...s };
    if (next.fill === from) next.fill = to;
    if (next.stroke === from) next.stroke = to;
    return s.t === 'group' ? ({ ...next, kids: recolor(s.kids, from, to) } as Shape) : next;
  });
}

function flatten(shapes: readonly Shape[], m: Matrix, base: Omit<ResolvedNode, 'shape' | 'matrix'>, out: ResolvedNode[]): void {
  for (const shape of shapes) {
    if (shape.t === 'group') flatten(shape.kids, multiply(m, groupMatrix(shape)), base, out);
    else out.push({ ...base, shape, matrix: rounded(m) });
  }
}

function lookup(registry: Registry, ref: string, setting: boolean): ItemDef | undefined {
  if (!Object.hasOwn(registry, ref)) return undefined;
  const def = registry[ref]!;
  return (def.kind === 'setting') === setting ? def : undefined;
}

interface Entry {
  index: number;
  ref: string;
  band: Band;
  def: ItemDef | null;
  shapes: readonly Shape[];
  x: number;
  y: number;
  s: number;
  flip: boolean;
}

export function resolveScene(art: SceneArtLike, registry: Registry, options: { variant?: 'full' | 'thumb' } = {}): ResolvedScene {
  const thumb = options.variant === 'thumb';
  const prepare = (nodes: readonly Shape[]): readonly Shape[] => (thumb ? thumbVariant(nodes) : nodes);
  const issues: ResolveIssue[] = [];
  const nodes: ResolvedNode[] = [];
  let bounds: Bounds | null = null;

  const setting = lookup(registry, art.setting, true);
  if (setting) {
    const shapes = prepare(setting.nodes);
    const m = placement(setting, SCENE_CANVAS.width / 2, SCENE_CANVAS.height, 1, false);
    flatten(shapes, m, { rank: -1, layerIndex: -1, ref: setting.id }, nodes);
    bounds = boundsOf(shapes, m);
  } else {
    issues.push({ kind: 'unresolved-setting', ref: art.setting, layerIndex: -1 });
  }

  const entries: Entry[] = [];
  art.layers.forEach((layer, index) => {
    const placed = { index, ref: layer.ref, x: layer.x, y: layer.y, s: layer.s ?? 1, flip: layer.flip ?? false };
    if (layer.ref.startsWith('card:')) {
      entries.push({ ...placed, band: layer.z ?? 'mid', def: null, shapes: [] });
      return;
    }
    const def = lookup(registry, layer.ref, false);
    if (!def) {
      issues.push({ kind: 'unresolved-ref', ref: layer.ref, layerIndex: index });
      return;
    }
    let shapes = def.nodes;
    if (layer.tint !== undefined) {
      if (!isColorToken(layer.tint)) issues.push({ kind: 'invalid-tint', ref: layer.ref, layerIndex: index });
      else if (!def.tintable) issues.push({ kind: 'tint-unsupported', ref: layer.ref, layerIndex: index });
      else shapes = recolor(shapes, def.tintable, layer.tint);
    }
    entries.push({ ...placed, band: layer.z ?? def.z, def, shapes: prepare(shapes) });
  });
  entries.sort((a, b) => BAND_ORDER[a.band] - BAND_ORDER[b.band] || a.index - b.index);

  const layers: ResolvedLayer[] = [];
  const cards: ResolvedCard[] = [];
  entries.forEach((e, rank) => {
    if (!e.def) {
      cards.push({ ref: e.ref, x: e.x, y: e.y, s: e.s, flip: e.flip, layerIndex: e.index, rank });
      layers.push({ layerIndex: e.index, ref: e.ref, band: e.band, rank, kind: 'card', shapes: 0, bounds: null });
      return;
    }
    const m = placement(e.def, e.x, e.y, e.s, e.flip);
    flatten(e.shapes, m, { rank, layerIndex: e.index, ref: e.ref }, nodes);
    const b = boundsOf(e.shapes, m);
    bounds = unionBounds(bounds, b);
    layers.push({ layerIndex: e.index, ref: e.ref, band: e.band, rank, kind: e.def.kind, shapes: nodeCount(e.shapes), bounds: b });
  });

  const colors = new Set<ColorToken>();
  addPalette(
    nodes.map((n) => n.shape),
    colors,
  );
  return { nodes, layers, cards, issues, stats: { layers: layers.length, shapes: nodes.length, colors: [...colors].sort(), bounds } };
}
