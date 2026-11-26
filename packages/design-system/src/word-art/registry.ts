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
import { BODY_PARTS, bodyGlyphs } from './generated/body';
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
  'act',
] as const);

export const WORD_ART_KEY_RE = new RegExp(`^(${WORD_ART_FAMILIES.join('|')})-[a-z0-9-]+$`);

/**
 * Planned glyphs per family (F-VOC-001 §3.4 counts; F-VOC-002 §3.8): 108 hand + 4 props + 36 generated.
 * A `reserved` key (a lesson picture outside the vocabulary topics) is not counted.
 * AMENDMENTS-PICTURES-2026-11 row PX-1 added 13 hand glyphs (95 before): the words that borrowed a heritage card
 * picture now have their own (food +3, animal +1, school +1, nature +3, culture +5), so every family is 12.
 */
export const WORD_ART_PLAN: Readonly<Record<WordArtFamily, number>> = Object.freeze({
  food: 12,
  animal: 12,
  family: 12,
  school: 12,
  nature: 12,
  travel: 12,
  sport: 12,
  culture: 12,
  science: 12,
  color: 12,
  count: 12,
  body: 12,
  prop: 4,
  // [PV] AMENDMENTS-PLC-VALIDITY PV-1a: every action picture is `reserved` (no vocabulary topic uses it), so none is planned
  act: 0,
});

export interface WordArtEntry {
  glyph: WordArtGlyph;
  meta: WordArtMeta;
}

/** Per-key meta beyond the family, which the key prefix gives. */
export type WordArtMetaOverrides = Readonly<Record<string, Partial<Omit<WordArtMeta, 'family'>>>>;

/** Why every colour swatch carries the C2 waiver (§3.6.1). No swatch needs a fifth fill tone (§3.3): each stays at 4 or fewer. */
const SWATCH_REASON = 'The swatch square fills the frame (88 of 100 units, margin 6), so its subject box is past the 60-70 % rule by design (§3.6.1).';

/**
 * Review state and waivers. A key not listed is a `draft`. The W-1b samples,
 * the props and the W-3 keys stay `review` until the follow-up review pass;
 * F-VOC-003 C-7 waits for every non-prop key of a shown topic to be `approved`
 * (§6).
 */
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
  // batch W-4: the other animals and the body parts, approved by the batch review that stands in for the owner's (2026-10-11)
  ...Object.fromEntries([...['puppy', 'rabbit', 'bird', 'fish', 'duck', 'fox', 'monkey', 'butterfly'].map((a) => `animal-${a}`), ...BODY_PARTS.map((p) => `body-${p}`)].map((k) => [k, { status: 'approved' }])),
  // batch W-5: family, school and nature, approved by the batch review that stands in for the owner's (2026-10-11)
  ...Object.fromEntries([...['mom', 'dad', 'grandma', 'grandpa', 'eonni', 'nuna', 'oppa', 'hyeong', 'dongsaeng', 'baby', 'family', 'me'].map((k) => `family-${k}`), ...['school', 'teacher', 'friend', 'pencil', 'bag', 'notebook', 'eraser', 'desk', 'scissors', 'board'].map((k) => `school-${k}`), ...['sky', 'sun', 'star', 'tree', 'rain', 'snow', 'river'].map((k) => `nature-${k}`)].map((k) => [k, { status: 'approved' }])),
  // batch W-6: travel, sport, K-Culture and science, approved by the batch review that stands in for the owner's (2026-10-11)
  ...Object.fromEntries([...['airplane', 'train', 'taxi', 'subway', 'car', 'boat', 'map', 'passport', 'ticket', 'airport', 'hotel'].map((k) => `travel-${k}`), ...['baseball', 'basketball', 'volleyball', 'tabletennis', 'swimming', 'taekwondo', 'running', 'jumprope', 'bicycle', 'skiing', 'ball'].map((k) => `sport-${k}`), ...['hangul', 'hanok', 'bibimbap', 'tteokbokki', 'song', 'dance', 'drama'].map((k) => `culture-${k}`), ...['fire', 'ice', 'stone', 'magnet', 'earth', 'space', 'robot', 'seed', 'shadow', 'wind', 'light'].map((k) => `science-${k}`)].map((k) => [k, { status: 'approved' }])),
  'science-rainbow': { status: 'approved', maxTones: 7, reason: 'A rainbow needs its six arc colours, and the two clouds at its feet are a seventh, white (§3.12 brief: six arcs, two clouds).' },
  // batch PX-1 (AMENDMENTS-PICTURES-2026-11): the 13 words that borrowed a heritage card picture get their own glyph, and
  // five glyphs get a second cue. [FU] Approved by the owner on 2026-11-17 (in chat: "I approve the new pictures"); the
  // line is listed after the W-1b and W-3 lines above, so this status wins for nature-cloud, food-egg and food-tteok.
  ...Object.fromEntries(
    ['food-rice', 'food-kimchi', 'food-kimbap', 'animal-tiger', 'school-book', 'nature-mountain', 'nature-sea', 'nature-moon', 'culture-hanbok', 'culture-seollal', 'culture-chuseok', 'culture-yutnori', 'culture-gayageum', 'food-egg', 'food-tteok', 'science-shadow', 'science-seed', 'nature-cloud'].map((k) => [k, { status: 'approved' }]),
  ),
  // lesson pictures outside the vocabulary topics (Stage 2 Playground Words, F-CURR-001 S2-3): reserved, so outside the family plan
  ...Object.fromEntries(['sport-swing', 'sport-slide', 'nature-sand'].map((k) => [k, { status: 'approved', reserved: true }])),
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

