import type { RuntimeVocabItem } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { VOCAB_ITEMS } from '../../../content/__generated__/vocab';
import {
  MARK_PAIR_MIN_WIDTH,
  cardLabels,
  cardsCompleteEvent,
  cardsRun,
  cardsStartEvent,
  initCardsFlash,
  markButtonsStacked,
  mayAutoplay,
  quickCheckQuestions,
  summarySpeedShown,
  type CardsA11y,
} from '../cards-view';
import { chunkTally, flashEvents, flashReducer } from '../flashcards';
import { progress, state, word } from './fixtures';

const words = (n: number): RuntimeVocabItem[] =>
  Array.from({ length: n }, (_, i) => word(`w${String(i + 1).padStart(2, '0')}`));
const slugs = (list: readonly { id: string }[]): string[] => list.map((w) => w.id.slice(6));

describe('cardsRun (section 3.1 params, section 3.5 resume)', () => {
  const items = words(12);
  const base = { size: 4, fixedOrder: false, progress: progress() };

  it('opens the suggested chunk when no chunk is given: the first with a word to meet', () => {
    const run = cardsRun(items, { ...base, progress: progress(['w01', 'w02', 'w03', 'w04'].map((s) => state(s))), params: {} });
    expect(run.index).toBe(1);
    expect(run.chunks).toHaveLength(3);
    expect(slugs(run.words)).toEqual(['w05', 'w06', 'w07', 'w08']);
    expect(run.startId).toBeNull();
  });

  it('opens the given chunk; one out of range or not a whole number falls back to the suggested one', () => {
    expect(cardsRun(items, { ...base, params: { chunk: 2 } }).index).toBe(2);
    expect(cardsRun(items, { ...base, params: { chunk: 3 } }).index).toBe(0);
    expect(cardsRun(items, { ...base, params: { chunk: -1 } }).index).toBe(0);
    expect(cardsRun(items, { ...base, params: { chunk: 1.5 } }).index).toBe(0);
  });

  it('startId (a collected wall tile) puts that word first and keeps the rest in chunk order', () => {
    const run = cardsRun(items, { ...base, params: { chunk: 1, startId: 'vocab:w07' } });
    expect(slugs(run.words)).toEqual(['w07', 'w05', 'w06', 'w08']);
    expect(run.startId).toBe('vocab:w07');
  });

  it('inOrder keeps the run in chunk (or ids) order when startId moves a word first (the quick check pads from it)', () => {
    expect(slugs(cardsRun(items, { ...base, params: { chunk: 1, startId: 'vocab:w07' } }).inOrder)).toEqual(['w05', 'w06', 'w07', 'w08']);
    expect(slugs(cardsRun(items, { ...base, params: { ids: ['vocab:w03', 'vocab:w04'], startId: 'vocab:w04' } }).inOrder)).toEqual(['w03', 'w04']);
  });

  it('a startId outside the chunk is ignored', () => {
    const run = cardsRun(items, { ...base, params: { chunk: 0, startId: 'vocab:w09' } });
    expect(slugs(run.words)).toEqual(['w01', 'w02', 'w03', 'w04']);
    expect(run.startId).toBeNull();
  });

  it('ids: only those words, in that order, once each, as one run outside the chunks (index -1)', () => {
    const run = cardsRun(items, { ...base, params: { ids: ['vocab:w09', 'vocab:w02', 'vocab:nope', 'vocab:w09'], chunk: 0 } });
    expect(slugs(run.words)).toEqual(['w09', 'w02']);
    expect(run.index).toBe(-1);
    expect(run.chunks).toHaveLength(3);
  });

  it('ids with no word of the topic falls back to the chunks', () => {
    const run = cardsRun(items, { ...base, params: { ids: ['vocab:nope'] } });
    expect(run.index).toBe(0);
    expect(slugs(run.words)).toEqual(['w01', 'w02', 'w03', 'w04']);
  });

  it('ids with a startId among them puts it first', () => {
    const run = cardsRun(items, { ...base, params: { ids: ['vocab:w03', 'vocab:w04'], startId: 'vocab:w04' } });
    expect(slugs(run.words)).toEqual(['w04', 'w03']);
  });

  it('an empty topic is one empty run', () => {
    const run = cardsRun([], { ...base, params: {} });
    expect(run.words).toEqual([]);
    expect(run.chunks).toEqual([]);
    expect(run.index).toBe(0);
  });
});

