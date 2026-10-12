import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { supportedCardIds } from '../../components/HeritageCardArt/card-ids';
import { COLOR_SWATCHES } from '../generated/color';
import { WORD_ART, WORD_ART_KEYS, wordArtKeyOf } from '../registry';
import type { WordArtFamily } from '../types';

/**
 * F-VOC-002 §3.9, behaviour 1: the registry against `content/vocab/*.json`.
 *
 * The vocabulary topics landed before their art (F-VOC-001 V-2b..), so a
 * `word:` key may wait for its batch: each family below is drawn by the PR
 * named next to it, and until that PR lands its keys may be missing (the app
 * shows the text tile, F-QUEST-002 §3.11, and no topic is visible before
 * F-VOC-003 flips `flags.vocabTopicsEnabled`).
 *
 * For a family whose topic file has landed, `missing` pins how many of its
 * `word:` visuals have no glyph yet. So a misspelled key in a topic file (say
 * `word:food-aple`) fails now, as the count goes up, and is not hidden until
 * the batch. A batch PR deletes its families from this map, which turns on
 * the full check for them; a topic PR that serves a family here pins its count.
 * At W-1b every served family is waiting (42 visuals: 8 food, 10 animal,
 * 12 color, 12 count), so the full check starts with batch W-3. F-VOC-001 V-6a
 * serves body (12 generated), family (12), school (11 word: visuals, the chair
 * drawn) and nature (9 word: visuals, the cloud drawn) and pins their counts.
 * F-VOC-001 V-6b serves travel (12, the bus drawn), sport (12, the soccer ball
 * drawn), culture (7 word: visuals; the other five K-Culture words are cards)
 * and science (12) and pins their counts. Batch W-3 drew food, color and
 * count (they left the map, so their full check is on) and the colour-swatch
 * objects of later families: `animal-bear` and `animal-elephant` (animal now
 * waits for 8) and `nature-flower` (nature waits for 7). Batch W-4 drew the
 * other eight animals and registered the twelve body parts, so animal and
 * body left the map.
 */
interface Awaiting {
  /** The PR that draws the family (F-VOC-002 §6). */
  batch: string;
  /** Pinned number of the family's `word:` visuals without a glyph; only when its topic file exists. */
  missing?: number;
}

const AWAITING_ART: Readonly<Partial<Record<WordArtFamily, Awaiting>>> = {
  family: { batch: 'W-5', missing: 12 },
  school: { batch: 'W-5', missing: 10 },
  nature: { batch: 'W-5', missing: 7 },
  travel: { batch: 'W-6', missing: 11 },
  sport: { batch: 'W-6', missing: 11 },
  culture: { batch: 'W-6', missing: 7 },
  science: { batch: 'W-6', missing: 12 },
};

const VOCAB_DIR = join(__dirname, '..', '..', '..', '..', '..', 'content', 'vocab');

interface VocabFile {
  topic: { key: string };
  items: { id: string; visual: string }[];
}

const topicFiles = readdirSync(VOCAB_DIR)
  .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
  .sort()
  .map((name) => ({ name, data: JSON.parse(readFileSync(join(VOCAB_DIR, name), 'utf8')) as VocabFile }));

const items = topicFiles.flatMap(({ name, data }) => data.items.map((item) => ({ ...item, file: name })));
const wordRefs = items.filter((i) => i.visual.startsWith('word:'));
const cardRefs = items.filter((i) => i.visual.startsWith('card:'));
const familyOf = (key: string): WordArtFamily => key.split('-')[0] as WordArtFamily;

/** Families whose words appear in at least one topic file that exists. */
const servedFamilies = new Set(wordRefs.map((i) => familyOf(wordArtKeyOf(i.visual) ?? i.visual)));

