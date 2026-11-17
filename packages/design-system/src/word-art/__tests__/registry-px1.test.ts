import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { supportedCardIds } from '../../components/HeritageCardArt/card-ids';
import { WORD_ART, getWordArt } from '../registry';
import type { WordArtGlyph } from '../types';
import { fillTones, subjectBox } from './glyph-checks';

/**
 * AMENDMENTS-PICTURES-2026-11 row PX-1: the 13 vocabulary words that borrowed
 * a heritage card as their picture have a glyph of their own (rule R6), and
 * five glyphs that were too abstract carry a second cue. All 18 are `review`:
 * the owner or a teacher has not looked at the sheet yet (the amendment's
 * section 5). What a picture must show to be named is asserted on its data,
 * so a later edit cannot quietly turn the kimchi back into a bowl.
 */
const NEW_KEYS: Readonly<Record<string, string>> = {
  'food-rice': 'card:rice',
  'food-kimchi': 'card:kimchi',
  'food-kimbap': 'card:kimbap',
  'animal-tiger': 'card:tiger',
  'school-book': 'card:book',
  'nature-mountain': 'card:mountain',
  'nature-sea': 'card:sea',
  'nature-moon': 'card:moon',
  'culture-hanbok': 'card:hanbok',
  'culture-seollal': 'card:seollal',
  'culture-chuseok': 'card:chuseok',
  'culture-yutnori': 'card:yutnori',
  'culture-gayageum': 'card:gayageum',
};
const REDRAWN = ['food-egg', 'food-tteok', 'science-shadow', 'science-seed', 'nature-cloud'];

const VOCAB_DIR = join(__dirname, '..', '..', '..', '..', '..', 'content', 'vocab');
const visuals = readdirSync(VOCAB_DIR)
  .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
  .flatMap((name) => (JSON.parse(readFileSync(join(VOCAB_DIR, name), 'utf8')) as { items: { visual: string }[] }).items.map((i) => i.visual));

const glyph = (key: string): WordArtGlyph => getWordArt(key)!;
const fills = (key: string): string[] => glyph(key).flatMap((s) => (s.f === undefined ? [] : [s.f]));
const count = (key: string, tone: string): number => fills(key).filter((f) => f === tone).length;
const size = (key: string): { w: number; h: number } => {
  const b = subjectBox(glyph(key));
  return { w: b.maxX - b.minX, h: b.maxY - b.minY };
};

describe('batch PX-1: the borrowed words get glyphs', () => {
  it.each(Object.keys(NEW_KEYS))('%s is registered, in review, with no waiver', (key) => {
    expect(WORD_ART[key]?.meta).toEqual({ family: key.split('-')[0], status: 'review' });
  });

  it.each(Object.entries(NEW_KEYS))('word:%s is the picture of one word, and no word uses %s any more', (key, card) => {
    expect(visuals.filter((v) => v === `word:${key}`)).toHaveLength(1);
    expect(visuals).not.toContain(card);
    // the card itself stays a collectible with its drawing
    expect(supportedCardIds).toContain(card);
  });

  it('no vocabulary word has a card: visual (rule R6)', () => {
    expect(visuals.filter((v) => v.startsWith('card:'))).toEqual([]);
  });

  it.each(REDRAWN)('%s is redrawn and back in review', (key) => {
    expect(WORD_ART[key]?.meta).toEqual({ family: key.split('-')[0], status: 'review' });
  });
});

