import { VOCAB_TOPIC_KEYS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../__generated__/vocab';

/**
 * F-VOC-001 §5: the generated module the app bundles holds the whole launch
 * set of §3.4, so a generator change that drops, duplicates or re-pictures a
 * word fails here even when the JSON suites pass.
 */
describe('__generated__/vocab.ts (F-VOC-001 §3.4 counts)', () => {
  it('has the twelve launch topics, once each, in their order 1..12', () => {
    expect(VOCAB_TOPICS.map((t) => t.key).sort()).toEqual([...VOCAB_TOPIC_KEYS].sort());
    expect(VOCAB_TOPICS.map((t) => t.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('has 12 items in every topic (by primary topic)', () => {
    for (const key of VOCAB_TOPIC_KEYS) {
      expect(VOCAB_ITEMS.filter((i) => i.topics[0] === key), key).toHaveLength(12);
    }
  });

  it('has 144 unique ids', () => {
    expect(VOCAB_ITEMS).toHaveLength(144);
    expect(new Set(VOCAB_ITEMS.map((i) => i.id)).size).toBe(144);
  });

  it('pictures every word with card: or word: art', () => {
    for (const item of VOCAB_ITEMS) expect(item.visual, item.id).toMatch(/^(card|word):/);
  });

  it('has 13 card pictures and 131 word pictures: 95 hand-drawn glyphs and 36 generated (colours, counts, body)', () => {
    const word = VOCAB_ITEMS.filter((i) => i.visual.startsWith('word:'));
    const generated = word.filter((i) => /^word:(color|count|body)-/.test(i.visual));
    expect(VOCAB_ITEMS.filter((i) => i.visual.startsWith('card:'))).toHaveLength(13);
    expect(word).toHaveLength(131);
    expect(generated).toHaveLength(36);
    expect(word.length - generated.length).toBe(95);
  });
});
