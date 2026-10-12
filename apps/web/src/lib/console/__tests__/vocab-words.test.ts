import type { VocabSummary } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { VOCAB_CATALOG } from '../../../data/vocab-catalog';
import { parseVocabSummary } from '../vocab-summary';
import { consoleGloss, consoleWord, consoleWords, studentWords } from '../vocab-words';

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

  it('never repeats the romanization nor nests parentheses: a gloss that opens with its own romanization keeps only its explanation', () => {
    expect(consoleWord('vocab:tteokbokki', 'en').gloss).toBe('spicy rice cakes');
    expect(consoleWord('vocab:tteokbokki', 'es').gloss).toBe('pasteles de arroz picantes');
    expect(consoleWord('vocab:chuseok', 'en').gloss).toBe('harvest festival');
    // The catalogue spells the alphabet's name the English way ("Hangul" for hangeul).
    expect(consoleWord('vocab:hangeul', 'en').gloss).toBe('the Korean alphabet');
    expect(consoleWord('vocab:hangeul', 'es').gloss).toBe('el alfabeto coreano');
  });

  it('turns any other parenthetical into a comma, so the line reads one level of brackets', () => {
    expect(consoleWord('vocab:eonni', 'en').gloss).toBe('older sister, said by a woman or girl');
    expect(consoleWord('vocab:nuna', 'es').gloss).toBe('hermana mayor, lo dice un hombre o niño');
    expect(consoleWord('vocab:chukgu', 'en').gloss).toBe('soccer, football');
    expect(consoleWord('vocab:yunnori', 'en').gloss).toBe('yut game, board game with sticks');
  });

  it('keeps a plain gloss as it is, a loanword included', () => {
    expect(consoleGloss('apple', 'sagwa')).toBe('apple');
    expect(consoleGloss('banana', 'banana')).toBe('banana');
    expect(consoleGloss('older sister (said by a woman or girl)', 'eonni')).toBe('older sister, said by a woman or girl');
    expect(consoleGloss('gimbap (seaweed rice roll)', 'gimbap')).toBe('seaweed rice roll');
    // A short head close to the romanization is not taken for it.
    expect(consoleGloss('i (tooth)', 'a')).toBe('i, tooth');
    // One letter added, dropped or changed still names the word; two or more do not.
    expect(consoleGloss('hangeul (the alphabet)', 'hangul')).toBe('the alphabet');
    expect(consoleGloss('kimchy (pickled cabbage)', 'kimchi')).toBe('pickled cabbage');
    expect(consoleGloss('hangul (the alphabet)', 'hangeuls')).toBe('hangul, the alphabet');
    expect(consoleGloss('kimbop (rice roll)', 'gimbap')).toBe('kimbop, rice roll');
    expect(consoleGloss('tteok (rice cake)', 'tteokbokki')).toBe('tteok, rice cake');
  });

  it('across the whole catalogue, in every UI language: no nested parentheses, the romanization never inside the gloss unless the gloss is the word itself', () => {
    for (const entry of VOCAB_CATALOG) {
      for (const locale of ['en', 'es', 'ko'] as const) {
        const word = consoleWord(entry.id, locale);
        const gloss = word.gloss ?? '';
        expect(gloss, entry.id).not.toMatch(/[()]/);
        if (gloss.toLowerCase() !== entry.romanization.toLowerCase()) {
          expect(gloss.toLowerCase().startsWith(`${entry.romanization.toLowerCase()} `), `${entry.id} ${locale}`).toBe(false);
        }
      }
    }
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

  it('reads a roster slice without firstTryRate, as P-4b will send it (the rate stays off the roster)', () => {
    const { firstTryRate: _rate, ...withoutRate } = vocab({ needsPractice: ['vocab:uyu'] });
    expect(parseVocabSummary(withoutRate)).toEqual({ collected: 12, strong: 4, topicsStarted: 2, topicsPracticed7d: 1, needsPractice: ['vocab:uyu'] });
    expect(studentWords({ vocab: withoutRate }, 'en')?.revisit.map((w) => w.id)).toEqual(['vocab:uyu']);
  });

  it('drops a firstTryRate that still reaches it, so no reading of the roster can show the rate', () => {
    expect(parseVocabSummary(vocab())).not.toHaveProperty('firstTryRate');
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

