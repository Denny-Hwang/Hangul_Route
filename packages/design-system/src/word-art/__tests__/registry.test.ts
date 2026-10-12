import { describe, expect, it } from 'vitest';
import { circle } from '../builders';
import { COLOR_SWATCHES, colorGlyphs } from '../generated/color';
import { COUNT_VALUES, count } from '../generated/count';
import { fillTones } from './glyph-checks';
import { WORD_ART, WORD_ART_FAMILIES, WORD_ART_KEYS, WORD_ART_KEY_RE, WORD_ART_PLAN, buildRegistry, getWordArt, wordArtKeyOf } from '../registry';
import type { WordArtFamily } from '../types';

/** F-VOC-002 §3.9: the registry, its key grammar and the planned counts. */

/**
 * Families whose batch has landed: their count must equal the plan. A batch PR
 * (W-3..W-6, or W-1c for the generated families and props) adds its families
 * here; until then a family may only grow towards its plan.
 */
const COMPLETE_FAMILIES: readonly WordArtFamily[] = ['prop', 'food', 'color', 'count', 'family', 'school', 'nature'];

/** The six sample glyphs of PR W-1b, one per family that has a hand-drawn sample. */
const W1B_SAMPLES = ['food-apple', 'animal-cat', 'nature-cloud', 'school-chair', 'travel-bus', 'sport-soccer'];

/** The four colour-swatch props of PR W-1c (§3.6.1). */
const W1C_PROPS = ['prop-tangerine', 'prop-leaf', 'prop-grapes', 'prop-crow'];

/**
 * Batch W-3 (§3.12): the eight other food glyphs and the four colour-swatch
 * objects of later families, drawn by hand; the twelve colours and twelve
 * counts, generated.
 */
const W3_HAND = [
  'food-banana',
  'food-milk',
  'food-bread',
  'food-ramyeon',
  'food-water',
  'food-egg',
  'food-strawberry',
  'food-tteok',
  'animal-bear',
  'animal-elephant',
  'nature-flower',
];
const W3_COLORS = Object.keys(COLOR_SWATCHES);
const W3_COUNTS = COUNT_VALUES.map((n) => `count-${n}`);

describe('key grammar', () => {
  it('is the spec regex over the thirteen families', () => {
    expect(WORD_ART_KEY_RE.source).toBe('^(food|animal|family|school|nature|travel|sport|culture|science|color|count|body|prop)-[a-z0-9-]+$');
    expect(WORD_ART_FAMILIES).toEqual(['food', 'animal', 'family', 'school', 'nature', 'travel', 'sport', 'culture', 'science', 'color', 'count', 'body', 'prop']);
  });

  it('every registered key matches it', () => {
    for (const key of WORD_ART_KEYS) expect(key).toMatch(WORD_ART_KEY_RE);
  });
});

describe('WORD_ART', () => {
  it('holds the six W-1b samples', () => {
    expect(WORD_ART_KEYS).toEqual(expect.arrayContaining(W1B_SAMPLES));
  });

  it('keys are unique and WORD_ART_KEYS lists exactly the registry', () => {
    expect(new Set(WORD_ART_KEYS).size).toBe(WORD_ART_KEYS.length);
    expect([...WORD_ART_KEYS].sort()).toEqual(Object.keys(WORD_ART).sort());
  });

  it('meta.family is the key prefix and every glyph has a review status', () => {
    for (const key of WORD_ART_KEYS) {
      const { meta } = WORD_ART[key]!;
      expect(meta.family).toBe(key.split('-')[0]);
      expect(['draft', 'review', 'approved']).toContain(meta.status);
    }
  });

  it('a waiver always carries its reason', () => {
    for (const key of WORD_ART_KEYS) {
      const { meta } = WORD_ART[key]!;
      if ((meta.maxTones !== undefined && meta.maxTones > 4) || meta.bboxWaived) expect(meta.reason, key).toMatch(/\S/);
    }
  });

  it('the W-1b samples wait for the owner (status review)', () => {
    for (const key of W1B_SAMPLES) expect(WORD_ART[key]!.meta.status).toBe('review');
  });

  it('holds the four W-1c props, waiting for the owner (status review)', () => {
    for (const key of W1C_PROPS) expect(WORD_ART[key]?.meta, key).toEqual({ family: 'prop', status: 'review' });
  });
});

