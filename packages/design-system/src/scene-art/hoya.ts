/**
 * Hoya as scene-art data (F-STORY-002 §3.9.4): a port of the geometry in
 * `components/Hoya/Hoya.tsx` onto the same 128-unit box, so a scene can place
 * him as a `hoya:<pose>` layer and both renderers can draw him. The component
 * is not changed (it animates and is used everywhere); `hoya-parity.test.ts`
 * keeps the two honest.
 *
 * Differences forced by the primitive set, none visible at scene sizes:
 *   - strokes are 1 / 2 / 3 units, so the 10-unit limbs are filled outlines;
 *   - numbers are multiples of 0.5, so the eye glints and cheering slits are
 *     rounded to the nearest half unit;
 *   - the waving hand sits one unit in so every shape stays inside the box;
 *   - shadow tones use the nearest allowed opacity (0.18 -> 0.2).
 *
 * Contract kept from Hoya.tsx (anti-shame, F-002 section 3): `thinking` looks
 * up and to the right; cheeks only in idle, cheering and waving; no sharp
 * teeth, no angry eyes, no black.
 */
import type { HoyaPose } from '../components/Hoya/types';
import type { ItemDef, Shape } from './types';

export type { HoyaPose };

export const HOYA_POSES = ['idle', 'cheering', 'thinking', 'reading', 'waving'] as const satisfies readonly HoyaPose[];
export const HOYA_BOX = { w: 128, h: 128 } as const;

