/**
 * Colour and stroke tokens for scene art (F-STORY-002 §3.9.1). The only place
 * scene-art touches `colors` and `borderWidth`; everything else carries token
 * names.
 */
import { borderWidth, colors } from '../tokens';
import { VOCAB_TONES } from './hidden-heritage/tones';
import type { ArtColorToken, ColorToken, ReservedColorGroup, StrokeToken, VocabColorToken } from './types';

const RESERVED: ReadonlySet<string> = new Set(['surface.overlay', 'surface.inkScrim', 'feedback.danger']);

/** Whole groups a scene may not use: WordArt's content tones are drawn only inside WordArt (F-VOC-002 §3.4). */
const RESERVED_GROUPS: ReadonlySet<string> = new Set<ReservedColorGroup>(['vocab']);

/** Every leaf of `colors` a picture may use, in table order. */
export const COLOR_TOKENS: readonly ColorToken[] = Object.entries(colors)
  .filter(([group]) => !RESERVED_GROUPS.has(group))
  .flatMap(([group, values]) =>
    Object.keys(values)
      .map((name) => `${group}.${name}`)
      .filter((path) => !RESERVED.has(path)),
  ) as ColorToken[];

const TOKEN_SET: ReadonlySet<string> = new Set(COLOR_TOKENS);

export function isColorToken(value: unknown): value is ColorToken {
  return typeof value === 'string' && TOKEN_SET.has(value);
}

/** WordArt's content tones as token paths: drawable, authored only by hidden-heritage things ([PX] R4). */
export const VOCAB_COLOR_TOKENS: readonly VocabColorToken[] = Object.keys(VOCAB_TONES) as VocabColorToken[];

const isVocabTone = (value: unknown): value is VocabColorToken => typeof value === 'string' && Object.prototype.hasOwnProperty.call(VOCAB_TONES, value);

/** A token the renderer draws: a scene token, or a vocab tone a hidden-heritage thing carries. */
export function isArtColorToken(value: unknown): value is ArtColorToken {
  return isColorToken(value) || isVocabTone(value);
}

/**
 * Hex value of a token. An unknown or reserved token throws; renderers guard
 * with `isArtColorToken` and draw nothing for it in production.
 */
export function resolveColor(token: ArtColorToken): string {
  if (isVocabTone(token)) return VOCAB_TONES[token];
  if (!isColorToken(token)) throw new RangeError(`Unknown colour token: ${String(token)}`);
  const [group, name] = (token as string).split('.') as [keyof typeof colors, string];
  return (colors[group] as Record<string, string>)[name]!;
}

/** Stroke width in canvas units; absent means `base`. */
export function resolveStroke(token: StrokeToken | undefined): number {
  if (token === undefined) return borderWidth.base;
  if (!Object.prototype.hasOwnProperty.call(borderWidth, token)) throw new RangeError(`Unknown stroke token: ${String(token)}`);
  return borderWidth[token];
}