describe('initCardsFlash', () => {
  it('without a start word: the first card, front face', () => {
    const s = initCardsFlash(words(4), null);
    expect(s.index).toBe(0);
    expect(s.face).toBe('front');
    expect(s.flipped.size).toBe(0);
  });

  it('with a start word (already collected): its back, counted as turned, so nothing is written again', () => {
    const s = initCardsFlash(words(4), 'vocab:w01');
    expect(s.face).toBe('back');
    expect([...s.flipped]).toEqual(['vocab:w01']);
    expect(flashEvents(s, 'got-it')).toEqual([{ type: 'self', id: 'vocab:w01', known: true }]);
    const next = flashReducer(s, 'got-it');
    expect(next.index).toBe(1);
    expect(next.face).toBe('front');
    // Collected before the chunk opened, so it is not newly collected.
    expect(chunkTally(next, new Set(['vocab:w01'])).newlyCollected).toBe(0);
  });

  it('a start word that is not the first card is ignored', () => {
    expect(initCardsFlash(words(4), 'vocab:w02').face).toBe('front');
  });
});

const A11Y: CardsA11y = {
  koreanItem: (i) => (i.gloss === undefined ? `Korean: ${i.ko}, ${i.romanization}` : `Korean: ${i.ko}, ${i.romanization}, ${i.gloss}`),
  cards: {
    word: (ko) => `Korean: ${ko}`,
    front: (w) => `${w}. Show meaning.`,
    back: (w, g) => `${w}, ${g}. Show word.`,
    turnedBack: (w, g) => `Meaning: ${g}. ${w}.`,
    turnedFront: (w) => `Back to the word. ${w}.`,
  },
};

describe('cardLabels (FlipCard spec: the labels carry the word, the back the word and its meaning)', () => {
  const sagwa = { ko: 'sa-gwa', romanization: 'sagwa', gloss: 'apple' };

  it('names the word with its romanization when it is shown', () => {
    expect(cardLabels(sagwa, true, A11Y)).toEqual({
      front: 'Korean: sa-gwa, sagwa. Show meaning.',
      back: 'Korean: sa-gwa, sagwa, apple. Show word.',
      turnedBack: 'Meaning: apple. Korean: sa-gwa, sagwa.',
      turnedFront: 'Back to the word. Korean: sa-gwa, sagwa.',
    });
  });

  it('leaves the romanization out of every name while reading practice hides it', () => {
    const labels = cardLabels(sagwa, false, A11Y);
    expect(labels.front).toBe('Korean: sa-gwa. Show meaning.');
    expect(labels.back).toBe('Korean: sa-gwa, apple. Show word.');
    for (const label of Object.values(labels)) expect(label).not.toContain('sagwa');
  });
});

describe('mayAutoplay (T6, F-AUDIO-004 section 3.6)', () => {
  const ok = { canPlay: true, unlocked: true, screenReader: false, played: false };
  it('plays a new front once when sound may play and no screen reader is on', () => {
    expect(mayAutoplay(ok)).toBe(true);
  });
  it.each([
    ['no voice or sound off', { canPlay: false }],
    ['before the first gesture (a deep link)', { unlocked: false }],
    ['a screen reader is on', { screenReader: true }],
    ['the screen reader check has not answered', { screenReader: null }],
    ['it already played for this showing', { played: true }],
  ] as const)('stays quiet when %s', (_, change) => {
    expect(mayAutoplay({ ...ok, ...change })).toBe(false);
  });
});

