/**
 * The WordArt registry (F-VOC-002 §3.9): every glyph by key, with its meta.
 * Keys are written WITHOUT the `word:` prefix. Merging throws at import on a
 * duplicate or malformed key, so a test that imports this module catches it.
 *
 * The generated families (`color`, `count`, `body`, and the `figure` builder
 * for `family`) join in PR W-1c; the hand-drawn batches fill `glyphs/*.ts`
 * (W-3..W-6).
 */
import { ANIMAL_GLYPHS } from './glyphs/animal';
import { CULTURE_GLYPHS } from './glyphs/culture';
import { FAMILY_GLYPHS } from './glyphs/family';
import { FOOD_GLYPHS } from './glyphs/food';
import { NATURE_GLYPHS } from './glyphs/nature';
import { PROP_GLYPHS } from './glyphs/prop';
import { SCHOOL_GLYPHS } from './glyphs/school';
import { SCIENCE_GLYPHS } from './glyphs/science';
import { SPORT_GLYPHS } from './glyphs/sport';
import { TRAVEL_GLYPHS } from './glyphs/travel';
import type { WordArtFamily, WordArtGlyph, WordArtMeta } from './types';

export const WORD_ART_FAMILIES: readonly WordArtFamily[] = Object.freeze([
  'food',
  'animal',
  'family',
  'school',
  'nature',
  'travel',
  'sport',
  'culture',
  'science',
  'color',
  'count',
  'body',
  'prop',
] as const);

export const WORD_ART_KEY_RE = new RegExp(`^(${WORD_ART_FAMILIES.join('|')})-[a-z0-9-]+$`);

/** Planned glyphs per family (F-VOC-001 §3.4 counts; F-VOC-002 §3.8): 95 hand + 4 props + 36 generated. */
export const WORD_ART_PLAN: Readonly<Record<WordArtFamily, number>> = Object.freeze({
  food: 9,
  animal: 11,
  family: 12,
  school: 11,
  nature: 9,
  travel: 12,
  sport: 12,
  culture: 7,
  science: 12,
  color: 12,
  count: 12,
  body: 12,
  prop: 4,
});

export interface WordArtEntry {
  glyph: WordArtGlyph;
  meta: WordArtMeta;
}

/** Per-key meta beyond the family, which the key prefix gives. */
export type WordArtMetaOverrides = Readonly<Record<string, Partial<Omit<WordArtMeta, 'family'>>>>;

/** Review state and waivers. A key not listed is a `draft`. */
const META: WordArtMetaOverrides = {
  'food-apple': { status: 'review' },
  'animal-cat': { status: 'review' },
  'nature-cloud': { status: 'review' },
  'school-chair': { status: 'review' },
  'travel-bus': { status: 'review' },
  'sport-soccer': { status: 'review' },
};

/** Merge glyph sources into a frozen registry; throws on a duplicate or malformed key, or meta without a glyph. */
export function buildRegistry(sources: readonly Readonly<Record<string, WordArtGlyph>>[], meta: WordArtMetaOverrides): Readonly<Record<string, WordArtEntry>> {
  const out: Record<string, WordArtEntry> = {};
  for (const source of sources) {
    for (const [key, glyph] of Object.entries(source)) {
      const family = WORD_ART_KEY_RE.exec(key)?.[1] as WordArtFamily | undefined;
      if (family === undefined) throw new Error(`WordArt key outside the grammar: ${key}`);
      if (Object.hasOwn(out, key)) throw new Error(`Duplicate WordArt key: ${key}`);
      out[key] = Object.freeze({ glyph: Object.freeze(glyph), meta: Object.freeze({ family, status: 'draft', ...meta[key] }) });
    }
  }
  for (const key of Object.keys(meta)) if (!Object.hasOwn(out, key)) throw new Error(`WordArt meta for a key with no glyph: ${key}`);
  return Object.freeze(out);
}

export const WORD_ART: Readonly<Record<string, WordArtEntry>> = buildRegistry(
  [FOOD_GLYPHS, ANIMAL_GLYPHS, FAMILY_GLYPHS, SCHOOL_GLYPHS, NATURE_GLYPHS, TRAVEL_GLYPHS, SPORT_GLYPHS, CULTURE_GLYPHS, SCIENCE_GLYPHS, PROP_GLYPHS],
  META,
);

export const WORD_ART_KEYS: readonly string[] = Object.freeze(Object.keys(WORD_ART));

/** The glyph for a key (without `word:`), or undefined: the caller falls back to the text tile (§3.7). */
export function getWordArt(key: string): WordArtGlyph | undefined {
  return Object.hasOwn(WORD_ART, key) ? WORD_ART[key]!.glyph : undefined;
}

/** `'word:food-apple'` -> `'food-apple'`; null for `card:*`, `swatch:*` or a malformed key. */
export function wordArtKeyOf(ref: string): string | null {
  if (!ref.startsWith('word:')) return null;
  const key = ref.slice('word:'.length);
  return WORD_ART_KEY_RE.test(key) ? key : null;
}
