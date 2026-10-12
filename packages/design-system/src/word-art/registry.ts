/**
 * The WordArt registry (F-VOC-002 §3.9): every glyph by key, with its meta.
 * Keys are written WITHOUT the `word:` prefix. Merging throws at import on a
 * duplicate or malformed key, so a test that imports this module catches it.
 *
 * The generators (`generated/{color,count,body,figure}.ts`) and the four
 * props land in PR W-1c; the batches register the generated keys (colours
 * and counts in W-3, body in W-4) and fill `glyphs/*.ts` (W-3..W-6). The
 * colour swatches are built from the hand glyphs they draw as stickers, so
 * the hand sources are merged first.
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
import { COLOR_SWATCHES, colorGlyphs } from './generated/color';
import { COUNT_VALUES, countGlyphs } from './generated/count';
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

/** Why every colour swatch carries the C2 waiver (§3.6.1). No swatch needs a fifth fill tone (§3.3): each stays at 4 or fewer. */
const SWATCH_REASON = 'The swatch square fills the frame (88 of 100 units, margin 6), so its subject box is past the 60-70 % rule by design (§3.6.1).';

/** Review state and waivers. A key not listed is a `draft`. */
const META: WordArtMetaOverrides = {
  'food-apple': { status: 'review' },
  'animal-cat': { status: 'review' },
  'nature-cloud': { status: 'review' },
  'school-chair': { status: 'review' },
  'travel-bus': { status: 'review' },
  'sport-soccer': { status: 'review' },
  'prop-tangerine': { status: 'review' },
  'prop-leaf': { status: 'review' },
  'prop-grapes': { status: 'review' },
  'prop-crow': { status: 'review' },
  // batch W-3: food, the colour-swatch objects of later families, colours and counts
  ...Object.fromEntries(
    ['food-banana', 'food-milk', 'food-bread', 'food-ramyeon', 'food-water', 'food-egg', 'food-strawberry', 'food-tteok', 'animal-bear', 'animal-elephant', 'nature-flower'].map((k) => [k, { status: 'review' }]),
  ),
  ...Object.fromEntries(Object.keys(COLOR_SWATCHES).map((k) => [k, { status: 'review', bboxWaived: true, reason: SWATCH_REASON }])),
  ...Object.fromEntries(COUNT_VALUES.map((n) => [`count-${n}`, { status: 'review' }])),
  // batch W-6: travel, sport, K-Culture and science, approved by the batch review that stands in for the owner's (2026-10-11)
  ...Object.fromEntries([...['airplane', 'train', 'taxi', 'subway', 'car', 'boat', 'map', 'passport', 'ticket', 'airport', 'hotel'].map((k) => `travel-${k}`), ...['baseball', 'basketball', 'volleyball', 'tabletennis', 'swimming', 'taekwondo', 'running', 'jumprope', 'bicycle', 'skiing', 'ball'].map((k) => `sport-${k}`), ...['hangul', 'hanok', 'bibimbap', 'tteokbokki', 'song', 'dance', 'drama'].map((k) => `culture-${k}`), ...['fire', 'ice', 'stone', 'magnet', 'earth', 'space', 'robot', 'seed', 'shadow', 'wind', 'light'].map((k) => `science-${k}`)].map((k) => [k, { status: 'approved' }])),
  'science-rainbow': { status: 'approved', maxTones: 7, reason: 'A rainbow needs its six arc colours, and the two clouds at its feet are a seventh, white (§3.12 brief: six arcs, two clouds).' },
};

/** One glyph file: the family it holds, and its glyphs by key. */
export type WordArtSource = readonly [WordArtFamily, Readonly<Record<string, WordArtGlyph>>];

/**
 * Merge glyph sources into a deeply frozen registry (shapes included, so no
 * caller can repaint the shared data). Throws on a malformed or duplicate key,
 * a key filed under another family's source (§3.9 one file per family), or
 * meta without a glyph.
 */
export function buildRegistry(sources: readonly WordArtSource[], meta: WordArtMetaOverrides): Readonly<Record<string, WordArtEntry>> {
  const out: Record<string, WordArtEntry> = {};
  for (const [sourceFamily, glyphs] of sources) {
    for (const [key, glyph] of Object.entries(glyphs)) {
      const family = WORD_ART_KEY_RE.exec(key)?.[1] as WordArtFamily | undefined;
      if (family === undefined) throw new Error(`WordArt key outside the grammar: ${key}`);
      if (family !== sourceFamily) throw new Error(`WordArt key ${key} is filed under the ${sourceFamily} glyphs`);
      if (Object.prototype.hasOwnProperty.call(out, key)) throw new Error(`Duplicate WordArt key: ${key}`);
      const frozen: WordArtGlyph = Object.freeze(glyph.map((shape) => Object.freeze({ ...shape })));
      out[key] = Object.freeze({ glyph: frozen, meta: Object.freeze({ family, status: 'draft', ...meta[key] }) });
    }
  }
  for (const key of Object.keys(meta)) if (!Object.prototype.hasOwnProperty.call(out, key)) throw new Error(`WordArt meta for a key with no glyph: ${key}`);
  return Object.freeze(out);
}

/** The hand-drawn sources, one per family file. */
const HAND: readonly WordArtSource[] = [
  ['food', FOOD_GLYPHS],
  ['animal', ANIMAL_GLYPHS],
  ['family', FAMILY_GLYPHS],
  ['school', SCHOOL_GLYPHS],
  ['nature', NATURE_GLYPHS],
  ['travel', TRAVEL_GLYPHS],
  ['sport', SPORT_GLYPHS],
  ['culture', CULTURE_GLYPHS],
  ['science', SCIENCE_GLYPHS],
  ['prop', PROP_GLYPHS],
];

/** A hand glyph by key, before the registry exists: the colour swatches draw their objects from it. */
const handGlyph = (key: string): WordArtGlyph | undefined => HAND.find(([, glyphs]) => Object.prototype.hasOwnProperty.call(glyphs, key))?.[1][key];

export const WORD_ART: Readonly<Record<string, WordArtEntry>> = buildRegistry(
  [...HAND, ['color', colorGlyphs(handGlyph)], ['count', countGlyphs()]],
  META,
);

export const WORD_ART_KEYS: readonly string[] = Object.freeze(Object.keys(WORD_ART));

/** The glyph for a key (without `word:`), or undefined: the caller falls back to the text tile (§3.7). */
export function getWordArt(key: string): WordArtGlyph | undefined {
  return Object.prototype.hasOwnProperty.call(WORD_ART, key) ? WORD_ART[key]!.glyph : undefined;
}

/** `'word:food-apple'` -> `'food-apple'`; null for `card:*`, `swatch:*` or a malformed key. */
export function wordArtKeyOf(ref: string): string | null {
  if (!ref.startsWith('word:')) return null;
  const key = ref.slice('word:'.length);
  return WORD_ART_KEY_RE.test(key) ? key : null;
}