describe('content/vocab against the registry', () => {
  it('reads the merged topic files', () => {
    expect(topicFiles.map((f) => f.name)).toEqual(expect.arrayContaining(['animals.json', 'colors.json', 'food.json', 'numbers.json']));
    expect(items.length).toBeGreaterThanOrEqual(48);
  });

  it('every visual is a card: or word: ref and every word: key is in the grammar', () => {
    for (const item of items) expect(item.visual, item.id).toMatch(/^(card|word):/);
    for (const item of wordRefs) expect(wordArtKeyOf(item.visual), `${item.file} ${item.id}`).not.toBeNull();
  });

  it('every card: visual is a drawn heritage card (supportedCardIds)', () => {
    expect(cardRefs.length).toBeGreaterThan(0);
    for (const item of cardRefs) expect(supportedCardIds, `${item.file} ${item.id}`).toContain(item.visual);
  });

  it('every word: visual resolves, except in a family still waiting for its batch', () => {
    const missing = wordRefs.filter((i) => !WORD_ART_KEYS.includes(wordArtKeyOf(i.visual)!));
    const unexpected = missing.filter((i) => AWAITING_ART[familyOf(wordArtKeyOf(i.visual)!)] === undefined);
    expect(unexpected.map((i) => `${i.file} ${i.id} ${i.visual}`)).toEqual([]);
  });

  it('a waiting family that is served has exactly its pinned number of missing words, so a typo or a finished batch shows', () => {
    for (const [family, awaiting] of Object.entries(AWAITING_ART) as [WordArtFamily, Awaiting][]) {
      const missing = wordRefs.filter((i) => familyOf(wordArtKeyOf(i.visual)!) === family && !WORD_ART_KEYS.includes(wordArtKeyOf(i.visual)!));
      if (!servedFamilies.has(family)) {
        expect(awaiting.missing, `${family} has no topic file yet: drop its pinned count`).toBeUndefined();
        continue;
      }
      expect(awaiting.missing, `${family} is served: pin its missing count in AWAITING_ART`).toBeDefined();
      expect(awaiting.missing!, `${family} is complete: remove it from AWAITING_ART`).toBeGreaterThan(0);
      expect(missing.map((i) => i.visual).sort(), `${family}: a misspelled key, or a glyph added or removed; update the pin only for a real change`).toHaveLength(awaiting.missing!);
    }
  });

  it('every non-prop glyph of a served family is used by exactly one item, or is reserved', () => {
    for (const key of WORD_ART_KEYS) {
      const { meta } = WORD_ART[key]!;
      if (meta.family === 'prop' || meta.reserved === true || !servedFamilies.has(meta.family)) continue;
      const users = wordRefs.filter((i) => wordArtKeyOf(i.visual) === key);
      expect(users.map((u) => u.id), key).toHaveLength(1);
    }
  });

  it('a glyph of a family with no topic file yet is checked for validity only (glyphs.test.ts)', () => {
    const unserved = WORD_ART_KEYS.filter((k) => !servedFamilies.has(WORD_ART[k]!.meta.family) && WORD_ART[k]!.meta.family !== 'prop');
    for (const key of unserved) expect(WORD_ART[key]!.glyph.length).toBeGreaterThan(0);
  });

  it('every prop is drawn inside a colour swatch (the colour generator names it as an object)', () => {
    const props = WORD_ART_KEYS.filter((k) => WORD_ART[k]!.meta.family === 'prop');
    const objects = Object.values(COLOR_SWATCHES).map((s) => s.object);
    expect(props.length).toBeGreaterThan(0);
    for (const key of props) expect(objects, `${key} is not used by any colour swatch`).toContain(key);
  });

  it('every colour swatch names an object key in the grammar, and a colour word of the topic file', () => {
    for (const [key, { object }] of Object.entries(COLOR_SWATCHES)) {
      expect(wordArtKeyOf(`word:${object}`), key).toBe(object);
      expect(wordArtKeyOf(`word:${key}`), key).toBe(key);
    }
    const colorVisuals = wordRefs.filter((i) => familyOf(wordArtKeyOf(i.visual)!) === 'color').map((i) => wordArtKeyOf(i.visual));
    expect([...colorVisuals].sort()).toEqual(Object.keys(COLOR_SWATCHES).sort());
  });
});