describe('batch PX-1: what each picture shows', () => {
  it('kimchi is a napa cabbage, not a bowl: red leaves, white ribs fanning from a white stem, green leaf tips, a plate', () => {
    expect(count('food-kimchi', 'vocab.red')).toBeGreaterThanOrEqual(1);
    expect(fills('food-kimchi')).toContain('vocab.green');
    // the plate, the stem end, four ribs
    expect(count('food-kimchi', 'vocab.white')).toBeGreaterThanOrEqual(6);
    // lying down: wider than tall, where the rice bowl is taller than wide (told by shape, R3)
    expect(size('food-kimchi').w).toBeGreaterThan(size('food-kimchi').h * 1.2);
    expect(size('food-rice').h).toBeGreaterThan(size('food-rice').w * 1.2);
    // never the feedback red, and no ramyeon-style steam over it
    expect(glyph('food-kimchi').some((s) => s.s === 'border.strong')).toBe(false);
  });

  it('rice is white rice heaped over a bowl, with steam; kimbap shows its fillings in a seaweed ring', () => {
    expect(fills('food-rice')).toContain('vocab.white');
    expect(glyph('food-rice').filter((s) => s.s === 'border.strong')).toHaveLength(2);
    for (const tone of ['vocab.white', 'vocab.yellow', 'vocab.orange', 'vocab.green']) expect(count('food-kimbap', tone)).toBe(4);
    expect(count('food-kimbap', 'text.primary')).toBe(5);
  });

  it('the tiger wears Hoya gold with ink stripes and round ears, and is a face like the other animals', () => {
    expect(fills('animal-tiger')).toContain('hoya.fur');
    expect(count('animal-tiger', 'text.primary')).toBeGreaterThanOrEqual(7 + 2);
    expect(glyph('animal-tiger').filter((s) => s.t === 'circle' && s.f === 'hoya.fur')).toHaveLength(2);
  });

  it('the sea has no boat: three bands of water and a sun; the moon is a crescent, not a disc', () => {
    expect(fills('nature-sea').filter((f) => f === 'vocab.blue' || f === 'vocab.skyBlue')).toHaveLength(3);
    expect(fills('nature-sea')).not.toContain('vocab.brown');
    expect(glyph('nature-moon').some((s) => s.t === 'circle' && s.f === 'vocab.yellow')).toBe(false);
    expect(glyph('nature-moon').some((s) => s.t === 'path' && s.f === 'vocab.yellow')).toBe(true);
    expect(glyph('culture-chuseok').some((s) => s.t === 'circle' && s.f === 'vocab.yellow')).toBe(true);
  });

  it('the mountain has a snow cap; the book lies open with two pages', () => {
    expect(fills('nature-mountain')).toContain('vocab.white');
    expect(count('school-book', 'vocab.white')).toBe(2);
  });

  it('chuseok is songpyeon under the full moon; the yut game has its board of 29 stations and four sticks', () => {
    expect(fills('culture-chuseok').filter((f) => f === 'vocab.pink' || f === 'vocab.green')).toHaveLength(3);
    const stations = glyph('culture-yutnori').find((s) => s.t === 'path' && s.f === 'text.primary');
    expect(stations?.t === 'path' ? stations.d.split('Z').length - 1 : 0).toBe(29);
    expect(count('culture-yutnori', 'vocab.brown') + count('culture-yutnori', 'feedback.nudgeLight') - 1).toBe(4);
  });

  it('the gayageum has a bridge under every string and its tail cords; the hanbok has its tie and collar', () => {
    const white = glyph('culture-gayageum').filter((s) => s.f === 'vocab.white');
    expect(white.filter((s) => s.t === 'path')).toHaveLength(4);
    expect(white.filter((s) => s.t === 'circle')).toHaveLength(4);
    expect(count('culture-hanbok', 'vocab.white')).toBe(2);
    expect(count('culture-hanbok', 'vocab.blue')).toBe(5);
  });

  it('the five cues: a fried egg beside the egg, layered rice cake, a person with a shadow, three seeds, a tinted cloud', () => {
    expect(fills('food-egg')).toEqual(expect.arrayContaining(['brand.primaryLight', 'vocab.white', 'vocab.yellow']));
    for (const tone of ['vocab.pink', 'vocab.yellow', 'vocab.green']) expect(count('food-tteok', tone)).toBe(2);
    expect(fills('science-shadow')).toEqual(expect.arrayContaining(['vocab.gray', 'vocab.yellow', 'surface.paper']));
    expect(count('science-seed', 'vocab.brown')).toBe(3);
    expect(fills('nature-cloud')).toEqual(expect.arrayContaining(['brand.secondaryLight']));
    expect(fills('nature-cloud')).not.toContain('surface.paper');
    // no sky patch behind it: that is nature-sky (told by shape, R3)
    expect(glyph('nature-cloud').some((s) => s.f === 'vocab.skyBlue')).toBe(false);
  });

  it('every one of the 18 stays within four fill tones', () => {
    for (const key of [...Object.keys(NEW_KEYS), ...REDRAWN]) expect(fillTones(glyph(key)).length, key).toBeLessThanOrEqual(4);
  });
});
