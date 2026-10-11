/**
 * People (F-VOC-002 §3.6.4, C12): a neutral standing figure for the Family
 * words. Geometric and friendly: a paper face with an ink outline (never a
 * skin-tone fill), hair and clothes carry the cues, and the face always
 * smiles (`face()`). Drawn once on a 100-unit canonical figure (feet at the
 * origin, the top of the head at -100) and placed with `placeGlyph`, so every
 * height shares one drawing and the outline stays 3 units at any size.
 *
 * Two legs, two shoes, both sleeves or both hands are one path each (two
 * sub-paths), so four figures fit the 32-shape limit of a hand glyph (C7).
 */
import { circle, face, path, poly } from '../builders';
import { formatNumber as n } from '../path';
import { placeGlyph } from '../place';
import type { WordArtShape, WordArtTone } from '../types';

export type FigureHair = 'long' | 'short' | 'bun' | 'none' | 'grey';
export type FigureAccessory = 'glasses' | 'cane' | 'blanket';

export interface FigureOptions {
  /** Ground to the top of the head, in viewBox units (20..80). */
  height: number;
  hair: FigureHair;
  /** The shirt (or the blanket) tone. */
  clothes: WordArtTone;
  accessory?: FigureAccessory;
  /** Centre x; default 50. */
  x?: number;
  /** The ground line (bottom of the shoes); default 88. */
  ground?: number;
  /** Hair tone for `long`, `short` and `bun`; default `text.secondary`. `grey` is always `vocab.gray`. */
  hairTone?: WordArtTone;
  /** No hands and no shoes: for glyphs of three or four figures. */
  compact?: boolean;
}

export const FIGURE_MIN_HEIGHT = 20;
export const FIGURE_MAX_HEIGHT = 80;

const INK = { s: 'text.primary', sw: 3 } as const;
const DETAIL = { s: 'text.primary', sw: 2 } as const;
const PAPER = { f: 'surface.paper', ...INK } as const;

/** Canonical geometry (feet at 0, head top at -100). */
const HEAD = { x: 0, y: -82, r: 18 } as const;
const EYE_Y = -80;
const FACE_SCALE = 0.85;
/** Highest point of each hairstyle on the canonical figure. */
const HAIR_TOP: Readonly<Record<FigureHair, number>> = { none: -100, short: -102, grey: -102, long: -102, bun: -111 };
/** The blanket's hood, behind the head. */
const HOOD = { x: 0, y: -80, r: 26 } as const;

const circleD = (cx: number, cy: number, r: number): string => `M ${n(cx - r)} ${n(cy)} A ${n(r)} ${n(r)} 0 1 0 ${n(cx + r)} ${n(cy)} A ${n(r)} ${n(r)} 0 1 0 ${n(cx - r)} ${n(cy)} Z`;
const ellipseD = (cx: number, cy: number, rx: number, ry: number): string => `M ${n(cx - rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)} Z`;
const capsuleD = (x: number, y: number, w: number, h: number): string => {
  const r = w / 2;
  return `M ${n(x)} ${n(y + r)} A ${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)} V ${n(y + h - r)} A ${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)} Z`;
};

/** The hair cap: the top of a circle a little larger than the head, with a soft fringe. */
const CAP = `M -21 -81 A 21 21 0 0 1 21 -81 Q 11 -92 0 -90 Q -11 -92 -21 -81 Z`;

function hairBehind(hair: FigureHair, tone: WordArtTone): WordArtShape[] {
  if (hair === 'long') return [path('M -22 -80 A 22 22 0 0 1 22 -80 V -64 A 6 6 0 0 1 16 -58 H -16 A 6 6 0 0 1 -22 -64 Z', { f: tone, ...INK })];
  if (hair === 'bun') return [circle(0, -103, 8, { f: tone, ...INK })];
  return [];
}