interface Eye {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Left eye centre and radii; the right eye sits 28 units to the right (Hoya.tsx `eyeFor`). */
function eyeFor(pose: HoyaPose): Eye {
  switch (pose) {
    case 'cheering':
      return { cx: 50, cy: 70, rx: 4, ry: 1.5 }; // squinted joy
    case 'thinking':
      return { cx: 51, cy: 68, rx: 3, ry: 4.5 }; // up and to the right
    case 'reading':
      return { cx: 50, cy: 76, rx: 3, ry: 3.5 }; // down at the book
    default:
      return { cx: 50, cy: 72, rx: 3.5, ry: 4 };
  }
}

function mouthFor(pose: HoyaPose): Shape {
  switch (pose) {
    case 'cheering':
      return { t: 'path', d: 'M44 92 Q60 110 76 92 Q60 100 44 92 Z', fill: 'hoya.cheek', stroke: 'hoya.stripes', sw: 'thick' };
    case 'thinking':
      return { t: 'path', d: 'M53 96 Q60 92 67 96', stroke: 'hoya.stripes', sw: 'thick' };
    case 'reading':
      return { t: 'line', x1: 56, y1: 95, x2: 64, y2: 95, stroke: 'hoya.stripes', sw: 'thick' };
    case 'waving':
      return { t: 'path', d: 'M48 92 Q60 104 72 92', stroke: 'hoya.stripes', sw: 'thick' };
    default:
      return { t: 'path', d: 'M50 92 Q60 100 70 92', stroke: 'hoya.stripes', sw: 'thick' };
  }
}

/** A raised arm and its paw, drawn as a filled outline of a 10-unit round-capped limb. */
function raisedArm(): Shape[] {
  return [
    { t: 'path', d: 'M26.5 76 Q18.5 58 12.5 44 L3.5 48 Q9.5 62 17.5 80 A5 5 0 0 0 26.5 76 Z', fill: 'hoya.fur' },
    { t: 'circle', cx: 8, cy: 46, r: 7, fill: 'hoya.fur' },
  ];
}

function armsFor(pose: HoyaPose): Shape[] {
  if (pose === 'cheering') {
    // Both arms up and out: the left one, and its mirror about x = 64.
    return [...raisedArm(), { t: 'group', tx: 128, flip: true, kids: raisedArm() }];
  }
  if (pose === 'waving') {
    return [
      { t: 'path', d: 'M107.5 79.5 Q120 67 126 56 L117.5 51.5 Q112 61 100.5 72.5 A5 5 0 0 0 107.5 79.5 Z', fill: 'hoya.fur' },
      { t: 'circle', cx: 121.5, cy: 54, r: 6.5, fill: 'hoya.fur' },
    ];
  }
  if (pose === 'reading') {
    return [
      { t: 'circle', cx: 42, cy: 102, r: 6, fill: 'hoya.fur' },
      { t: 'circle', cx: 86, cy: 102, r: 6, fill: 'hoya.fur' },
    ];
  }
  return [];
}

function accentFor(pose: HoyaPose): Shape[] {
  if (pose === 'thinking') {
    return [
      { t: 'circle', cx: 100, cy: 26, r: 2.5, fill: 'surface.paper', stroke: 'brand.secondary', sw: 'thin' },
      { t: 'circle', cx: 106, cy: 18, r: 3.5, fill: 'surface.paper', stroke: 'brand.secondary', sw: 'thin' },
      { t: 'rect', x: 108, y: 2, w: 18, h: 12, r: 6, fill: 'surface.paper', stroke: 'brand.secondary', sw: 'base' },
    ];
  }
  if (pose === 'cheering') {
    // Two four-point sparkles, each a tall and a wide diamond.
    return [20, 108].flatMap((cx): Shape[] => [
      { t: 'poly', pts: [[cx, 16], [cx + 2, 22], [cx, 28], [cx - 2, 22]], fill: 'feedback.nudge', o: 0.85 },
      { t: 'poly', pts: [[cx - 6, 22], [cx, 20], [cx + 6, 22], [cx, 24]], fill: 'feedback.nudge', o: 0.85 },
    ]);
  }
  if (pose === 'reading') {
    return [
      { t: 'rect', x: 36, y: 98, w: 56, h: 20, r: 3, fill: 'hoya.furDark', o: 0.2 },
      { t: 'rect', x: 36, y: 94, w: 56, h: 22, r: 3, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
      { t: 'line', x1: 64, y1: 94, x2: 64, y2: 116, stroke: 'text.secondary', sw: 'thin', det: true },
      // Calligraphy strokes on the left and right pages: stroke rows, never glyphs.
      { t: 'path', d: 'M44 102 Q48 100 52 104 M46 110 H54 M72 102 Q76 100 80 104 M74 110 H82', stroke: 'text.primary', sw: 'base', det: true },
    ];
  }
  return [];
}

const showsCheeks = (pose: HoyaPose): boolean => pose === 'idle' || pose === 'cheering' || pose === 'waving';

/**
 * The shapes of one pose, in draw order, on the 128 x 128 box with the default
 * gold fur. An unknown pose reads as idle, like the component.
 */
export function hoyaNodes(poseIn: HoyaPose): Shape[] {
  const pose: HoyaPose = HOYA_POSES.includes(poseIn) ? poseIn : 'idle';
  const eye = eyeFor(pose);
  const eyes: Shape[] = [0, 28].map((dx) => ({ t: 'ellipse', cx: eye.cx + dx, cy: eye.cy, rx: eye.rx, ry: eye.ry, fill: 'hoya.stripes' }));
  const glints: Shape[] = pose === 'cheering' ? [] : [0, 28].map((dx) => ({ t: 'circle', cx: eye.cx + dx + 1, cy: eye.cy - 1.5, r: 1, fill: 'surface.paper', det: true }));
  const cheeks: Shape[] = showsCheeks(pose)
    ? [42, 86].map((cx) => ({ t: 'circle', cx, cy: 84, r: 5, fill: 'hoya.cheek', o: 0.6, det: true }))
    : [];
  return [
    { t: 'ellipse', cx: 64, cy: 116, rx: 38, ry: 5, fill: 'hoya.furDark', o: 0.2 },
    ...armsFor(pose),
    { t: 'circle', cx: 64, cy: 64, r: 44, fill: 'hoya.fur' },
    { t: 'circle', cx: 30, cy: 32, r: 12, fill: 'hoya.fur' },
    { t: 'circle', cx: 98, cy: 32, r: 12, fill: 'hoya.fur' },
    { t: 'circle', cx: 30, cy: 32, r: 6, fill: 'hoya.cheek', o: 0.85, det: true },
    { t: 'circle', cx: 98, cy: 32, r: 6, fill: 'hoya.cheek', o: 0.85, det: true },
    // Three tapered stripes each side of the head and one on the forehead.
    {
      t: 'path',
      d: 'M26 54 Q30 58 26 62 M24 70 Q29 73 25 78 M28 84 Q33 86 30 90 M102 54 Q98 58 102 62 M104 70 Q99 73 103 78 M100 84 Q95 86 98 90 M64 24 Q66 30 64 36',
      stroke: 'hoya.stripes',
      sw: 'thick',
    },
    { t: 'ellipse', cx: 64, cy: 84, rx: 26, ry: 16, fill: 'hoya.belly' },
    ...eyes,
    ...glints,
    ...cheeks,
    { t: 'path', d: 'M58 84 H70 L64 90 Z', fill: 'hoya.nose' },
    mouthFor(pose),
    ...accentFor(pose),
  ];
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
