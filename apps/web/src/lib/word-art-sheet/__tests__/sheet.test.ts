import { WORD_ART, WORD_ART_FAMILIES, type WordArtEntry } from '@hangul-route/design-system/word-art';
import { describe, expect, it } from 'vitest';
import { VOCAB_CATALOG, type VocabCatalogEntry } from '../../../data/vocab-catalog';
import { glyphToSvgString } from '@hangul-route/design-system/word-art';
import { STATUS_LABEL, buildWordArtSheet, cardArtReuses, glyphBytes, svgBody, symbolId } from '../sheet';
import { parseTopic, topicHref } from '../topic';

const apple: WordArtEntry = { glyph: [{ t: 'circle', x: 50, y: 50, r: 30, f: 'vocab.red', s: 'text.primary', sw: 3 }], meta: { family: 'food', status: 'review' } };
const cat: WordArtEntry = { glyph: [{ t: 'circle', x: 50, y: 50, r: 30 }, { t: 'rect', x: 10, y: 10, w: 20, h: 20 }], meta: { family: 'animal', status: 'draft' } };
const leaf: WordArtEntry = { glyph: [{ t: 'path', d: 'M 10 10 L 20 20' }], meta: { family: 'prop', status: 'approved' } };
const registry = { 'food-apple': apple, 'animal-cat': cat, 'prop-leaf': leaf };
const entry = (over: Partial<VocabCatalogEntry>): VocabCatalogEntry => ({ id: 'vocab:x', ko: '사과', romanization: 'sagwa', en: 'apple', topic: 'food', visual: 'word:food-apple', glosses: { en: over.en ?? 'apple' }, ...over });
const catalog = [entry({}), entry({ id: 'vocab:bap', ko: '밥', romanization: 'bap', en: 'cooked rice', visual: 'card:rice' })];

describe('buildWordArtSheet (F-VOC-002 §3.10)', () => {
  it('makes one card per registry key, in family order, with shape count and byte size', () => {
    const sheet = buildWordArtSheet(registry, catalog);
    expect(sheet.cards.map((c) => c.key)).toEqual(['food-apple', 'animal-cat', 'prop-leaf']);
    expect(sheet.cards[0]).toMatchObject({ family: 'food', status: 'review', shapes: 1, bytes: JSON.stringify(apple.glyph).length });
    expect(sheet.cards[1]!.shapes).toBe(2);
  });

  it('reads the Korean word, romanization and gloss from the catalog entry whose visual is word:<key>', () => {
    const sheet = buildWordArtSheet(registry, catalog);
    expect(sheet.cards[0]!.words).toEqual([{ id: 'vocab:x', ko: '사과', romanization: 'sagwa', en: 'apple', topic: 'food' }]);
    expect(sheet.cards[1]!.words).toEqual([]);
    expect(sheet.cards[2]!.words).toEqual([]);
  });

  it('counts glyphs per status and per family for the totals line and the filter', () => {
    const sheet = buildWordArtSheet(registry, catalog);
    expect(sheet.totals).toEqual({ glyphs: 3, byStatus: { draft: 1, review: 1, approved: 1 } });
    expect(sheet.families).toEqual([
      { family: 'food', count: 1 },
      { family: 'animal', count: 1 },
      { family: 'prop', count: 1 },
    ]);
  });

  it('keeps the shipped registry whole: every key once, every family a known one', () => {
    const sheet = buildWordArtSheet(WORD_ART, VOCAB_CATALOG);
    expect(sheet.cards.map((c) => c.key).sort()).toEqual(Object.keys(WORD_ART).sort());
    for (const f of sheet.families) expect(WORD_ART_FAMILIES).toContain(f.family);
    expect(sheet.cards.find((c) => c.key === 'food-apple')?.words.map((w) => w.en)).toEqual(['apple']);
  });

  it('labels the three review states the way the reviewer reads them (behaviour 8)', () => {
    expect(STATUS_LABEL).toEqual({ draft: 'needs work', review: 'needs review', approved: 'approved' });
  });

  it('measures a glyph as the length of its JSON', () => {
    expect(glyphBytes(leaf.glyph)).toBe('[{"t":"path","d":"M 10 10 L 20 20"}]'.length);
  });
});