function canonical(o: FigureOptions): WordArtShape[] {
  const tone: WordArtTone = o.hair === 'grey' ? 'vocab.gray' : (o.hairTone ?? 'text.secondary');
  const shapes: WordArtShape[] = [...hairBehind(o.hair, tone)];
  if (o.accessory === 'blanket') {
    // a swaddled baby: the blanket's hood frames the head
    shapes.push(circle(HOOD.x, HOOD.y, HOOD.r, { f: o.clothes, ...INK }));
    shapes.push(path(`M -22 -46 A 22 22 0 0 1 22 -46 V -14 A 14 14 0 0 1 8 0 H -8 A 14 14 0 0 1 -22 -14 Z`, { f: o.clothes, ...INK }));
    shapes.push(path('M -21 -40 Q 0 -30 21 -42', DETAIL));
  } else {
    const legBottom = o.compact ? 0 : -3;
    shapes.push(path(`${capsuleD(-13, -34, 10, 34 + legBottom)} ${capsuleD(3, -34, 10, 34 + legBottom)}`, PAPER));
    if (!o.compact) shapes.push(path(`${ellipseD(-9, -3.5, 7.5, 3.5)} ${ellipseD(9, -3.5, 7.5, 3.5)}`, { f: 'text.primary' }));
    shapes.push(
      poly(
        [
          [-13, -64],
          [13, -64],
          [24, -59],
          [31, -39],
          [22, -36],
          [17, -50],
          [19, -30],
          [-19, -30],
          [-17, -50],
          [-22, -36],
          [-31, -39],
          [-24, -59],
        ],
        { f: o.clothes, ...INK },
        4,
      ),
    );
    if (o.accessory === 'cane') shapes.push(path('M 27 0 L 27 -40 A 4.5 4.5 0 0 1 36 -40', INK));
    if (!o.compact) shapes.push(path(`${circleD(-26.5, -35, 5)} ${circleD(26.5, -35, 5)}`, PAPER));
  }
  shapes.push(circle(HEAD.x, HEAD.y, HEAD.r, PAPER));
  if (o.hair !== 'none') shapes.push(path(CAP, { f: tone, ...INK }));
  shapes.push(...face(0, EYE_Y, FACE_SCALE));
  if (o.accessory === 'glasses') {
    const ex = 9 * FACE_SCALE;
    shapes.push(path(`${circleD(-ex, EYE_Y, 5.5)} ${circleD(ex, EYE_Y, 5.5)} M ${n(-ex + 5.5)} ${EYE_Y} L ${n(ex - 5.5)} ${EYE_Y}`, DETAIL));
  }
  return shapes;
}

function checkHeight(height: number): void {
  if (!(height >= FIGURE_MIN_HEIGHT && height <= FIGURE_MAX_HEIGHT)) throw new RangeError(`WordArt figure height must be ${FIGURE_MIN_HEIGHT}..${FIGURE_MAX_HEIGHT}: ${String(height)}`);
}

/** A neutral standing figure, `height` units tall, feet on `ground`, centred on `x`. */
export function figure(options: FigureOptions): WordArtShape[] {
  checkHeight(options.height);
  return placeGlyph(canonical(options), { scale: options.height / 100, dx: options.x ?? 50, dy: options.ground ?? 88 });
}

/** The highest y the figure reaches (hair included): place a marker above it. */
export function figureTop(options: FigureOptions): number {
  checkHeight(options.height);
  const top = Math.min(HAIR_TOP[options.hair], options.accessory === 'blanket' ? HOOD.y - HOOD.r : 0);
  return (options.ground ?? 88) + (top * options.height) / 100;
}

/** The speaker marker: a small brand.secondary dot above a head (§3.6.4). */
export function marker(x: number, y: number): WordArtShape {
  return circle(x, y, 4, { f: 'brand.secondary', ...DETAIL });
}

export type SiblingHair = 'long' | 'short';

/**
 * An older sibling and the speaker (smaller, to the right, with the marker),
 * for 언니, 누나, 오빠 and 형: hair length tells the two sides apart (long or
 * short), the convention the card back names (F-VOC-001 §3.6).
 */
export function siblings(older: SiblingHair, speaker: SiblingHair): WordArtShape[] {
  const big: FigureOptions = { height: 66, hair: older, clothes: 'brand.primary', x: 34, ground: 84 };
  const small: FigureOptions = { height: 48, hair: speaker, clothes: 'brand.secondary', x: 70, ground: 84 };
  return [...figure(big), ...figure(small), marker(70, figureTop(small) - 7)];
}
