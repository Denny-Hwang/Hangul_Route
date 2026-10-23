/**
 * The `hidden-heritage` profile of the scene rules (F-CURR-002 §7.1 F7, row CM-36; the "Scene style guide" of
 * design/wireframes/minigame/hidden-heritage.md, sections 3 and 4). It runs every numbered rule a find-the-thing
 * scene adds to, or changes in, the story rules of `../rules.ts`: no focal point, up to 14 layers and 240 shapes,
 * the ring and focus tokens kept out, every target outlined and readable at thumb size, the rings visible on every
 * spot, the hit areas H-1 to H-4, and the 25,000 B chunk. Findings, never a throw. Tests and the contact sheet read it;
 * the app does not import it, so it is in no bundle.
 */
import { contrastRatio, relativeLuminance, WCAG_AA_LARGE } from '../../contrast';
import { HOYA_POSES } from '../hoya';
import { SCENE_ART_REGISTRY } from '../registry';
import { boundsOf, nodeCount, resolveScene, thumbVariant, type Bounds, type Registry, type ResolvedScene } from '../resolve';
import { cappedPalette, checkItem, LIMITS, serializedBytes, type Finding } from '../rules';
import { isColorToken, resolveColor } from '../tokens-map';
import { SCENE_CANVAS, type ColorToken, type ItemDef } from '../types';
import { HIDDEN_HERITAGE_RINGS, type HiddenHeritageRings, type HiddenHeritageRoundLike, type HiddenHeritageScene, type HiddenHeritageSpotLike } from './types';

export const HIDDEN_HERITAGE_LIMITS = {
  layers: 14,
  shapes: 240,
  colors: 8,
  targets: { min: 3, max: 5 },
  others: { min: 3, max: 6 },
  /** H-1: a spot is at least this many canvas units on each side (54 dp at 320 px, 48 dp at the 256 dp smallest scene). */
  spotMin: 75,
  /** H-2: spots keep this many units apart. */
  spotGap: 11,
  hoyaScale: { min: 0.5, max: 0.8 },
  /** A target still has this many shapes after the thumb variant drops details (it reads at 54 dp). */
  thumbShapes: 3,
  /** The scene's chunk: its description, items, round and note (F-CURR-002 §10 ceilings table). */
  chunkBytes: 25_000,
} as const;

/** Tokens a scene never uses: the rings, the keyboard focus outline and every feedback colour (style guide 4). */
const RESERVED_IN_SCENE = (token: string): boolean => token.startsWith('feedback.') || token === 'border.focus';

const area = (b: Bounds): number => (b.maxX - b.minX) * (b.maxY - b.minY);
const covers = (spot: HiddenHeritageSpotLike, b: Bounds): boolean => spot.x <= b.minX && spot.y <= b.minY && spot.x + spot.w >= b.maxX && spot.y + spot.h >= b.maxY;
const gapOf = (a: HiddenHeritageSpotLike, b: HiddenHeritageSpotLike): number =>
  Math.max(Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0), Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0));

/** The base registry plus the scene's own items: what its renderer draws with. */
export function sceneRegistry(scene: Pick<HiddenHeritageScene, 'items'>, base: Registry = SCENE_ART_REGISTRY): Registry {
  return { ...base, ...Object.fromEntries(scene.items.map((item) => [item.id, item])) };
}

/** The fill covering the most area of one layer (the setting is layer -1). */
function dominantFill(resolved: ResolvedScene, layerIndex: number): ColorToken | undefined {
  const weight = new Map<ColorToken, number>();
  for (const n of resolved.nodes) {
    if (n.layerIndex !== layerIndex || !n.shape.fill || n.shape.fill === 'none') continue;
    const b = boundsOf([n.shape], n.matrix);
    weight.set(n.shape.fill, (weight.get(n.shape.fill) ?? 0) + (b ? area(b) : 0));
  }
  let best: ColorToken | undefined;
  for (const [fill, w] of weight) if (best === undefined || w > weight.get(best)!) best = fill;
  return best;
}

/** The setting fill drawn last under a point: what a thing there stands against. */
function groundAt(resolved: ResolvedScene, x: number, y: number): ColorToken | undefined {
  let top: ColorToken | undefined;
  for (const n of resolved.nodes) {
    if (n.layerIndex !== -1 || !n.shape.fill || n.shape.fill === 'none') continue;
    const b = boundsOf([n.shape], n.matrix);
    if (b && x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY) top = n.shape.fill;
  }
  return top;
}

