/**
 * Composition rules for scene art (F-STORY-002 §3.9.5). `checkItem` and
 * `checkScene` return findings and never throw; tests and the contact sheet
 * both read them. Errors break a budget or a hard rule; warnings are
 * composition judgement calls a reviewer can overrule.
 *
 * Not mechanical, so left to the review checklist on the contact sheet: faces
 * smile or are calm, people are faceless, and no violence or fear is shown.
 */
import {
  boundsOf,
  nodeCount,
  paletteOf,
  parsePath,
  resolveScene,
  thumbVariant,
  type Bounds,
  type Registry,
  type ResolvedLayer,
  type ResolvedScene,
} from './resolve';
import { isColorToken } from './tokens-map';
import { OPACITY_STEPS, SCENE_CANVAS, type ColorToken, type ItemDef, type SceneArtLike, type Shape } from './types';

export interface Finding {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  layerIndex?: number;
  ref?: string;
}

export const LIMITS = {
  propShapes: 40,
  settingShapes: 60,
  propColors: 5,
  settingColors: 6,
  propBytes: 3 * 1024,
  settingBytes: 6 * 1024,
  /** Item shapes drawn as detail, at most this share (percent). */
  detailPercent: 50,
  /** `brand.primary` shapes, at most this share (percent). */
  redPercent: 15,
  pathChars: 240,
  polyPoints: { min: 3, max: 16 },
  sceneBytes: 700,
  sceneLayers: 8,
  sceneShapes: 160,
  sceneShapesThumb: 80,
  sceneColors: 8,
  altChars: 140,
  /** A layer's bounds may overhang the canvas by this many units. */
  overhang: 20,
  hoyaScale: { min: 0.5, max: 1.1 },
  /** Hoya's centre must sit below this share (percent) of the canvas height. */
  hoyaTopPercent: 40,
  /** Hoya drawn after the focus may cover at most this share (percent) of it. */
  hoyaCoverPercent: 25,
  overlapPercent: 60,
  /** Focus must be at least this tall (percent of the canvas height). */
  focalHeightPercent: 25,
  focalThumbShapes: 3,
  /** Tolerance around a horizontal third line for the focus centre. */
  thirdLine: 20,
  /** A setting shape this close to the horizon (or below) counts as ground. */
  groundSlack: 10,
} as const;

const SHAPE_KINDS = new Set(['rect', 'circle', 'ellipse', 'line', 'path', 'poly', 'group']);
const STROKES = new Set(['thin', 'base', 'thick']);
const HANGUL = new RegExp('[\\u1100-\\u11FF\\u3130-\\u318F\\uA960-\\uA97F\\uAC00-\\uD7FF]');

/** UTF-8 size of the JSON form, the unit every size budget is measured in. */
export function serializedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

const half = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v * 2);

