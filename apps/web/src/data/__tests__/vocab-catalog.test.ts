import { checkRomanization } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { consoleWord } from '../../lib/console/vocab-words';
import { VOCAB_CATALOG } from '../vocab-catalog';

/** F-VOC-001 §3.7: the generated roster mirror for the console and the WordArt sheet. */
describe('VOCAB_CATALOG (generated from content/vocab)', () => {
  it('lists 12 words in each of the twelve launch topics, with unique ids', () => {
    expect(VOCAB_CATALOG).toHaveLength(144);
    expect(new Set(VOCAB_CATALOG.map((e) => e.id)).size).toBe(144);
    for (const topic of ['food', 'animals', 'colors', 'numbers', 'family', 'school', 'body', 'nature', 'travel', 'sports', 'k-culture', 'science']) {
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

/** F-VOC-005 P-4 (section 3.8): the console reads its words to revisit from this catalogue. */
describe('VOCAB_CATALOG lookup for the console', () => {
  it('carries the English gloss on every entry, and a Spanish one from the overlay', () => {
    for (const entry of VOCAB_CATALOG) {
      expect(entry.glosses.en, entry.id).toBe(entry.en);
      expect(entry.glosses.es, entry.id).toMatch(/\S/);
    }
  });

  it('finds a known id with its Hangul, romanization and gloss', () => {
    expect(consoleWord('vocab:sagwa-apple', 'en')).toEqual({ id: 'vocab:sagwa-apple', ko: '사과', romanization: 'sagwa', gloss: 'apple' });
    for (const entry of VOCAB_CATALOG) expect(consoleWord(entry.id, 'en'), entry.id).toEqual({ id: entry.id, ko: entry.ko, romanization: entry.romanization, gloss: entry.en });
  });

  it('shows an unknown id by its romanized slug, with no Hangul', () => {
    expect(consoleWord('vocab:mirae-future', 'en')).toEqual({ id: 'vocab:mirae-future', ko: null, romanization: 'mirae-future', gloss: null });
  });
});
