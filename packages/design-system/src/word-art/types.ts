/**
 * WordArt data model (F-VOC-002 §3.1, W1). A glyph is plain data: an ordered
 * list of shapes on a `0 0 100 100` viewBox, every colour a token path. Pure
 * TypeScript, no React.
 */
import type { colors } from '../tokens';

type Leaves<C> = { [G in keyof C & string]: `${G}.${keyof C[G] & string}` }[keyof C & string];

/** Tokens a picture may not use: the reserved destructive red, the scrims, and card-rarity meaning (§3.3). */
export type ExcludedTone = 'feedback.danger' | 'feedback.dangerLight' | 'surface.overlay' | 'surface.inkScrim' | `rarity.${string}`;

/** A colour named by its token path, e.g. `'vocab.red'`, `'text.primary'`. */
export type WordArtTone = Exclude<Leaves<typeof colors>, ExcludedTone>;

/** Fill, stroke, stroke width (2 or 3; generated dots 1.5), opacity (0.1-1, shadows and highlights only). */
export interface WordArtPaint {
  f?: WordArtTone;
  s?: WordArtTone;
  sw?: number;
  o?: number;
}

export type WordArtShape =
  | ({ t: 'circle'; x: number; y: number; r: number } & WordArtPaint)
  | ({ t: 'ellipse'; x: number; y: number; rx: number; ry: number } & WordArtPaint)
  | ({ t: 'rect'; x: number; y: number; w: number; h: number; r?: number } & WordArtPaint)
  | ({ t: 'path'; d: string } & WordArtPaint);

/** Painted in order on the `0 0 100 100` viewBox. */
export type WordArtGlyph = readonly WordArtShape[];

export type WordArtFamily =
  | 'food'
  | 'animal'
  | 'family'
  | 'school'
  | 'nature'
  | 'travel'
  | 'sport'
  | 'culture'
  | 'science'
  | 'color'
  | 'count'
  | 'body'
  | 'prop';

/** Review state shown on the contact sheet (§3.10): the owner marks `approved`. */
export type WordArtStatus = 'draft' | 'review' | 'approved';

export interface WordArtMeta {
  family: WordArtFamily;
  status: WordArtStatus;
  /** Allowlist above the 4 fill tones of §3.3 (the rainbow needs 6); needs `reason`. */
  maxTones?: number;
  /** C2 waiver (the subject cannot fill 60-70 % of the frame); needs `reason`. */
  bboxWaived?: boolean;
  /** Why a waiver is granted. */
  reason?: string;
  /** The key exists for v1.1 and is unused at launch. */
  reserved?: boolean;
}
