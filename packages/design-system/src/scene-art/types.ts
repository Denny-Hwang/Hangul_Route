/**
 * SceneArt primitive set (F-STORY-002 §3.9.3). Renderer-neutral and pure: no
 * React, no react-native. A scene's picture is data; these are its parts.
 */
import type { colors } from '../tokens';

type Leaves<C> = { [G in keyof C & string]: `${G}.${keyof C[G] & string}` }[keyof C & string];

/** Colour tokens a picture may not use: scrims and the reserved destructive red. */
export type ReservedColorToken = 'surface.overlay' | 'surface.inkScrim' | 'feedback.danger';

/** Colour groups a picture may not use at all: WordArt's content tones (F-VOC-002 §3.4). */
export type ReservedColorGroup = 'vocab';

/** A path into `colors`, e.g. `'theme.rites'`, minus the reserved tokens and groups. */
export type ColorToken = Exclude<Leaves<typeof colors>, ReservedColorToken | `${ReservedColorGroup}.${string}`>;

/** WordArt's content tones as token paths (the group name, a dot, a tone name). */
export type VocabColorToken = `${ReservedColorGroup}.${keyof (typeof colors)[ReservedColorGroup] & string}`;

/**
 * [PX] R4 (AMENDMENTS-PICTURES-2026-11): a thing inside a hidden-heritage scene may draw in a real colour, so kimchi
 * is red. The renderer draws every `ArtColorToken`; who may author one is set by the item's type: shared registry
 * items are `ItemDef` (scene tokens only), hidden-heritage items `ItemDef<ArtColorToken>`, and `checkItem` refuses a
 * vocab tone unless the hidden-heritage profile asks for it.
 */
export type ArtColorToken = ColorToken | VocabColorToken;

/** Stroke width names; `borderWidth.thin/base/thick` = 1/2/3 canvas units. */
export type StrokeToken = 'thin' | 'base' | 'thick';

export const OPACITY_STEPS = [0.08, 0.15, 0.2, 0.35, 0.6, 0.85, 1] as const;
export type OpacityStep = (typeof OPACITY_STEPS)[number];

/** Canvas 400 x 300 (4:3), origin top-left. Mirrors content-schema `ART_CANVAS`. */
export const SCENE_CANVAS = { width: 400, height: 300 } as const;

export interface Paint<C extends string = ColorToken> {
  fill?: C | 'none';
  stroke?: C;
  sw?: StrokeToken;
  o?: OpacityStep;
  /**
   * Detail: skipped in the thumb variant. Named `det`, not the spec's `d`,
   * because `d` is the path data of a path shape and the two collide.
   */
  det?: true;
}

type Geometry<C extends string> =
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  /** Absolute M L H V C Q A Z only, at most 240 characters. */
  | { t: 'path'; d: string }
  /** Closed polygon, 3 to 16 points. */
  | { t: 'poly'; pts: Array<[number, number]> }
  | { t: 'group'; tx?: number; ty?: number; s?: number; rot?: number; flip?: true; kids: Shape<C>[] };

/** `C` widens the colours for hidden-heritage things only (`ArtColorToken`, [PX] R4); everything else keeps the default. */
export type Shape<C extends string = ColorToken> = Paint<C> & Geometry<C>;
export type LeafShape<C extends string = ColorToken> = Paint<C> & Exclude<Geometry<C>, { t: 'group' }>;
export type GroupShape<C extends string = ColorToken> = Paint<C> & Extract<Geometry<C>, { t: 'group' }>;

export type Band = 'back' | 'mid' | 'front';
export type ItemKind = 'figure' | 'object' | 'architecture' | 'nature' | 'furniture' | 'symbol' | 'setting';

export interface ItemDef<C extends string = ColorToken> {
  /** `'prop:fig-historian'`, `'scene:palace-hall'`, `'hoya:idle'`. */
  id: string;
  kind: ItemKind;
  /** Local coordinates; the anchor is (w / 2, h). */
  box: { w: number; h: number };
  z: Band;
  /** The one colour a layer's `tint` replaces. */
  tintable?: ColorToken;
  nodes: Shape<C>[];
  /** Contact-sheet label and default alt fragment. */
  alt: string;
  /** Required for heritage artefacts. */
  sourceRef?: { title: string; publisher: string; url: string; accessed: string };
  /** What is simplified, for the culture reviewer. */
  accuracyNote?: string;
  /** Settings only: the y where the ground begins. */
  horizonY?: number;
  /**
   * Flags the composition rules need (R-I heritage, R-S horizon). Additive to
   * the spec's ItemDef: the rules name them but the interface did not.
   */
  tags?: { heritage?: boolean; sky?: boolean };
}

/** Structural twin of content-schema `ArtLayer` (design-system does not depend on content-schema). */
export interface ArtLayerLike {
  ref: string;
  x: number;
  y: number;
  s?: number;
  flip?: boolean;
  z?: Band;
  tint?: string;
}

/** Structural twin of content-schema `SceneArt`. */
export interface SceneArtLike {
  setting: string;
  layers: ArtLayerLike[];
  altEn: string;
}