/** The hand-drawn sources loaded with the start bundle, one per family file. The `act` glyphs load later (`ACT_FAMILIES`). */
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

/**
 * [PV] The level check's action pictures (AMENDMENTS-PLC-VALIDITY S3, S5, row PV-1a): each noun's family of three
 * predicates, as hyphen-free slugs. A key is `act-<predicate>-<noun>` (`act-swim-bear`); the glyphs are
 * `glyphs/act.ts`. They are not in `HAND`: the start bundle carries only these names, and the glyphs load with the
 * level check's chunk (F-VOC-002 §3.8's split), which hands them to `addWordArt`.
 */
export const ACT_FAMILIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  bear: Object.freeze(['run', 'swim', 'sleep']),
  tiger: Object.freeze(['run', 'swim', 'sleep']),
  puppy: Object.freeze(['run', 'swim', 'sleep']),
  rabbit: Object.freeze(['run', 'eat', 'sleep']),
  cat: Object.freeze(['run', 'eat', 'sleep']),
  monkey: Object.freeze(['run', 'eat', 'sleep']),
  bird: Object.freeze(['fly', 'eat', 'sleep']),
  duck: Object.freeze(['swim', 'fly', 'sleep']),
  sibling: Object.freeze(['run', 'swim', 'eat']),
  friend: Object.freeze(['run', 'swim', 'eat']),
});

/** Every action picture's key, family by family. */
export const ACT_KEYS: readonly string[] = Object.freeze(Object.entries(ACT_FAMILIES).flatMap(([noun, predicates]) => predicates.map((p) => `act-${p}-${noun}`)));

/** The keys of each family that loads later, with its chunk, and their meta: every action picture is reserved and waits for review. */
const LATE_KEYS: Readonly<Partial<Record<WordArtFamily, readonly string[]>>> = { act: ACT_KEYS };
const LATE_META: WordArtMetaOverrides = Object.fromEntries(ACT_KEYS.map((k) => [k, { status: 'review', reserved: true }]));

/** A hand glyph by key, before the registry exists: the colour swatches draw their objects from it. */
const handGlyph = (key: string): WordArtGlyph | undefined => HAND.find(([, glyphs]) => Object.prototype.hasOwnProperty.call(glyphs, key))?.[1][key];

export const WORD_ART: Readonly<Record<string, WordArtEntry>> = buildRegistry(
  [...HAND, ['color', colorGlyphs(handGlyph)], ['count', countGlyphs()], ['body', bodyGlyphs()]],
  META,
);

export const WORD_ART_KEYS: readonly string[] = Object.freeze(Object.keys(WORD_ART));

/** The late families' glyphs, once their chunk has handed them over (`addWordArt`). */
const LATE: Record<string, WordArtEntry> = {};

/**
 * Hand over the glyphs of a family that loads with a chunk (§3.8's split; today `act`, with the level check). The
 * keys must be exactly the family's declared keys (`ACT_KEYS`), so the names the start bundle knows and the glyphs
 * cannot drift; a second call (the chunk evaluated again) changes nothing. Returns the family's entries.
 */
export function addWordArt(source: WordArtSource): Readonly<Record<string, WordArtEntry>> {
  const [family, glyphs] = source;
  const declared = LATE_KEYS[family];
  if (declared === undefined) throw new Error(`WordArt family ${family} does not load late`);
  const keys = Object.keys(glyphs);
  if (keys.length !== declared.length || !declared.every((k) => keys.includes(k))) throw new Error(`WordArt ${family} glyphs do not match its declared keys`);
  if (!keys.every((k) => Object.prototype.hasOwnProperty.call(LATE, k))) Object.assign(LATE, buildRegistry([source], LATE_META));
  return Object.freeze(Object.fromEntries(declared.map((k) => [k, LATE[k]!])));
}

/** The glyph for a key (without `word:`), or undefined: the caller falls back to the text tile (§3.7). A late family's key has its glyph once its chunk has loaded. */
export function getWordArt(key: string): WordArtGlyph | undefined {
  if (Object.prototype.hasOwnProperty.call(WORD_ART, key)) return WORD_ART[key]!.glyph;
  return Object.prototype.hasOwnProperty.call(LATE, key) ? LATE[key]!.glyph : undefined;
}

/** `'word:food-apple'` -> `'food-apple'`; null for `card:*`, `swatch:*` or a malformed key. */
export function wordArtKeyOf(ref: string): string | null {
  if (!ref.startsWith('word:')) return null;
  const key = ref.slice('word:'.length);
  return WORD_ART_KEY_RE.test(key) ? key : null;
}
