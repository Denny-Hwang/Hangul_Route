/**
 * WordArt family glyphs (F-VOC-002 §3.9, briefs in §3.12), drawn in batch
 * W-5. Every person is the neutral figure of `generated/figure.ts` (§3.6.4,
 * C12): a paper face, hair and clothes carry the cues, and the face smiles.
 * The four sibling words use `siblings()`: the speaker is the smaller figure
 * with the marker, and long or short hair tells the two sides apart. Keys are
 * written without the `word:` prefix.
 */
import { circle, groundShadow, path } from '../builders';
import { figure, figureTop, marker, siblings } from '../generated/figure';
import type { FigureOptions } from '../generated/figure';
import type { WordArtGlyph, WordArtTone } from '../types';

const INK = { s: 'text.primary', sw: 3 } as const;

/** One standing adult, centred, on a shadow. */
const adult = (options: Omit<FigureOptions, 'height'> & { height?: number }): WordArtGlyph => [groundShadow(50, 86, 22), ...figure({ height: 72, ground: 86, ...options })];

/** Two figures side by side, the marker over the speaker (`speaker` 0 or 1). */
function pairWithMarker(a: FigureOptions, b: FigureOptions, speaker: 0 | 1): WordArtGlyph {
  const who = speaker === 0 ? a : b;
  return [groundShadow(52, 85, 34), ...figure(a), ...figure(b), marker(who.x ?? 50, figureTop(who) - 7)];
}

/** The shirt of the `me` figure: the viewer's right arm bends in so its hand points at the chest. */
function pointingFigure(clothes: WordArtTone): WordArtGlyph {
  const s = 0.7;
  const at = (cx: number, cy: number): string => `${Math.round((50 + cx * s) * 10) / 10} ${Math.round((86 + cy * s) * 10) / 10}`;
  const base = figure({ height: 70, hair: 'short', clothes, ground: 86 });
  // drop the stock shirt (a clothes-filled path) and the two hands (a paper path of two sub-paths)
  const isShirt = (d: string, f?: string): boolean => f === clothes && d.includes('Q');
  const isHands = (d: string, f?: string): boolean => f === 'surface.paper' && (d.match(/M/g) ?? []).length === 2 && !d.includes('V');
  const kept = base.filter((sh) => !(sh.t === 'path' && (isShirt(sh.d, sh.f) || isHands(sh.d, sh.f))));
  const headAt = kept.findIndex((sh) => sh.t === 'circle' && sh.f === 'surface.paper');
  const shirt = path(
    `M ${at(-13, -64)} L ${at(13, -64)} Q ${at(24, -61)} ${at(29, -50)} L ${at(31, -43)} Q ${at(31, -38)} ${at(26, -38)} L ${at(8, -41)} L ${at(8, -49)} L ${at(19, -48)} L ${at(19, -30)} L ${at(-19, -30)} L ${at(-17, -50)} L ${at(-22, -36)} L ${at(-31, -39)} L ${at(-24, -59)} Q ${at(-21, -64)} ${at(-13, -64)} Z`,
    { f: clothes, ...INK },
  );
  const hands = [circle(50 - 26.5 * s, 86 - 35 * s, 5 * s, { f: 'surface.paper', ...INK }), circle(50 + 5 * s, 86 - 45 * s, 5 * s, { f: 'surface.paper', ...INK })];
  // the ring on the chest, just left of the pointing hand
  const ring = circle(50 - 7 * s, 86 - 51 * s, 8.5 * s, { s: 'brand.secondary', sw: 3 });
  return [groundShadow(50, 86, 22), ...kept.slice(0, headAt), shirt, ring, ...hands, ...kept.slice(headAt)];
}

export const FAMILY_GLYPHS: Readonly<Record<string, WordArtGlyph>> = {
  // adult figure, long hair
  'family-mom': adult({ hair: 'long', clothes: 'vocab.pink' }),
  // adult figure, short hair
  'family-dad': adult({ hair: 'short', clothes: 'vocab.blue' }),
  // adult figure, hair bun in gray
  'family-grandma': adult({ hair: 'bun', hairTone: 'vocab.gray', clothes: 'vocab.purple', height: 66 }),
  // adult figure, gray short hair, cane
  'family-grandpa': adult({ hair: 'grey', clothes: 'vocab.brown', accessory: 'cane', height: 70 }),
  // older long-haired figure + smaller long-haired speaker (marker)
  'family-eonni': [groundShadow(52, 85, 34), ...siblings('long', 'long')],
  // older long-haired figure + smaller short-haired speaker
  'family-nuna': [groundShadow(52, 85, 34), ...siblings('long', 'short')],
  // older short-haired figure + smaller long-haired speaker
  'family-oppa': [groundShadow(52, 85, 34), ...siblings('short', 'long')],
  // older short-haired figure + smaller short-haired speaker
  'family-hyeong': [groundShadow(52, 85, 34), ...siblings('short', 'short')],
  // larger figure + small figure: the speaker is the larger, so the marker is over it
  'family-dongsaeng': pairWithMarker(
    { height: 64, hair: 'short', clothes: 'brand.secondary', x: 36, ground: 85 },
    { height: 40, hair: 'short', clothes: 'feedback.success', x: 72, ground: 85 },
    0,
  ),
  // infant in a blanket
  'family-baby': [groundShadow(50, 86, 18), ...figure({ height: 66, hair: 'none', clothes: 'brand.secondaryLight', accessory: 'blanket', ground: 86 })],
  // four figures in a row (ink hair, so four people stay within four fill tones)
  'family-family': [
    groundShadow(50, 85, 38),
    ...figure({ height: 58, hair: 'short', hairTone: 'text.primary', clothes: 'vocab.blue', x: 27, ground: 85, compact: true }),
    ...figure({ height: 54, hair: 'long', hairTone: 'text.primary', clothes: 'vocab.pink', x: 43, ground: 85, compact: true }),
    ...figure({ height: 40, hair: 'short', hairTone: 'text.primary', clothes: 'hoya.fur', x: 60, ground: 85, compact: true }),
    ...figure({ height: 34, hair: 'long', hairTone: 'text.primary', clothes: 'vocab.blue', x: 74, ground: 85, compact: true }),
  ],
  // one figure with a ring on the chest, a hand pointing to it
  'family-me': pointingFigure('hoya.fur'),
};