describe('batch W-3 (§3.12)', () => {
  it('holds the eleven hand glyphs, waiting for the owner (status review)', () => {
    for (const key of W3_HAND) expect(WORD_ART[key]?.meta, key).toEqual({ family: key.split('-')[0], status: 'review' });
  });

  it('registers the twelve colour swatches as the generator draws them from the registered objects', () => {
    const expected = colorGlyphs(getWordArt);
    expect(W3_COLORS).toHaveLength(12);
    for (const key of W3_COLORS) expect(getWordArt(key), key).toEqual(expected[key]);
  });

  it('gives every swatch the size waiver with its reason, and no tone waiver, waiting for review', () => {
    for (const key of W3_COLORS) {
      expect(WORD_ART[key]!.meta, key).toEqual({ family: 'color', status: 'review', bboxWaived: true, reason: expect.stringMatching(/88 of 100/) as unknown as string });
    }
  });

  it('grants a tone waiver (maxTones) only where the glyph really needs a fifth fill tone (§3.3)', () => {
    for (const key of WORD_ART_KEYS) {
      const { glyph, meta } = WORD_ART[key]!;
      if (meta.maxTones !== undefined) expect(fillTones(glyph).length, key).toBeGreaterThan(4);
    }
  });

  it('draws every swatch object from a registered hand family, never a generated one', () => {
    const generated = new Set(['color', 'count', 'body']);
    for (const [key, { object }] of Object.entries(COLOR_SWATCHES)) {
      expect(generated.has(object.split('-')[0]!), `${key} draws ${object}`).toBe(false);
      expect(WORD_ART[object]?.meta.status, `${key} needs ${object}`).toBe('review');
    }
  });

  it('starts every registered swatch with the square in its own vocab tone (independent of the generator)', () => {
    const tones: Record<string, string> = {
      'color-red': 'vocab.red',
      'color-orange': 'vocab.orange',
      'color-yellow': 'vocab.yellow',
      'color-green': 'vocab.green',
      'color-blue': 'vocab.blue',
      'color-purple': 'vocab.purple',
      'color-skyblue': 'vocab.skyBlue',
      'color-brown': 'vocab.brown',
      'color-gray': 'vocab.gray',
      'color-white': 'vocab.white',
      'color-black': 'vocab.black',
      'color-pink': 'vocab.pink',
    };
    expect(Object.keys(tones).sort()).toEqual([...W3_COLORS].sort());
    for (const [key, tone] of Object.entries(tones)) {
      expect(getWordArt(key)?.[0], key).toEqual({ t: 'rect', x: 6, y: 6, w: 88, h: 88, r: 14, f: tone, s: 'text.primary', sw: 3 });
    }
  });

  it('registers the twelve counts as the ten-frame generator draws them, waiting for review', () => {
    expect(W3_COUNTS).toHaveLength(12);
    for (const n of COUNT_VALUES) {
      expect(getWordArt(`count-${n}`), String(n)).toEqual(count(n));
      expect(WORD_ART[`count-${n}`]!.meta).toEqual({ family: 'count', status: 'review' });
    }
  });

  it('waives the frame size only for the colour swatches', () => {
    const waived = WORD_ART_KEYS.filter((k) => WORD_ART[k]!.meta.bboxWaived === true);
    expect(waived.sort()).toEqual([...W3_COLORS].sort());
  });
});

