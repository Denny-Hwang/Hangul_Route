/**
 * Hoya as data (F-STORY-002 §3.9.4, PR 2.11): the one drawing of the mascot.
 * `hoyaFigure(pose)` is his geometry at the shipped component's fidelity, and
 * `components/Hoya/Hoya.tsx` renders exactly that, element for element.
 * `hoyaNodes(pose)` is the same figure in the scene-art primitive set, so a
 * scene can place him as a `hoya:<pose>` layer and both scene renderers can
 * draw him.
 *
 * What the scene form changes, none of it visible at scene sizes:
 *   - stroke widths snap to 1 / 2 / 3 units and opacities to the allowed
 *     steps (0.18 -> 0.2);
 *   - circle, ellipse, rect and line numbers snap to half units, so the eye
 *     glints and the cheering slits move by a fraction of a unit;
 *   - a few parts carry a hand-made scene stand-in (`scene`): the 10-unit
 *     limbs become filled outlines (the waving hand one unit in, so every
 *     shape stays inside the box), the stripes and the book's strokes become
 *     one path each (the first stroke of the book carries the whole row), and
 *     the sparkles become polygons.
 *
 * Contract (anti-shame, F-002 section 3): `thinking` looks up and to the
 * right; cheeks only in idle, cheering and waving; no sharp teeth, no angry
 * eyes, no black.
 */
import type { HoyaPose } from '../components/Hoya/types';
import { OPACITY_STEPS, type ColorToken, type ItemDef, type OpacityStep, type Shape, type StrokeToken } from './types';

export type { HoyaPose };

export const HOYA_POSES = ['idle', 'cheering', 'thinking', 'reading', 'waving'] as const satisfies readonly HoyaPose[];
export const HOYA_BOX = { w: 128, h: 128 } as const;

/**
 * Paint at the component's fidelity. `hoya.fur` and `hoya.furDark` are the
 * gold cub's; the component swaps them for the learner's variant.
 */
export interface HoyaPaint {
  fill?: ColorToken | 'none';
  stroke?: ColorToken;
  strokeWidth?: number;
  strokeLinecap?: 'round';
  strokeLinejoin?: 'round';
  opacity?: number;
  /** Detail: skipped by the scene thumb variant. Inherited by a group's parts. */
  det?: true;
}

type HoyaGeometry =
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'path'; d: string }
  /** No transform: a group only shares paint (and, for opacity, composites as one). */
  | { t: 'group'; kids: HoyaPart[] };

/** One part of the figure. `scene`, when present, is what the scene form draws instead. */
export type HoyaPart = HoyaPaint & HoyaGeometry & { scene?: Shape[] };

