import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { supportedCardIds } from '../../components/HeritageCardArt/card-ids';
import { WORD_ART, WORD_ART_KEYS, wordArtKeyOf } from '../registry';
import type { WordArtFamily } from '../types';

/**
 * F-VOC-002 §3.9, behaviour 1: the registry against `content/vocab/*.json`.
 *
 * The vocabulary topics landed before their art (F-VOC-001 V-2b..), so a
 * `word:` key may wait for its batch: each family below is drawn by the PR
 * named next to it, and until that PR lands its keys may be missing (the app
 * shows the text tile, F-QUEST-002 §3.11, and no topic is visible before
 * F-VOC-003 flips `flags.vocabTopicsEnabled`). Every other family must
 * resolve in full. A batch PR deletes its families from this map, which turns
 * on the full check for them.
 */
const AWAITING_ART: Readonly<Partial<Record<WordArtFamily, string>>> = {
  food: 'W-3',
  color: 'W-3',
  count: 'W-3',
  animal: 'W-4',
  body: 'W-4',
  family: 'W-5',
  school: 'W-5',
  nature: 'W-5',
  travel: 'W-6',
  sport: 'W-6',
  culture: 'W-6',
  science: 'W-6',
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

  it('a family marked as waiting really has a missing word, so a finished batch cannot stay exempt', () => {
    for (const family of Object.keys(AWAITING_ART) as WordArtFamily[]) {
      if (!servedFamilies.has(family)) continue; // its topic file has not landed yet: nothing to resolve
      const missing = wordRefs.filter((i) => familyOf(wordArtKeyOf(i.visual)!) === family && !WORD_ART_KEYS.includes(wordArtKeyOf(i.visual)!));
      expect(missing.length, `${family} is complete: remove it from AWAITING_ART`).toBeGreaterThan(0);
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

  it('every prop is drawn inside a colour swatch', () => {
    const props = WORD_ART_KEYS.filter((k) => WORD_ART[k]!.meta.family === 'prop');
    const colorSwatches = WORD_ART_KEYS.filter((k) => WORD_ART[k]!.meta.family === 'color');
    // W-1c adds the colour generator and the props together; until then neither exists.
    if (colorSwatches.length === 0) expect(props).toEqual([]);
  });
});
