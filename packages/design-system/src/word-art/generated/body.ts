/**
 * Body parts (F-VOC-002 §3.6.3): `word:body-*`. A friendly neutral figure (a
 * paper face and limbs, a `hoya.fur` shirt, smiling; not the Hoya component)
 * with a highlight ring on the part. Eye, nose, mouth, ear and face zoom on
 * the head; head, hand, arm, leg, foot and belly show the whole figure. The
 * tooth is drawn on its own, a molar with its two roots (W-4 review: on the
 * zoomed head a ring tight on the teeth hid the smile and read as a pacifier).
 * The anchors are data (`BODY_ANCHORS`), worked out from the same geometry the
 * figure is drawn from, so a ring always sits on its part.
 */
import { circle, face, groundShadow, path } from '../builders';
import type { WordArtShape } from '../types';
import { FIGURE_HAND, figure } from './figure';
import { HALO_TONE, HALO_WIDTH } from './halo';

export const BODY_PARTS = Object.freeze(['eye', 'nose', 'mouth', 'ear', 'head', 'face', 'hand', 'arm', 'leg', 'foot', 'belly', 'tooth'] as const);
export type BodyPart = (typeof BODY_PARTS)[number];
/** The parts shown with a highlight ring: all but the tooth, which is drawn on its own. */
export type RingedBodyPart = Exclude<BodyPart, 'tooth'>;
export const RINGED_BODY_PARTS: readonly RingedBodyPart[] = Object.freeze(BODY_PARTS.filter((p): p is RingedBodyPart => p !== 'tooth'));

export interface BodyAnchor {
  /** `head`: the zoomed head; `body`: the whole figure. */
  view: 'head' | 'body';
  x: number;
  y: number;
  /** Ring radius. */
  r: number;
}

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;
const PAPER = { f: 'surface.paper', ...INK } as const;

/** The whole figure: 66 units tall, feet on y 84 (the subject is centred with its rings). */
const FIG = { height: 66, x: 50, ground: 84 } as const;
const S = FIG.height / 100;
/** A point of the canonical figure (feet at the origin, head top at -100) in the viewBox. */
const at = (cx: number, cy: number): { x: number; y: number } => ({ x: Math.round((FIG.x + cx * S) * 10) / 10, y: Math.round((FIG.ground + cy * S) * 10) / 10 });

/** The zoomed head: centre and radius. */
const HEAD = { x: 50, y: 53, r: 29 } as const;
/** The ears: a paper circle on each side of the zoomed head. */
const EAR = { dx: HEAD.r - 0.5, y: HEAD.y + 2, r: 7 } as const;
const EYE_Y = 50;
const EYE_SCALE = 1.4;
const MOUTH = { x: 50, y: 64.5, r: 10.5 } as const;

/** The eyes of `face()`: its ink-filled circles, picked by paint, not by position in the list. */
const isEye = (s: WordArtShape): s is Extract<WordArtShape, { t: 'circle' }> => s.t === 'circle' && s.f === 'text.primary';
const EYES = face(HEAD.x, EYE_Y, EYE_SCALE).filter(isEye);
/** The eye on the viewer's left (the ring sits on it). */
const LEFT_EYE = EYES.reduce((a, b) => (b.x < a.x ? b : a));

export const BODY_ANCHORS: Readonly<Record<RingedBodyPart, BodyAnchor>> = Object.freeze({
  eye: { view: 'head', x: LEFT_EYE.x, y: LEFT_EYE.y, r: 8.5 },
  nose: { view: 'head', x: 50, y: 57, r: 6.5 },
  mouth: { view: 'head', x: 50, y: 68.5, r: 12.5 },
  ear: { view: 'head', x: HEAD.x - EAR.dx, y: EAR.y, r: 9 },
  face: { view: 'head', x: 50, y: 59, r: 21 },
  head: { view: 'body', ...at(0, -82), r: 15 },
  hand: { view: 'body', ...at(-FIGURE_HAND.dx, FIGURE_HAND.y), r: 7 },
  arm: { view: 'body', ...at(-25, -50), r: 8 },
  leg: { view: 'body', ...at(8, -18), r: 9 },
  foot: { view: 'body', ...at(9, -3.5), r: 7 },
  belly: { view: 'body', ...at(0, -42), r: 9 },
} satisfies Record<RingedBodyPart, BodyAnchor>);