describe('cardArtReuses: the words that reuse a heritage card picture (F-VOC-002 §3.11)', () => {
  it('lists each card: visual once, in catalog order, with the words that use it', () => {
    const list = cardArtReuses([
      entry({ id: 'vocab:bap', ko: '밥', romanization: 'bap', en: 'cooked rice', topic: 'food', visual: 'card:rice' }),
      entry({}),
      entry({ id: 'vocab:dal', ko: '달', romanization: 'dal', en: 'moon', topic: 'nature', visual: 'card:moon' }),
      entry({ id: 'vocab:ssal', ko: '쌀', romanization: 'ssal', en: 'rice', topic: 'food', visual: 'card:rice' }),
    ]);
    expect(list.map((r) => r.cardId)).toEqual(['card:rice', 'card:moon']);
    expect(list[0]!.words.map((w) => w.id)).toEqual(['vocab:bap', 'vocab:ssal']);
    expect(list[1]!.words).toEqual([{ id: 'vocab:dal', ko: '달', romanization: 'dal', en: 'moon', topic: 'nature' }]);
  });

  it('finds the 13 launch reuses in the shipped catalog', () => {
    const list = cardArtReuses(VOCAB_CATALOG);
    expect(list.map((r) => r.cardId).sort()).toEqual(
      ['book', 'chuseok', 'gayageum', 'hanbok', 'kimbap', 'kimchi', 'moon', 'mountain', 'rice', 'sea', 'seollal', 'tiger', 'yutnori'].map((c) => `card:${c}`),
    );
    for (const r of list) expect(r.words.length).toBeGreaterThan(0);
  });
});

describe('parseTopic and topicHref (?topic=<family>)', () => {
  it('reads a known family from a query string', () => {
    expect(parseTopic('?topic=food', WORD_ART_FAMILIES)).toBe('food');
    expect(parseTopic('topic=animal&x=1', WORD_ART_FAMILIES)).toBe('animal');
  });

  it('ignores an unknown, empty or missing topic, and a family the sheet does not list', () => {
    expect(parseTopic('?topic=pizza', WORD_ART_FAMILIES)).toBeNull();
    expect(parseTopic('?topic=', WORD_ART_FAMILIES)).toBeNull();
    expect(parseTopic('', WORD_ART_FAMILIES)).toBeNull();
    expect(parseTopic('?other=food', WORD_ART_FAMILIES)).toBeNull();
    expect(parseTopic('?topic=science', ['food', 'animal'])).toBeNull();
  });

  it('builds the filter links, with no query for all families', () => {
    expect(topicHref('food')).toBe('/design-preview/word-art?topic=food');
    expect(topicHref(null)).toBe('/design-preview/word-art');
  });
});

describe('svgBody and symbolId: one sprite symbol per glyph and mode', () => {
  it('keeps the shapes glyphToSvgString draws and drops the outer svg element', () => {
    const svg = glyphToSvgString(apple.glyph, { size: 96 });
    const body = svgBody(svg);
    expect(body.startsWith('<circle')).toBe(true);
    expect(body).not.toContain('<svg');
    expect(svg).toContain(body);
  });

  it('throws on a string that is not one svg element', () => {
    expect(() => svgBody('<g></g>')).toThrow(/not an svg/);
  });

  it('names the colour and silhouette symbols of a key', () => {
    expect(symbolId('food-apple', false)).toBe('wa_c_food-apple');
    expect(symbolId('food-apple', true)).toBe('wa_m_food-apple');
  });

  it('never gives two drawings the same id, even for keys ending in -mono (the key pattern has no underscore)', () => {
    const keys = ['food-x', 'food-x-mono', 'food-x--mono', 'food-mono-x'];
    const ids = keys.flatMap((k) => [symbolId(k, false), symbolId(k, true)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
