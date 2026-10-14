/**
 * The drawing list both renderers share (F-STORY-002 §3.9.4): `resolveScene`
 * output turned into plain svg attributes, colours already looked up in the
 * token table. Pure, no React, so every rule about what gets drawn is tested
 * here once; `StoryScene` (react-native-svg) and `dom.tsx` (plain DOM) only map
 * a `DrawItem` onto an element.
 *
 * Production behaviour for bad data is to draw less, never to throw: a shape
 * whose token is unknown or reserved, whose path is malformed or whose kind is
 * not one of the eight is skipped and the rest of the picture still draws.
 */
import { borderWidth } from '../tokens';
import { parsePath, resolveScene, type Matrix, type Registry, type ResolveIssue } from './resolve';
import { isColorToken, resolveColor, resolveStroke } from './tokens-map';
import { SCENE_CANVAS, type LeafShape, type SceneArtLike, type StrokeToken } from './types';

/** Side of a `card:<id>` layer's square, in canvas units at scale 1. */
export const CARD_SIZE = 80;

export interface DrawPaint {
  /** A resolved colour, or `'none'`. */
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  strokeLinecap?: 'round';
  strokeLinejoin?: 'round';
}

export interface DrawNode {
  tag: 'rect' | 'circle' | 'ellipse' | 'line' | 'path' | 'polygon';
  /** Unique within a scene. */
  key: string;
  /** `matrix(a b c d e f)`: item-local to canvas. */
  transform: string;
  /** Svg geometry attributes. */
  geometry: Record<string, number | string>;
  paint: DrawPaint;
  /** Index in `art.layers`, -1 for the setting. */
  layerIndex: number;
}

/** A heritage card picture, drawn by the react-native renderer only. */
export interface DrawCard {
  tag: 'card';
  key: string;
  /** `card:<id>`, the id `HeritageCardArt` takes. */
  ref: string;
  size: number;
  transform: string;
}

export type DrawItem = DrawNode | DrawCard;

export interface DrawnScene {
  viewBox: string;
  /** Back to front. */
  items: DrawItem[];
  issues: ResolveIssue[];
}

const round4 = (v: number): number => Math.round(v * 1e4) / 1e4 + 0; // + 0 turns -0 into 0
const matrixString = (m: Matrix): string => `matrix(${m.map(round4).join(' ')})`;

function paintOf(shape: LeafShape): DrawPaint | null {
  const { fill, stroke, sw, o } = shape;
  const hasFill = fill !== undefined && fill !== 'none';
  if (hasFill && !isColorToken(fill)) return null;
  if (stroke !== undefined && !isColorToken(stroke)) return null;
  if (!hasFill && stroke === undefined) return null;
  if (sw !== undefined && !Object.prototype.hasOwnProperty.call(borderWidth, sw)) return null;
  const paint: DrawPaint = { fill: hasFill ? resolveColor(fill) : 'none' };
  if (stroke !== undefined) {
    paint.stroke = resolveColor(stroke);
    paint.strokeWidth = resolveStroke(sw as StrokeToken | undefined);
    paint.strokeLinecap = 'round';
    paint.strokeLinejoin = 'round';
  }
  if (o !== undefined) paint.opacity = o;
  return paint;
}

function geometryOf(shape: LeafShape): Pick<DrawNode, 'tag' | 'geometry'> | null {
  switch (shape.t) {
    case 'rect':
      return { tag: 'rect', geometry: { x: shape.x, y: shape.y, width: shape.w, height: shape.h, ...(shape.r === undefined ? {} : { rx: shape.r }) } };
    case 'circle':
      return { tag: 'circle', geometry: { cx: shape.cx, cy: shape.cy, r: shape.r } };
    case 'ellipse':
      return { tag: 'ellipse', geometry: { cx: shape.cx, cy: shape.cy, rx: shape.rx, ry: shape.ry } };
    case 'line':
      return { tag: 'line', geometry: { x1: shape.x1, y1: shape.y1, x2: shape.x2, y2: shape.y2 } };
    case 'path':
      return parsePath(shape.d) ? { tag: 'path', geometry: { d: shape.d } } : null;
    case 'poly':
      return shape.pts.length >= 3 ? { tag: 'polygon', geometry: { points: shape.pts.map(([x, y]) => `${x},${y}`).join(' ') } } : null;
    default:
      return null; // an unknown kind from untrusted data draws nothing
  }
}

export function drawScene(art: SceneArtLike, registry: Registry, options: { variant?: 'full' | 'thumb' } = {}): DrawnScene {
  const resolved = resolveScene(art, registry, options);
  const ranked: Array<{ rank: number; item: DrawItem }> = [];

  resolved.nodes.forEach((node, i) => {
    const geometry = geometryOf(node.shape);
    const paint = paintOf(node.shape);
    if (!geometry || !paint) return;
    ranked.push({ rank: node.rank, item: { ...geometry, key: `n${i}`, transform: matrixString(node.matrix), paint, layerIndex: node.layerIndex } });
  });

  for (const card of resolved.cards) {
    const a = card.flip ? -card.s : card.s;
    const matrix: Matrix = [a, 0, 0, card.s, card.x - a * (CARD_SIZE / 2), card.y - card.s * CARD_SIZE];
    ranked.push({ rank: card.rank, item: { tag: 'card', key: `c${card.layerIndex}`, ref: card.ref, size: CARD_SIZE, transform: matrixString(matrix) } });
  }

  // Array.prototype.sort is stable: shapes of one layer keep their order.
  ranked.sort((x, y) => x.rank - y.rank);
  return { viewBox: `0 0 ${SCENE_CANVAS.width} ${SCENE_CANVAS.height}`, items: ranked.map((r) => r.item), issues: resolved.issues };
}

/**
 * One registered prop on its own, with its box as the viewBox (the realia dressings of
 * F-CURR-001 G-2 are drawn this way, as `HoyaSvg` draws Hoya). `null` for an unknown ref, so
 * the caller draws its plain fallback instead of a blank box.
 */
export function drawProp(ref: string, registry: Registry): DrawnScene | null {
  const item = Object.prototype.hasOwnProperty.call(registry, ref) ? registry[ref] : undefined;
  if (!item) return null;
  const { w, h } = item.box;
  const { items, issues } = drawScene({ setting: '', layers: [{ ref, x: w / 2, y: h }], altEn: '' }, registry);
  return { viewBox: `0 0 ${w} ${h}`, items, issues };
}
