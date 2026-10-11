import { checkRomanization } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { VOCAB_CATALOG } from '../vocab-catalog';

/** F-VOC-001 §3.7: the generated roster mirror for the console and the WordArt sheet. */
describe('VOCAB_CATALOG (generated from content/vocab)', () => {
  it('lists the 12 Food words so far, all in the food topic with unique ids', () => {
    expect(VOCAB_CATALOG).toHaveLength(12);
    expect(new Set(VOCAB_CATALOG.map((e) => e.id)).size).toBe(12);
    for (const entry of VOCAB_CATALOG) {
      expect(entry.topic).toBe('food');
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