describe('quickCheckQuestions (section 3.5 quick check)', () => {
  const food = VOCAB_ITEMS.filter((item) => item.topics.includes('food'));
  const chunk = food.slice(0, 4);
  const input = { chunk, again: new Set<string>(), universe: food, optionCount: 4 as const, levelOrder: 1 as const, seed: 3, canRender: () => true };

  it('two word-to-picture questions on the first words of the chunk, options from the same topic', () => {
    const qs = quickCheckQuestions(input);
    expect(qs).toHaveLength(2);
    expect(qs.map((q) => q.itemId)).toEqual([chunk[0]!.id, chunk[1]!.id]);
    for (const q of qs) {
      expect(q.format).toBe('word-to-image');
      expect(q.options).toHaveLength(4);
      for (const o of q.options) expect(food.some((f) => f.id === o.id)).toBe(true);
    }
  });

  it('the Show-me-again words come first, in chunk order', () => {
    const qs = quickCheckQuestions({ ...input, again: new Set([chunk[3]!.id, chunk[2]!.id]) });
    expect(qs.map((q) => q.itemId)).toEqual([chunk[2]!.id, chunk[3]!.id]);
  });

  it('three options at the Pictures-first level', () => {
    const qs = quickCheckQuestions({ ...input, optionCount: 3, levelOrder: 0 });
    expect(qs.every((q) => q.options.length === 3)).toBe(true);
  });

  it('is skipped (no question) when the topic cannot build two picture questions', () => {
    expect(quickCheckQuestions({ ...input, universe: food.slice(0, 3) })).toEqual([]);
    expect(quickCheckQuestions({ ...input, chunk: chunk.slice(0, 1) })).toEqual([]);
    expect(quickCheckQuestions({ ...input, canRender: () => false })).toEqual([]);
    expect(quickCheckQuestions({ ...input, chunk: [], universe: [] })).toEqual([]);
  });

  it('never falls back to another format: no picture options means no check', () => {
    const own = new Set(chunk.slice(0, 2).map((w) => w.visual));
    expect(quickCheckQuestions({ ...input, canRender: (ref) => own.has(ref) })).toEqual([]);
  });

  it('leaves a word whose picture does not draw out of the check', () => {
    const qs = quickCheckQuestions({ ...input, canRender: (ref) => ref !== chunk[0]!.visual });
    expect(qs.map((q) => q.itemId)).toEqual([chunk[1]!.id, chunk[2]!.id]);
  });
});

describe('telemetry payloads (section 3.7)', () => {
  it('vocab.cards.start carries the chunk, the counts and the level order, never an age', () => {
    expect(cardsStartEvent({ topicKey: 'food', chunk: 1, chunks: 3, words: 4, level: 0 })).toEqual({
      name: 'vocab.cards.start',
      payload: { topicKey: 'food', chunk: 1, chunks: 3, words: 4, level: 0 },
    });
    expect(cardsStartEvent({ topicKey: 'food', chunk: -1, chunks: 3, words: 2, level: null }).payload.level).toBeNull();
  });

  it('vocab.cards.complete carries the tally and the quick check counts', () => {
    const tally = { words: 4, gotIt: 3, again: 1, heard: 2, newlyCollected: 4 };
    expect(cardsCompleteEvent({ topicKey: 'food', chunk: 0, tally, checkFirstTry: 1, checkQuestions: 2 })).toEqual({
      name: 'vocab.cards.complete',
      payload: { topicKey: 'food', chunk: 0, words: 4, gotIt: 3, again: 1, heard: 2, newlyCollected: 4, checkFirstTry: 1, checkQuestions: 2 },
    });
  });
});

describe('summarySpeedShown (section 3.5 summary)', () => {
  it('only when the Speed round screen exists and the learner has as many words as the options', () => {
    expect(summarySpeedShown({ speedScreen: true, collected: 4, optionCount: 4 })).toBe(true);
    expect(summarySpeedShown({ speedScreen: true, collected: 3, optionCount: 3 })).toBe(true);
    expect(summarySpeedShown({ speedScreen: true, collected: 3, optionCount: 4 })).toBe(false);
    expect(summarySpeedShown({ speedScreen: false, collected: 12, optionCount: 4 })).toBe(false);
  });
});

describe('markButtonsStacked', () => {
  it('side by side from the measured fit, stacked below it and at large text', () => {
    expect(markButtonsStacked(MARK_PAIR_MIN_WIDTH, 1)).toBe(false);
    expect(markButtonsStacked(MARK_PAIR_MIN_WIDTH - 1, 1)).toBe(true);
    expect(markButtonsStacked(288, 1)).toBe(true);
    expect(markButtonsStacked(MARK_PAIR_MIN_WIDTH, 1.5)).toBe(true);
    expect(markButtonsStacked(MARK_PAIR_MIN_WIDTH * 2, 2)).toBe(false);
    expect(markButtonsStacked(MARK_PAIR_MIN_WIDTH, 0.8)).toBe(false);
  });
});