describe('planned counts (§3.8, §5)', () => {
  it('matches the spec table', () => {
    expect(WORD_ART_PLAN).toEqual({ food: 9, animal: 11, family: 12, school: 11, nature: 9, travel: 12, sport: 12, culture: 7, science: 12, color: 12, count: 12, body: 12, prop: 4 });
    expect(Object.values(WORD_ART_PLAN).reduce((a, b) => a + b, 0)).toBe(135);
  });

  it.each(WORD_ART_FAMILIES)('%s never exceeds its plan, and equals it once its batch has landed', (family) => {
    const count = WORD_ART_KEYS.filter((k) => WORD_ART[k]!.meta.family === family).length;
    if (COMPLETE_FAMILIES.includes(family)) expect(count).toBe(WORD_ART_PLAN[family]);
    else expect(count).toBeLessThanOrEqual(WORD_ART_PLAN[family]);
  });

  it.each(WORD_ART_FAMILIES)('%s is listed in COMPLETE_FAMILIES as soon as it reaches its plan', (family) => {
    const count = WORD_ART_KEYS.filter((k) => WORD_ART[k]!.meta.family === family).length;
    if (count === WORD_ART_PLAN[family]) expect(COMPLETE_FAMILIES, `${family} is complete: add it to COMPLETE_FAMILIES`).toContain(family);
  });
});

describe('buildRegistry', () => {
  const dot = [circle(50, 50, 20, { f: 'vocab.red' })];

  it('merges sources and fills the meta', () => {
    const reg = buildRegistry([['food', { 'food-a': dot }], ['animal', { 'animal-b': dot }]], { 'animal-b': { status: 'approved' } });
    expect(Object.keys(reg)).toEqual(['food-a', 'animal-b']);
    expect(reg['food-a']!.meta).toEqual({ family: 'food', status: 'draft' });
    expect(reg['animal-b']!.meta).toEqual({ family: 'animal', status: 'approved' });
  });

  it('throws on a duplicate key across sources', () => {
    expect(() => buildRegistry([['food', { 'food-a': dot }], ['food', { 'food-a': dot }]], {})).toThrow(/duplicate.*food-a/i);
  });

  it('throws on a key outside the grammar', () => {
    expect(() => buildRegistry([['food', { 'Food-A': dot }]], {})).toThrow(/key/);
    expect(() => buildRegistry([['animal', { 'pet-dog': dot }]], {})).toThrow(/key/);
  });

  it('throws on meta for a key that has no glyph', () => {
    expect(() => buildRegistry([['food', { 'food-a': dot }]], { 'food-b': { status: 'review' } })).toThrow(/food-b/);
  });

  it('throws on a key filed under another family', () => {
    expect(() => buildRegistry([['food', { 'animal-bear': dot }]], {})).toThrow(/animal-bear.*food/);
  });

  it('freezes what it returns, down to every shape, without freezing the source', () => {
    const source = { 'food-a': [circle(50, 50, 20, { f: 'vocab.red' })] };
    const reg = buildRegistry([['food', source]], {});
    expect(Object.isFrozen(reg)).toBe(true);
    expect(Object.isFrozen(reg['food-a'])).toBe(true);
    expect(Object.isFrozen(reg['food-a']!.glyph)).toBe(true);
    expect(Object.isFrozen(reg['food-a']!.meta)).toBe(true);
    expect(reg['food-a']!.glyph.every((shape) => Object.isFrozen(shape))).toBe(true);
    expect(Object.isFrozen(source['food-a'][0])).toBe(false);
  });

  it('the shared registry cannot be repainted by a caller', () => {
    const shape = getWordArt('food-apple')![0]!;
    expect(() => {
      (shape as { f?: string }).f = 'feedback.success';
    }).toThrow(TypeError);
    expect(WORD_ART['food-apple']!.glyph.every((s) => Object.isFrozen(s))).toBe(true);
  });
});

describe('getWordArt and wordArtKeyOf', () => {
  it('getWordArt returns the glyph for a key, undefined otherwise', () => {
    expect(getWordArt('food-apple')).toBe(WORD_ART['food-apple']!.glyph);
    expect(getWordArt('food-unknown')).toBeUndefined();
    expect(getWordArt('word:food-apple')).toBeUndefined();
    expect(getWordArt('constructor')).toBeUndefined();
  });

  it('wordArtKeyOf strips word: and refuses other refs', () => {
    expect(wordArtKeyOf('word:food-apple')).toBe('food-apple');
    expect(wordArtKeyOf('card:rice')).toBeNull();
    expect(wordArtKeyOf('swatch:red')).toBeNull();
    expect(wordArtKeyOf('word:')).toBeNull();
    expect(wordArtKeyOf('word:Food Apple')).toBeNull();
    expect(wordArtKeyOf('food-apple')).toBeNull();
  });
});