interface Eye {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Left eye centre and radii; the right eye sits 28 units to the right. */
function eyeFor(pose: HoyaPose): Eye {
  switch (pose) {
    case 'cheering':
      return { cx: 50, cy: 70, rx: 4, ry: 1.6 }; // squinted joy: narrow slits
    case 'thinking':
      return { cx: 51, cy: 68, rx: 3, ry: 4.5 }; // up and to the right, never down
    case 'reading':
      return { cx: 50, cy: 76, rx: 3, ry: 3.5 }; // down at the book
    default:
      return { cx: 50, cy: 72, rx: 3.5, ry: 4 };
  }
}

const SOFT = { stroke: 'hoya.stripes', strokeWidth: 3, strokeLinecap: 'round' } as const;

function mouthFor(pose: HoyaPose): HoyaPart {
  switch (pose) {
    case 'cheering':
      // A wider open smile filled with cheek pink.
      return { t: 'path', d: 'M44 92 Q60 110 76 92 Q60 100 44 92 Z', fill: 'hoya.cheek', ...SOFT, strokeLinejoin: 'round' };
    case 'thinking':
      // A small neutral curve: not sad, not smiling, just thinking.
      return { t: 'path', d: 'M53 96 Q60 92 67 96', ...SOFT, fill: 'none' };
    case 'reading':
      // A tiny flat line: concentrating.
      return { t: 'line', x1: 56, y1: 95, x2: 64, y2: 95, ...SOFT };
    case 'waving':
      return { t: 'path', d: 'M48 92 Q60 104 72 92', ...SOFT, fill: 'none' };
    default:
      return { t: 'path', d: 'M50 92 Q60 100 70 92', ...SOFT, fill: 'none' };
  }
}

/** A 10-unit round-capped limb. */
const limb = (d: string): HoyaPart => ({ t: 'path', d, stroke: 'hoya.fur', strokeWidth: 10, strokeLinecap: 'round', fill: 'none' });
const paw = (cx: number, cy: number, r: number): HoyaPart => ({ t: 'circle', cx, cy, r, fill: 'hoya.fur' });

/** The scene's raised left arm and paw: the limb as a filled outline. */
function raisedArmScene(): Shape[] {
  return [
    { t: 'path', d: 'M26.5 76 Q18.5 58 12.5 44 L3.5 48 Q9.5 62 17.5 80 A5 5 0 0 0 26.5 76 Z', fill: 'hoya.fur' },
    { t: 'circle', cx: 8, cy: 46, r: 7, fill: 'hoya.fur' },
  ];
}

function armsFor(pose: HoyaPose): HoyaPart[] {
  if (pose === 'cheering') {
    // Both arms raised up and out. The scene draws the left one and its mirror about x = 64.
    const scene: Shape[] = [...raisedArmScene(), { t: 'group', tx: 128, flip: true, kids: raisedArmScene() }];
    return [{ t: 'group', kids: [limb('M22 78 Q14 60 8 46'), limb('M106 78 Q114 60 120 46'), paw(8, 46, 7), paw(120, 46, 7)], scene }];
  }
  if (pose === 'waving') {
    // The right arm raised in a wave.
    const scene: Shape[] = [
      { t: 'path', d: 'M107.5 79.5 Q120 67 126 56 L117.5 51.5 Q112 61 100.5 72.5 A5 5 0 0 0 107.5 79.5 Z', fill: 'hoya.fur' },
      { t: 'circle', cx: 121.5, cy: 54, r: 6.5, fill: 'hoya.fur' },
    ];
    return [{ t: 'group', kids: [limb('M104 76 Q116 64 122 54'), paw(122, 54, 7)], scene }];
  }
  if (pose === 'reading') {
    // Two small front paws holding the book.
    return [{ t: 'group', kids: [paw(42, 102, 6), paw(86, 102, 6)] }];
  }
  return [];
}

/** Three tapered stripes each side of the head and one on the forehead, following its curve. */
const STRIPES = [
  'M26 54 Q30 58 26 62',
  'M24 70 Q29 73 25 78',
  'M28 84 Q33 86 30 90',
  'M102 54 Q98 58 102 62',
  'M104 70 Q99 73 103 78',
  'M100 84 Q95 86 98 90',
  'M64 24 Q66 30 64 36',
];

function stripes(): HoyaPart {
  return {
    t: 'group',
    ...SOFT,
    fill: 'none',
    kids: STRIPES.map((d): HoyaPart => ({ t: 'path', d })),
    scene: [{ t: 'path', d: STRIPES.join(' '), stroke: 'hoya.stripes', sw: 'thick' }],
  };
}

/** A four-point pinwheel sparkle: a tall and a wide diamond, composited as one. */
function sparkle(cx: number, cy: number): HoyaPart {
  const tall: Array<[number, number]> = [[cx, cy - 6], [cx + 2, cy], [cx, cy + 6], [cx - 2, cy]];
  const wide: Array<[number, number]> = [[cx - 6, cy], [cx, cy - 2], [cx + 6, cy], [cx, cy + 2]];
  const d = (pts: Array<[number, number]>): string => `${pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')} Z`;
  return {
    t: 'group',
    fill: 'feedback.nudge',
    opacity: 0.85,
    kids: [
      { t: 'path', d: d(tall) },
      { t: 'path', d: d(wide) },
    ],
    scene: [
      { t: 'poly', pts: tall, fill: 'feedback.nudge', o: 0.85 },
      { t: 'poly', pts: wide, fill: 'feedback.nudge', o: 0.85 },
    ],
  };
}

/** Calligraphy strokes on the left and right pages of the book: stroke rows, never glyphs. */
const CALLIGRAPHY = [
  { d: 'M44 102 Q48 100 52 104', curve: true },
  { d: 'M46 110 H54', curve: false },
  { d: 'M72 102 Q76 100 80 104', curve: true },
  { d: 'M74 110 H82', curve: false },
];

function accentFor(pose: HoyaPose): HoyaPart[] {
  if (pose === 'thinking') {
    // Two bubble dots leading from the upper right of the head to the cloud.
    const cloud = { fill: 'surface.paper', stroke: 'brand.secondary' } as const;
    return [
      {
        t: 'group',
        kids: [
          { t: 'circle', cx: 100, cy: 26, r: 2.5, ...cloud, strokeWidth: 1.2 },
          { t: 'circle', cx: 106, cy: 18, r: 3.5, ...cloud, strokeWidth: 1.2 },
          { t: 'rect', x: 108, y: 2, w: 18, h: 12, r: 6, ...cloud, strokeWidth: 1.5 },
        ],
      },
    ];
  }
  if (pose === 'cheering') {
    return [{ t: 'group', kids: [sparkle(20, 22), sparkle(108, 22)] }];
  }
  if (pose === 'reading') {
    // A paper book with a spine crease and two strokes on each page.
    return [
      {
        t: 'group',
        kids: [
          { t: 'rect', x: 36, y: 98, w: 56, h: 20, r: 3, fill: 'hoya.furDark', opacity: 0.2 },
          { t: 'rect', x: 36, y: 94, w: 56, h: 22, r: 3, fill: 'surface.paper', stroke: 'text.secondary', strokeWidth: 1.5 },
          { t: 'line', x1: 64, y1: 94, x2: 64, y2: 116, stroke: 'text.secondary', strokeWidth: 1, det: true },
          // The scene draws the four strokes as one path, carried by the first.
          ...CALLIGRAPHY.map(({ d, curve }, i): HoyaPart => ({
            t: 'path',
            d,
            stroke: 'text.primary',
            strokeWidth: 2,
            strokeLinecap: 'round',
            ...(curve ? { fill: 'none' } : {}),
            scene: i === 0 ? [{ t: 'path', d: CALLIGRAPHY.map((c) => c.d).join(' '), stroke: 'text.primary', sw: 'base', det: true }] : [],
          })),
        ],
      },
    ];
  }
  return [];
}

const showsCheeks = (pose: HoyaPose): boolean => pose === 'idle' || pose === 'cheering' || pose === 'waving';

/** A known pose, or idle for anything else (persisted junk, a typo). */
export const hoyaPoseOf = (pose: unknown): HoyaPose => (HOYA_POSES.includes(pose as HoyaPose) ? (pose as HoyaPose) : 'idle');

/**
 * Hoya at the shipped component's fidelity: the parts of one pose in draw
 * order on the 128 x 128 box, with the gold cub's fur. An unknown pose reads
 * as idle.
 */
export function hoyaFigure(poseIn: HoyaPose): HoyaPart[] {
  const pose = hoyaPoseOf(poseIn);
  const eye = eyeFor(pose);
  const parts: HoyaPart[] = [
    // A soft shadow under the feet.
    { t: 'ellipse', cx: 64, cy: 116, rx: 38, ry: 5, fill: 'hoya.furDark', opacity: 0.18 },
    ...armsFor(pose),
    // Head, round ears and their pink insides.
    { t: 'circle', cx: 64, cy: 64, r: 44, fill: 'hoya.fur' },
    { t: 'circle', cx: 30, cy: 32, r: 12, fill: 'hoya.fur' },
    { t: 'circle', cx: 98, cy: 32, r: 12, fill: 'hoya.fur' },
    { t: 'circle', cx: 30, cy: 32, r: 6, fill: 'hoya.cheek', opacity: 0.85, det: true },
    { t: 'circle', cx: 98, cy: 32, r: 6, fill: 'hoya.cheek', opacity: 0.85, det: true },
    stripes(),
    // The cream belly.
    { t: 'ellipse', cx: 64, cy: 84, rx: 26, ry: 16, fill: 'hoya.belly' },
    { t: 'ellipse', cx: eye.cx, cy: eye.cy, rx: eye.rx, ry: eye.ry, fill: 'hoya.stripes' },
    { t: 'ellipse', cx: eye.cx + 28, cy: eye.cy, rx: eye.rx, ry: eye.ry, fill: 'hoya.stripes' },
  ];
  if (pose !== 'cheering') {
    // Tiny glints, only while the eyes are open.
    const glint = (cx: number): HoyaPart => ({ t: 'circle', cx: cx + 1.2, cy: eye.cy - 1.3, r: 0.9 });
    parts.push({ t: 'group', fill: 'surface.paper', det: true, kids: [glint(eye.cx), glint(eye.cx + 28)] });
  }
  if (showsCheeks(pose)) {
    parts.push({
      t: 'group',
      det: true,
      kids: [42, 86].map((cx): HoyaPart => ({ t: 'circle', cx, cy: 84, r: 5, fill: 'hoya.cheek', opacity: 0.6 })),
    });
  }
  parts.push({ t: 'path', d: 'M58 84 H70 L64 90 Z', fill: 'hoya.nose' }, mouthFor(pose), ...accentFor(pose));
  return parts;
}

const half = (v: number): number => Math.round(v * 2) / 2;

const STROKE_STEPS: ReadonlyArray<[StrokeToken, number]> = [
  ['thin', 1],
  ['base', 2],
  ['thick', 3],
];

/** The nearest stroke token; a tie goes to the wider one. */
function strokeToken(width: number): StrokeToken {
  let best = STROKE_STEPS[0]!;
  for (const step of STROKE_STEPS) if (Math.abs(step[1] - width) <= Math.abs(best[1] - width)) best = step;
  return best[0];
}

function opacityStep(o: number): OpacityStep {
  return OPACITY_STEPS.reduce((best, step) => (Math.abs(step - o) < Math.abs(best - o) ? step : best));
}

/** One part in the scene primitive set: paint inherited from its groups, numbers snapped to the steps. */
function toScene(part: HoyaPart, inherited: HoyaPaint): Shape[] {
  if (part.scene) return part.scene;
  const { fill, stroke, strokeWidth, opacity, det } = { ...inherited, ...withoutUndefined(part) };
  if (part.t === 'group') return part.kids.flatMap((kid) => toScene(kid, { fill, stroke, strokeWidth, opacity, det }));
  const paint = {
    ...(fill !== undefined && fill !== 'none' ? { fill } : {}),
    ...(stroke !== undefined ? { stroke, sw: strokeToken(strokeWidth ?? 2) } : {}),
    ...(opacity !== undefined ? { o: opacityStep(opacity) } : {}),
    ...(det ? { det } : {}),
  };
  switch (part.t) {
    case 'rect':
      return [{ t: 'rect', x: half(part.x), y: half(part.y), w: half(part.w), h: half(part.h), ...(part.r === undefined ? {} : { r: half(part.r) }), ...paint }];
    case 'circle':
      return [{ t: 'circle', cx: half(part.cx), cy: half(part.cy), r: half(part.r), ...paint }];
    case 'ellipse':
      return [{ t: 'ellipse', cx: half(part.cx), cy: half(part.cy), rx: half(part.rx), ry: half(part.ry), ...paint }];
    case 'line':
      return [{ t: 'line', x1: half(part.x1), y1: half(part.y1), x2: half(part.x2), y2: half(part.y2), ...paint }];
    case 'path':
      return [{ t: 'path', d: part.d, ...paint }];
  }
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * The shapes of one pose, in draw order, on the 128 x 128 box with the default
 * gold fur: `hoyaFigure` in the scene primitive set. An unknown pose reads as
 * idle, like the component.
 */
export function hoyaNodes(pose: HoyaPose): Shape[] {
  return hoyaSceneShapes(hoyaFigure(pose));
}

/** Figure parts in the scene primitive set (exported for its tests). */
export function hoyaSceneShapes(parts: readonly HoyaPart[]): Shape[] {
  return parts.flatMap((part) => toScene(part, {}));
}

const POSE_ALT: Record<HoyaPose, string> = {
  idle: 'Hoya the tiger, standing',
  cheering: 'Hoya the tiger, cheering',
  thinking: 'Hoya the tiger, thinking',
  reading: 'Hoya the tiger, reading a book',
  waving: 'Hoya the tiger, waving',
};

/** One pose as a registry item (`hoya:<pose>`); a layer's `tint` replaces the fur. */
export function hoyaItem(pose: HoyaPose): ItemDef {
  return {
    id: `hoya:${pose}`,
    kind: 'figure',
    box: { w: HOYA_BOX.w, h: HOYA_BOX.h },
    z: 'mid',
    tintable: 'hoya.fur',
    nodes: hoyaNodes(pose),
    alt: POSE_ALT[pose],
  };
}