/** Whether an item draws an outline at `borderWidth.base` or thicker in `border.strong` or a darker token. */
function outlined(item: ItemDef): boolean {
  const limit = relativeLuminance(resolveColor('border.strong'));
  const walk = (shapes: ItemDef['nodes']): boolean =>
    shapes.some((s) =>
      s.t === 'group'
        ? walk(s.kids)
        : s.stroke !== undefined && isColorToken(s.stroke) && (s.sw === 'base' || s.sw === 'thick') && relativeLuminance(resolveColor(s.stroke)) <= limit,
    );
  return walk(item.nodes);
}

/** Every rule of the scene itself (with its reference round): items, layers, palette, tokens, Hoya, alt text, budget. */
export function checkHiddenHeritageScene(scene: HiddenHeritageScene, base: Registry = SCENE_ART_REGISTRY): Finding[] {
  const out: Finding[] = [];
  const err = (rule: string, message: string, layerIndex?: number): void => {
    out.push({ rule, severity: 'error', message: `${scene.id}: ${message}`, ...(layerIndex === undefined ? {} : { layerIndex }) });
  };
  for (const item of scene.items) {
    if (Object.prototype.hasOwnProperty.call(base, item.id)) err('H-item', `${item.id} is already in the shared registry; a scene adds items of its own`);
    for (const f of checkItem(item)) if (f.severity === 'error') out.push(f);
  }
  const registry = sceneRegistry(scene, base);
  const resolved = resolveScene(scene.art, registry);
  for (const issue of resolved.issues) err('H-resolve', `${issue.kind}: ${issue.ref}`, issue.layerIndex);

  const { width: W, height: H } = SCENE_CANVAS;
  const o = LIMITS.overhang;
  scene.art.layers.forEach((layer, i) => {
    const b = resolved.layers.find((l) => l.layerIndex === i)?.bounds;
    const anchorOut = layer.x < 0 || layer.x > W || layer.y < 0 || layer.y > H;
    if (anchorOut || (b && (b.minX < -o || b.minY < -o || b.maxX > W + o || b.maxY > H + o))) err('H-canvas', `layer ${i} (${layer.ref}) leaves the canvas`, i);
  });

  if (scene.art.layers.length > HIDDEN_HERITAGE_LIMITS.layers) err('H-layers', `${scene.art.layers.length} layers, at most ${HIDDEN_HERITAGE_LIMITS.layers}`);
  if (resolved.stats.shapes > HIDDEN_HERITAGE_LIMITS.shapes) err('H-shapes', `${resolved.stats.shapes} resolved shapes, at most ${HIDDEN_HERITAGE_LIMITS.shapes}`);
  const palette = cappedPalette(resolved);
  if (palette.length > HIDDEN_HERITAGE_LIMITS.colors) err('H-palette', `${palette.length} colour tokens, at most ${HIDDEN_HERITAGE_LIMITS.colors}`);
  if (resolved.stats.colors.filter((c) => c.startsWith('surface.') || c.startsWith('text.')).length < 2) err('H-palette', 'at least two surface or text tokens');
  for (const token of resolved.stats.colors) if (RESERVED_IN_SCENE(token)) err('H-tokens', `${token} is kept for the rings and the focus outline`);

  const hoyas = scene.art.layers.map((l, i) => [l, i] as const).filter(([l]) => l.ref.startsWith('hoya:'));
  if (hoyas.length > 1) err('H-hoya', `${hoyas.length} Hoya layers, at most one`);
  for (const [layer, i] of hoyas) {
    const s = layer.s ?? 1;
    if (!HOYA_POSES.some((p) => layer.ref === `hoya:${p}`) || s < HIDDEN_HERITAGE_LIMITS.hoyaScale.min || s > HIDDEN_HERITAGE_LIMITS.hoyaScale.max) {
      err('H-hoya', `Hoya at scale ${s}, ${HIDDEN_HERITAGE_LIMITS.hoyaScale.min}-${HIDDEN_HERITAGE_LIMITS.hoyaScale.max}`, i);
    }
    if (Object.values(scene.things).includes(i)) err('H-hoya', 'Hoya is never a thing to find', i);
  }

  const alt = scene.art.altEn.trim();
  if (alt.length === 0 || scene.art.altEn.length > LIMITS.altChars) err('H-alt', `altEn must be 1 to ${LIMITS.altChars} characters`);
  if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/.test(alt) || /^image of\b/i.test(alt)) err('H-alt', 'altEn holds no Hangul and never starts with "Image of"');
  if (scene.round.sceneId !== scene.id) err('H-round', `the reference round names ${scene.round.sceneId}`);

  const bytes = serializedBytes(scene);
  if (bytes > HIDDEN_HERITAGE_LIMITS.chunkBytes) err('H-budget', `${bytes} B, at most ${HIDDEN_HERITAGE_LIMITS.chunkBytes} B`);
  return [...out, ...checkHiddenHeritageRound(scene, scene.round, base)];
}

