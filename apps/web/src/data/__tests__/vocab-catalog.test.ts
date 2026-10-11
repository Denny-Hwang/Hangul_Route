import { checkRomanization } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { VOCAB_CATALOG } from '../vocab-catalog';

/** F-VOC-001 §3.7: the generated roster mirror for the console and the WordArt sheet. */
describe('VOCAB_CATALOG (generated from content/vocab)', () => {
  it('lists 12 words in each of the four topics so far (food, animals, colors, numbers), with unique ids', () => {
    expect(VOCAB_CATALOG).toHaveLength(48);
    expect(new Set(VOCAB_CATALOG.map((e) => e.id)).size).toBe(48);
    for (const topic of ['food', 'animals', 'colors', 'numbers']) {
      expect(VOCAB_CATALOG.filter((e) => e.topic === topic), topic).toHaveLength(12);
    }
    for (const entry of VOCAB_CATALOG) {
      expect(entry.id).toMatch(/^vocab:[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('carries a picture ref of the card: or word: grammar on every entry', () => {
    for (const entry of VOCAB_CATALOG) expect(entry.visual).toMatch(/^(card|word):[a-z0-9-]+$/);
  });

  it('keeps every romanization equal to the converter output for its Korean word', () => {
    for (const entry of VOCAB_CATALOG) {
      expect(checkRomanization(entry.ko, entry.romanization), entry.id).toEqual([]);
    }
  });
});
