import { describe, expect, it } from 'vitest';
import { circle } from '../builders';
import { WORD_ART, WORD_ART_FAMILIES, WORD_ART_KEYS, WORD_ART_KEY_RE, WORD_ART_PLAN, buildRegistry, getWordArt, wordArtKeyOf } from '../registry';
import type { WordArtFamily } from '../types';

/** F-VOC-002 §3.9: the registry, its key grammar and the planned counts. */

/**
 * Families whose batch has landed: their count must equal the plan. A batch PR
 * (W-3..W-6, or W-1c for the generated families and props) adds its families
 * here; until then a family may only grow towards its plan.
 */
const COMPLETE_FAMILIES: readonly WordArtFamily[] = [];

/** The six sample glyphs of PR W-1b, one per family that has a hand-drawn sample. */
const W1B_SAMPLES = ['food-apple', 'animal-cat', 'nature-cloud', 'school-chair', 'travel-bus', 'sport-soccer'];

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
});

describe('buildRegistry', () => {
  const dot = [circle(50, 50, 20, { f: 'vocab.red' })];

  it('merges sources and fills the meta', () => {
    const reg = buildRegistry([{ 'food-a': dot }, { 'animal-b': dot }], { 'animal-b': { status: 'approved' } });
    expect(Object.keys(reg)).toEqual(['food-a', 'animal-b']);
    expect(reg['food-a']!.meta).toEqual({ family: 'food', status: 'draft' });
    expect(reg['animal-b']!.meta).toEqual({ family: 'animal', status: 'approved' });
  });

  it('throws on a duplicate key across sources', () => {
    expect(() => buildRegistry([{ 'food-a': dot }, { 'food-a': dot }], {})).toThrow(/duplicate.*food-a/i);
  });

  it('throws on a key outside the grammar', () => {
    expect(() => buildRegistry([{ 'Food-A': dot }], {})).toThrow(/key/);
    expect(() => buildRegistry([{ 'pet-dog': dot }], {})).toThrow(/key/);
  });

  it('throws on meta for a key that has no glyph', () => {
    expect(() => buildRegistry([{ 'food-a': dot }], { 'food-b': { status: 'review' } })).toThrow(/food-b/);
  });

  it('freezes what it returns', () => {
    const reg = buildRegistry([{ 'food-a': dot }], {});
    expect(Object.isFrozen(reg)).toBe(true);
    expect(Object.isFrozen(reg['food-a'])).toBe(true);
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
