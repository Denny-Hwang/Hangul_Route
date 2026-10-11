/**
 * What the React Native `WordArt` paints (F-VOC-002 §3.7), decided in pure
 * code so node tests cover it: the glyph's render list (memoised per glyph
 * and mode, §3.8), the size and the accessibility of the picture. The
 * component only maps the result onto react-native-svg elements.
 */
import { getWordArt } from './registry';
import { toRenderList } from './render';
import type { RenderShape } from './render';
import type { WordArtGlyph, WordArtTone } from './types';

/** Silhouette tone (W8): the "not met yet" tile of the word wall. */
export const WORD_ART_MONO_TONE: WordArtTone = 'border.strong';

/** Used when a caller passes a size that is not a positive number: `touchTarget.hero`. */
export const WORD_ART_DEFAULT_SIZE = 96;

export interface WordArtModelInput {
  /** The key without `word:`. */
  artKey: string;
  size: number;
  mono?: boolean;
  decorative?: boolean;
  accessibilityLabel?: string;
}

export interface WordArtModel {
  size: number;
  viewBox: '0 0 100 100';
  shapes: readonly RenderShape[];
  /** The name read by assistive technology; undefined when decorative or blank. */
  label: string | undefined;
  /** Hidden from assistive technology. */
  decorative: boolean;
  /**
   * Neither named nor hidden: a picture that carries the meaning was given a
   * blank label (an empty gloss). The component warns in development, and a
   * caller (W-7 `PictureArt`) can fall back to the text tile.
   */
  unlabelled: boolean;
}

const cache = new WeakMap<WordArtGlyph, { color?: readonly RenderShape[]; mono?: readonly RenderShape[] }>();

function renderListOf(glyph: WordArtGlyph, mono: boolean): readonly RenderShape[] {
  const entry = cache.get(glyph) ?? {};
  cache.set(glyph, entry);
  const mode = mono ? 'mono' : 'color';
  entry[mode] ??= Object.freeze(toRenderList(glyph, mono ? { mono: WORD_ART_MONO_TONE } : {}));
  return entry[mode];
}

/** The model of one picture, or null for an unknown key (the caller falls back to its text tile). */
export function wordArtModel(input: WordArtModelInput, lookup: (key: string) => WordArtGlyph | undefined = getWordArt): WordArtModel | null {
  const glyph = lookup(input.artKey);
  if (glyph === undefined) return null;
  const decorative = input.decorative === true;
  const label = decorative ? undefined : input.accessibilityLabel?.trim() || undefined;
  const size = Number.isFinite(input.size) && input.size > 0 ? input.size : WORD_ART_DEFAULT_SIZE;
  return { size, viewBox: '0 0 100 100', shapes: renderListOf(glyph, input.mono === true), label, decorative, unlabelled: !decorative && label === undefined };
}