const REQUIRED: Record<string, readonly string[]> = {
  rect: ['x', 'y', 'w', 'h'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
};
const OPTIONAL: Record<string, readonly string[]> = { rect: ['r'], group: ['tx', 'ty'] };

function grammarProblems(shape: Shape, depth: number): string[] {
  const out: string[] = [];
  const rec = shape as unknown as Record<string, unknown>;
  for (const key of REQUIRED[shape.t] ?? []) if (!half(rec[key])) out.push(`${shape.t}.${key} must be a multiple of 0.5`);
  for (const key of OPTIONAL[shape.t] ?? []) if (rec[key] !== undefined && !half(rec[key])) out.push(`${shape.t}.${key} must be a multiple of 0.5`);
  if (shape.t === 'path') {
    const segs = parsePath(shape.d);
    if (shape.d.length > LIMITS.pathChars) out.push(`path longer than ${LIMITS.pathChars} characters`);
    if (!segs) out.push('path must use absolute M L H V C Q A Z only');
    else if (!segs.every((s) => s.args.every(half))) out.push('path numbers must be multiples of 0.5');
  }
  if (shape.t === 'poly') {
    if (shape.pts.length < LIMITS.polyPoints.min || shape.pts.length > LIMITS.polyPoints.max) out.push('poly needs 3 to 16 points');
    if (!shape.pts.every(([x, y]) => half(x) && half(y))) out.push('poly points must be multiples of 0.5');
  }
  if (shape.t === 'group' && depth > 0) out.push('groups nest one level deep only');
  if (shape.sw !== undefined && !STROKES.has(shape.sw)) out.push(`unknown stroke ${String(shape.sw)}`);
  if (shape.o !== undefined && !(OPACITY_STEPS as readonly number[]).includes(shape.o)) out.push(`opacity ${shape.o} is not a step`);
  return out;
}

interface Leaf {
  shape: Shape;
  detail: boolean;
}

function walk(shapes: readonly Shape[], depth: number, detail: boolean, visit: (s: Shape, depth: number) => void, leaves: Leaf[]): void {
  for (const shape of shapes) {
    visit(shape, depth);
    if (shape.t === 'group') walk(shape.kids, depth + 1, detail || shape.det === true, visit, leaves);
    else leaves.push({ shape, detail: detail || shape.det === true });
  }
}

export function checkItem(item: ItemDef): Finding[] {
  const out: Finding[] = [];
  const err = (rule: string, message: string): void => {
    out.push({ rule, severity: 'error', message: `${item.id}: ${message}`, ref: item.id });
  };
  const setting = item.kind === 'setting';
  const leaves: Leaf[] = [];
  walk(
    item.nodes,
    0,
    false,
    (shape, depth) => {
      if (!SHAPE_KINDS.has(shape.t)) {
        err('I-kind', `shape kind "${String(shape.t)}" is not one of the eight`);
        return;
      }
      for (const problem of grammarProblems(shape, depth)) err('I-grammar', problem);
    },
    leaves,
  );

  const tokens = leaves.flatMap(({ shape }) => [shape.fill === 'none' ? undefined : shape.fill, shape.stroke]).filter((t): t is ColorToken => t !== undefined);
  for (const token of new Set([...tokens, ...(item.tintable ? [item.tintable] : [])])) {
    if (!isColorToken(token)) err('I-color', `"${String(token)}" is not a usable colour token`);
  }

  const total = nodeCount(item.nodes);
  const maxShapes = setting ? LIMITS.settingShapes : LIMITS.propShapes;
  if (total > maxShapes) err('I-shapes', `${total} shapes, at most ${maxShapes}`);

  const maxColors = setting ? LIMITS.settingColors : LIMITS.propColors;
  const colorCount = paletteOf(item).length;
  if (colorCount > maxColors) err('I-palette', `${colorCount} colour tokens, at most ${maxColors}`);

  item.nodes.forEach((shape, i) => {
    const b = boundsOf([shape]);
    if (b && (b.minX < 0 || b.minY < 0 || b.maxX > item.box.w || b.maxY > item.box.h)) err('I-box', `shape ${i} leaves the ${item.box.w} x ${item.box.h} box`);
  });

  const detail = leaves.filter((l) => l.detail).length;
  if (detail * 100 > total * LIMITS.detailPercent) err('I-detail', `${detail} of ${total} shapes are detail, at most ${LIMITS.detailPercent}%`);

  const red = leaves.filter(({ shape }) => shape.fill === 'brand.primary' || shape.stroke === 'brand.primary').length;
  if (red * 100 > total * LIMITS.redPercent) err('I-red', `${red} of ${total} shapes use brand.primary, at most ${LIMITS.redPercent}%`);

  if (item.kind === 'object' && item.tags?.heritage && !item.sourceRef) err('I-heritage', 'a heritage artefact needs a sourceRef');

  const bytes = serializedBytes(item);
  const maxBytes = setting ? LIMITS.settingBytes : LIMITS.propBytes;
  if (bytes > maxBytes) err('I-size', `${bytes} bytes, at most ${maxBytes}`);

  if (setting && (item.horizonY === undefined || item.horizonY < 0 || item.horizonY > item.box.h)) err('I-horizon', 'a setting declares horizonY inside its box');
  return out;
}

// --- scene rules ----------------------------------------------------------

const area = (b: Bounds): number => (b.maxX - b.minX) * (b.maxY - b.minY);

function intersection(a: Bounds, b: Bounds): number {
  const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The largest mid-band item or Hoya, by canvas area; ties go to the earlier draw. */
function focalLayer(layers: readonly ResolvedLayer[]): ResolvedLayer | undefined {
  let best: ResolvedLayer | undefined;
  for (const l of layers) {
    if (!l.bounds || (l.band !== 'mid' && !l.ref.startsWith('hoya:'))) continue;
    if (!best || area(l.bounds) > area(best.bounds!)) best = l;
  }
  return best;
}

function dominantFill(scene: ResolvedScene, layerIndex: number): ColorToken | undefined {
  const weight = new Map<ColorToken, number>();
  for (const n of scene.nodes) {
    if (n.layerIndex !== layerIndex || !n.shape.fill || n.shape.fill === 'none') continue;
    const b = boundsOf([n.shape], n.matrix);
    weight.set(n.shape.fill, (weight.get(n.shape.fill) ?? 0) + (b ? area(b) : 0));
  }
  let best: ColorToken | undefined;
  for (const [fill, w] of weight) if (best === undefined || w > weight.get(best)!) best = fill;
  return best;
}

function groundFill(scene: ResolvedScene, horizonY: number): ColorToken | undefined {
  let best: { fill: ColorToken; size: number } | undefined;
  for (const n of scene.nodes) {
    if (n.layerIndex !== -1 || !n.shape.fill || n.shape.fill === 'none') continue;
    const b = boundsOf([n.shape], n.matrix);
    if (!b || b.minY < horizonY - LIMITS.groundSlack) continue;
    if (!best || area(b) > best.size) best = { fill: n.shape.fill, size: area(b) };
  }
  return best?.fill;
}

export function checkScene(art: SceneArtLike, registry: Registry): Finding[] {
  const out: Finding[] = [];
  const add = (severity: Finding['severity'], rule: string, message: string, layerIndex?: number, ref?: string): void => {
    out.push({ rule, severity, message, ...(layerIndex === undefined ? {} : { layerIndex }), ...(ref === undefined ? {} : { ref }) });
  };
  const scene = resolveScene(art, registry);
  const thumb = resolveScene(art, registry, { variant: 'thumb' });
  const def = (ref: string): ItemDef => registry[ref]!;
  const setting = Object.hasOwn(registry, art.setting) ? registry[art.setting] : undefined;
  const { width: W, height: H } = SCENE_CANVAS;

  for (const issue of scene.issues) add('error', 'S-resolve', `${issue.kind}: ${issue.ref}`, issue.layerIndex, issue.ref);

  // R-S1 canvas: anchor inside, bounds overhang within 20 units
  const drawn = new Map(scene.layers.map((l) => [l.layerIndex, l]));
  art.layers.forEach((layer, i) => {
    const b = drawn.get(i)?.bounds;
    const anchorOut = layer.x < 0 || layer.x > W || layer.y < 0 || layer.y > H;
    const o = LIMITS.overhang;
    const overhangs = b !== null && b !== undefined && (b.minX < -o || b.minY < -o || b.maxX > W + o || b.maxY > H + o);
    if (anchorOut || overhangs) add('error', 'S-canvas', `layer ${i} (${layer.ref}) leaves the canvas`, i, layer.ref);
  });

  // R-S2 horizon
  if (setting?.horizonY !== undefined) {
    const horizon = setting.horizonY;
    for (const l of scene.layers) {
      if (l.kind === 'card' || l.kind === 'symbol') continue;
      const d = def(l.ref);
      if (d.kind === 'nature' && d.tags?.sky) continue;
      const y = art.layers[l.layerIndex]!.y;
      if (y < horizon) add('warning', 'S-horizon', `layer ${l.layerIndex} (${l.ref}) stands above the horizon (y ${y} < ${horizon})`, l.layerIndex, l.ref);
    }
  }

  // R-S3 one focal point, placed, without crowding
  const focus = focalLayer(scene.layers);
  if (!focus) {
    add('warning', 'S-focal', 'no mid-band item or Hoya to act as the focal point');
  } else {
    const b = focus.bounds!;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const central = cx >= W / 3 && cx <= (2 * W) / 3;
    const onLine = Math.abs(cy - H / 3) <= LIMITS.thirdLine || Math.abs(cy - (2 * H) / 3) <= LIMITS.thirdLine;
    if (!central && !onLine) add('warning', 'S-focal', `focal layer ${focus.layerIndex} is neither in the central third nor on a third line`, focus.layerIndex, focus.ref);
  }
  const solid = scene.layers.filter((l) => l.bounds && l.band !== 'back');
  solid.forEach((a, i) => {
    for (const b of solid.slice(i + 1)) {
      const small = Math.min(area(a.bounds!), area(b.bounds!));
      if (small > 0 && intersection(a.bounds!, b.bounds!) * 100 > small * LIMITS.overlapPercent) {
        add('warning', 'S-overlap', `layers ${a.layerIndex} and ${b.layerIndex} overlap by more than ${LIMITS.overlapPercent}%`, b.layerIndex, b.ref);
      }
    }
  });

  // R-S4 Hoya
  const hoyas = scene.layers.filter((l) => l.ref.startsWith('hoya:'));
  if (hoyas.length > 1) add('error', 'S-hoya-count', `${hoyas.length} Hoya layers, at most one`);
  for (const h of hoyas) {
    const s = art.layers[h.layerIndex]!.s ?? 1;
    if (s < LIMITS.hoyaScale.min || s > LIMITS.hoyaScale.max) add('error', 'S-hoya-scale', `Hoya scale ${s} outside ${LIMITS.hoyaScale.min}-${LIMITS.hoyaScale.max}`, h.layerIndex, h.ref);
    const b = h.bounds!;
    if ((b.minY + b.maxY) / 2 < (H * LIMITS.hoyaTopPercent) / 100) add('warning', 'S-hoya-place', 'Hoya belongs in the lower 60% of the canvas', h.layerIndex, h.ref);
    if (focus && focus !== h && h.rank > focus.rank && intersection(b, focus.bounds!) * 100 > area(focus.bounds!) * LIMITS.hoyaCoverPercent) {
      add('warning', 'S-hoya-cover', 'Hoya covers the focal artefact', h.layerIndex, h.ref);
    }
  }

  // R-S5 palette
  const colors = scene.stats.colors;
  if (colors.length > LIMITS.sceneColors) add('error', 'S-palette-cap', `${colors.length} colour tokens, at most ${LIMITS.sceneColors}`);
  if (colors.filter((c) => c.startsWith('surface.') || c.startsWith('text.')).length < 2) add('warning', 'S-palette-ink', 'use at least two surface or text tokens so the picture reads on the canvas');
  if (focus && setting?.horizonY !== undefined) {
    const ground = groundFill(scene, setting.horizonY);
    if (ground !== undefined && ground === dominantFill(scene, focus.layerIndex)) add('warning', 'S-ground', 'the focal item blends into the ground fill', focus.layerIndex, focus.ref);
  }

  // R-S6 legibility at thumb size
  if (focus) {
    const b = focus.bounds!;
    if ((b.maxY - b.minY) * 100 < H * LIMITS.focalHeightPercent) add('warning', 'S-legible-size', 'the focal item is under 25% of the canvas height', focus.layerIndex, focus.ref);
    if (nodeCount(thumbVariant(def(focus.ref).nodes)) < LIMITS.focalThumbShapes) add('warning', 'S-legible-thumb', 'the focal item loses too many shapes in the thumb variant', focus.layerIndex, focus.ref);
  }

  // R-S8 budgets
  if (art.layers.length > LIMITS.sceneLayers) add('error', 'S-layers', `${art.layers.length} layers, at most ${LIMITS.sceneLayers}`);
  if (scene.stats.shapes > LIMITS.sceneShapes) add('error', 'S-shapes', `${scene.stats.shapes} resolved shapes, at most ${LIMITS.sceneShapes}`);
  if (thumb.stats.shapes > LIMITS.sceneShapesThumb) add('error', 'S-shapes-thumb', `${thumb.stats.shapes} resolved thumb shapes, at most ${LIMITS.sceneShapesThumb}`);
  const bytes = serializedBytes(art);
  if (bytes > LIMITS.sceneBytes) add('error', 'S-size', `${bytes} bytes, at most ${LIMITS.sceneBytes}`);

  // R-S9 alt text
  const alt = art.altEn.trim();
  if (alt.length === 0 || art.altEn.length > LIMITS.altChars) add('error', 'S-alt', `altEn must be 1 to ${LIMITS.altChars} characters`);
  if (HANGUL.test(art.altEn)) add('error', 'S-alt', 'altEn must not contain Hangul');
  if (/^image of\b/i.test(alt)) add('error', 'S-alt', 'altEn must not start with "Image of"');
  return out;
}
