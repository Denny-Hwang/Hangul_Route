import type { VocabSummary } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { VOCAB_CATALOG } from '../../../data/vocab-catalog';
import { parseVocabSummary } from '../vocab-summary';
import { consoleWord, consoleWords, studentWords } from '../vocab-words';

/**
 * F-VOC-005 P-4 (section 3.8, behaviour 14): the console reads a student's word counts and up to
 * three words to revisit from `summary.vocab`, and draws each word from the generated catalogue
 * with its romanization and its gloss in the UI language. No percent, no rate, no ranking.
 */
const vocab = (over: Partial<VocabSummary> = {}): VocabSummary => ({
  collected: 12,
  strong: 4,
  topicsStarted: 2,
  topicsPracticed7d: 1,
  firstTryRate: 0.75,
  needsPractice: [],
  ...over,
});

describe('consoleWord', () => {
  it('reads a known word: Hangul, romanization and the English gloss', () => {
    expect(consoleWord('vocab:sagwa-apple', 'en')).toEqual({ id: 'vocab:sagwa-apple', ko: '사과', romanization: 'sagwa', gloss: 'apple' });
    expect(consoleWord('vocab:nun-eye', 'en')).toEqual({ id: 'vocab:nun-eye', ko: '눈', romanization: 'nun', gloss: 'eye' });
  });

  it('glosses in the UI language when the catalogue has it, else in English', () => {
    expect(consoleWord('vocab:sagwa-apple', 'es').gloss).toBe('manzana');
    // No Korean vocabulary overlay ships yet: the Korean UI falls back to the English gloss, as the app does.
    expect(consoleWord('vocab:sagwa-apple', 'ko').gloss).toBe('apple');
    expect(consoleWord('vocab:sagwa-apple', 'en-XA').gloss).toBe('apple');
  });

  it('tells the two senses of a homonym apart by their gloss', () => {
    const eye = consoleWord('vocab:nun-eye', 'en');
    const snow = VOCAB_CATALOG.find((e) => e.ko === '눈' && e.id !== 'vocab:nun-eye');
    expect(snow).toBeDefined();
    const other = consoleWord(snow?.id ?? '', 'en');
    expect(other.ko).toBe(eye.ko);
    expect(other.gloss).not.toBe(eye.gloss);
  });

  it('shows an unknown id (a newer app) by its romanized slug, with no Hangul and no gloss', () => {
    expect(consoleWord('vocab:saeroun-mal', 'en')).toEqual({ id: 'vocab:saeroun-mal', ko: null, romanization: 'saeroun-mal', gloss: null });
    expect(consoleWord('odd', 'en')).toEqual({ id: 'odd', ko: null, romanization: 'odd', gloss: null });
  });

  it('maps a list in order', () => {
    expect(consoleWords(['vocab:nun-eye', 'vocab:sagwa-apple'], 'en').map((w) => w.romanization)).toEqual(['nun', 'sagwa']);
  });
});

describe('studentWords', () => {
  it('is null when the roster carries no summary.vocab (the line stays empty)', () => {
    expect(studentWords(null, 'en')).toBeNull();
    expect(studentWords(undefined, 'en')).toBeNull();
    expect(studentWords({}, 'en')).toBeNull();
    expect(studentWords({ vocab: undefined }, 'en')).toBeNull();
  });

  it('is null for a malformed slice rather than a wrong line', () => {
    expect(studentWords({ vocab: { collected: -1 } as unknown as VocabSummary }, 'en')).toBeNull();
    expect(studentWords({ vocab: vocab({ needsPractice: ['not-an-id', 'x', 'y', 'z'] }) }, 'en')).toBeNull();
  });

  it('reads the counts and the words to revisit, in the order the learner device sent them', () => {
    const out = studentWords({ vocab: vocab({ needsPractice: ['vocab:sagwa-apple', 'vocab:nun-eye'] }) }, 'en');
    expect(out).toEqual({
      collected: 12,
      strong: 4,
      revisit: [
        { id: 'vocab:sagwa-apple', ko: '사과', romanization: 'sagwa', gloss: 'apple' },
        { id: 'vocab:nun-eye', ko: '눈', romanization: 'nun', gloss: 'eye' },
      ],
    });
  });

  it('carries no rate, percent or day count', () => {
    const out = studentWords({ vocab: vocab() }, 'en');
    expect(out).toEqual({ collected: 12, strong: 4, revisit: [] });
    expect(Object.keys(out ?? {})).not.toContain('firstTryRate');
  });
});

describe('studentWords and parseVocabSummary agree on one reading of the slice', () => {
  it('lists a repeated word once, first-seen order kept', () => {
    const words = studentWords({ vocab: vocab({ needsPractice: ['vocab:uyu', 'vocab:sagwa-apple', 'vocab:uyu'] }) }, 'en');
    expect(words?.revisit.map((w) => w.id)).toEqual(['vocab:uyu', 'vocab:sagwa-apple']);
  });

  it('parses the slice with VocabSummarySchema and returns null for anything it rejects', () => {
    expect(parseVocabSummary(vocab({ needsPractice: ['vocab:uyu'] }))?.needsPractice).toEqual(['vocab:uyu']);
    for (const bad of [undefined, null, 'x', { needsPractice: ['vocab:uyu'] }, { ...vocab(), collected: -1 }, { ...vocab(), needsPractice: ['uyu'] }]) {
      expect(parseVocabSummary(bad)).toBeNull();
    }
  });
});