const RING_WIDTH = 3;

/**
 * A highlight ring: a 3-unit `brand.secondary` circle on a paper halo. The
 * halo is pushed outwards so its inner edge meets the ring's: the part inside
 * the ring stays visible, and paper shows only outside it.
 */
export function ring(cx: number, cy: number, r: number): WordArtShape[] {
  return [circle(cx, cy, r + (HALO_WIDTH - RING_WIDTH) / 2, { s: HALO_TONE, sw: HALO_WIDTH }), circle(cx, cy, r, { s: 'brand.secondary', sw: RING_WIDTH })];
}

/** The zoomed head: ears, a short hair cap, eyes, cheeks, a nose, an open smile with the upper teeth. */
function zoomedHead(): WordArtShape[] {
  const { x, y, r } = HEAD;
  const m = MOUTH;
  return [
    circle(x - EAR.dx, EAR.y, EAR.r, PAPER),
    circle(x + EAR.dx, EAR.y, EAR.r, PAPER),
    circle(x, y, r, PAPER),
    path(`M ${x - r - 1.5} ${y} A ${r + 1.5} ${r + 1.5} 0 0 1 ${x + r + 1.5} ${y} Q ${x + 16} ${y - 13} ${x} ${y - 11} Q ${x - 16} ${y - 13} ${x - r - 1.5} ${y} Z`, { f: 'text.secondary', ...INK }),
    // the eyes of face(); the smile is drawn open below
    ...EYES.map((eye) => ({ ...eye })),
    circle(x - 19, 60, 4, { f: 'hoya.cheek' }),
    circle(x + 19, 60, 4, { f: 'hoya.cheek' }),
    path('M 50.5 52 Q 46.5 58.5 51.5 59.5', DETAIL),
    // an open smile: from the right corner to the left through the bottom, closed along the top
    path(`M ${m.x + m.r} ${m.y} A ${m.r} ${m.r} 0 0 1 ${m.x - m.r} ${m.y} Z`, { f: 'hoya.cheek', ...DETAIL }),
    // the two upper front teeth
    path(`M ${m.x - 7} ${m.y} H ${m.x + 7} V ${m.y + 4} Q ${m.x} ${m.y + 6.5} ${m.x - 7} ${m.y + 4} Z M ${m.x} ${m.y} V ${m.y + 5.2}`, { f: 'surface.paper', ...DETAIL }),
  ];
}

/**
 * The tooth on its own: a paper molar (a crown with two roots) with the ink
 * outline, a shine line on the crown, and a ground shadow. No face, so it
 * stays a plain object (D1).
 */
function tooth(): WordArtShape[] {
  return [
    groundShadow(50, 88, 20),
    path('M 50 24 C 44 18 28 16 24 30 C 21 42 28 50 30 60 C 32 72 34 84 40 84 C 46 84 45 70 50 66 C 55 70 54 84 60 84 C 66 84 68 72 70 60 C 72 50 79 42 76 30 C 72 16 56 18 50 24 Z', PAPER),
    path('M 33 32 Q 35 26 41 26', DETAIL),
  ];
}

/** The body-part glyph: the head or the whole figure, then the ring on the part; the tooth on its own. */
export function bodyPart(part: BodyPart): WordArtShape[] {
  if (part === 'tooth') return tooth();
  const anchor = BODY_ANCHORS[part];
  const base = anchor.view === 'head' ? zoomedHead() : figure({ ...FIG, hair: 'short', clothes: 'hoya.fur' });
  return [...base, ...ring(anchor.x, anchor.y, anchor.r)];
}

/** Every body-part glyph by key (`body-<part>`). */
export function bodyGlyphs(): Record<string, WordArtShape[]> {
  return Object.fromEntries(BODY_PARTS.map((part) => [`body-${part}`, bodyPart(part)]));
}