/**
 * The hit-area and target rules of one round on its scene (a lesson's round, or the scene's reference one): every
 * thing of the scene named once, the counts, H-1 to H-4, a target in each half, every target outlined, readable at
 * thumb size and not hidden by colour, and every ring visible on every spot (`rings`, the game's by default).
 */
export function checkHiddenHeritageRound(
  scene: HiddenHeritageScene,
  round: HiddenHeritageRoundLike,
  base: Registry = SCENE_ART_REGISTRY,
  rings: HiddenHeritageRings = HIDDEN_HERITAGE_RINGS,
): Finding[] {
  const out: Finding[] = [];
  const err = (rule: string, message: string): void => {
    out.push({ rule, severity: 'error', message: `${scene.id} ${round.id}: ${message}` });
  };
  const registry = sceneRegistry(scene, base);
  const resolved = resolveScene(scene.art, registry);
  const thumb = resolveScene(scene.art, registry, { variant: 'thumb' });
  const things = [...round.targets.map((t) => ({ ...t, target: true })), ...round.others.map((t) => ({ ...t, target: false }))];
  const L = HIDDEN_HERITAGE_LIMITS;

  if (round.sceneId !== scene.id) err('H-round', `the round names ${round.sceneId}, not this scene`);
  if (round.targets.length < L.targets.min || round.targets.length > L.targets.max) err('H-count', `${round.targets.length} targets, ${L.targets.min}-${L.targets.max}`);
  if (round.others.length < L.others.min || round.others.length > L.others.max || round.others.length < round.targets.length) {
    err('H-count', `${round.others.length} other things for ${round.targets.length} targets: ${L.others.min}-${L.others.max}, and never fewer than the targets`);
  }
  const named = new Set(things.map((t) => t.id));
  for (const id of Object.keys(scene.things)) if (!named.has(id)) err('H-named', `the scene's ${id} has no spot in the round`);
  if (named.size !== things.length) err('H-named', 'a thing is named twice');

  things.forEach((thing, i) => {
    const { spot } = thing;
    if (spot.w < L.spotMin || spot.h < L.spotMin) err('H-1', `${thing.id}'s spot is ${spot.w} x ${spot.h}, at least ${L.spotMin} x ${L.spotMin}`);
    if (spot.x < 0 || spot.y < 0 || spot.x + spot.w > SCENE_CANVAS.width || spot.y + spot.h > SCENE_CANVAS.height) err('H-4', `${thing.id}'s spot leaves the canvas`);
    for (const other of things.slice(i + 1)) {
      const gap = gapOf(spot, other.spot);
      if (gap < L.spotGap) err('H-2', `${thing.id} and ${other.id} are ${gap} units apart, at least ${L.spotGap}`);
    }
    const layerIndex = scene.things[thing.id];
    if (layerIndex === undefined) {
      err('H-named', `${thing.id} is not a thing of the scene`);
      return;
    }
    const layer = resolved.layers.find((l) => l.layerIndex === layerIndex);
    if (!layer?.bounds || !covers(spot, layer.bounds)) err('H-3', `${thing.id}'s spot does not cover its drawn item`);
    const fill = dominantFill(resolved, layerIndex);
    if (fill !== undefined) {
      for (const ring of ['found', 'miss', 'hint'] as const) {
        const colour = rings[ring];
        if (colour === undefined) continue;
        const casing = rings.casing === undefined ? 1 : contrastRatio(resolveColor(rings.casing), resolveColor(fill));
        if (Math.max(contrastRatio(resolveColor(colour), resolveColor(fill)), casing) < WCAG_AA_LARGE) err('H-rings', `the ${ring} ring does not read on ${thing.id} (${fill})`);
      }
    }
    if (!thing.target) return;
    const item = registry[layer?.ref ?? ''];
    if (item && !outlined(item)) err('H-outline', `target ${thing.id} has no base outline in border.strong or darker`);
    const thumbShapes = thumb.nodes.filter((n) => n.layerIndex === layerIndex).length;
    if (item && nodeCount(thumbVariant(item.nodes)) < L.thumbShapes) err('H-thumb', `target ${thing.id} keeps ${thumbShapes} shapes at thumb size, at least ${L.thumbShapes}`);
    const ground = groundAt(resolved, spot.x + spot.w / 2, spot.y + spot.h / 2);
    if (fill !== undefined && fill === ground) err('H-camouflage', `target ${thing.id} has the colour of what is behind it (${fill})`);
  });

  const centres = round.targets.map((t) => t.spot.x + t.spot.w / 2);
  if (!centres.some((c) => c < SCENE_CANVAS.width / 2) || !centres.some((c) => c > SCENE_CANVAS.width / 2)) err('H-focal', 'a target sits in each half of the scene');
  return out;
}
