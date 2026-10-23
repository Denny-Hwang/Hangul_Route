import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { CLOZE_FIXTURE_ROUNDS } from '../e2e-rounds';
import { startCloze, stepCloze } from '../flow';
import { clozeColumns, clozeView, hoyaLineOf } from '../view';

const a11y = getMessages('en').a11y.minigame.clozePick;
const ctx = { mode: 'quest' as const, romanizationMode: 'always' as const, a11y };
const { word, particle, value } = CLOZE_FIXTURE_ROUNDS;
const tap = (optionId: string, at: number) => ({ type: 'tap' as const, optionId, answerId: 'right', at });

describe('the Cloze Pick prompt card', () => {
  it('asking: the Korean around an empty gap, the romanization with ___, the whole meaning, no Hear it', () => {
    const view = clozeView(word, startCloze(1), ctx);
    expect(view).toEqual({
      before: '책을 ',
      after: '.',
      gapText: null,
      found: false,
      romanization: 'chaegeul ___.',
      meaning: 'I read a book.',
      label: 'Sentence: chaegeul blank. I read a book.',
      instruction: 'word',
      hoya: null,
      hearIt: false,
    });
  });

  it('found: the tile in the gap, the romanization and a value meaning complete, Hear it', () => {
    const found = stepCloze(startCloze(1), tap('right', 1)).state;
    expect(clozeView(word, found, ctx)).toMatchObject({ gapText: '읽어요', found: true, romanization: 'chaegeul ilgeoyo.', label: 'Sentence complete: chaegeul ilgeoyo. I read a book.', hearIt: true });
    expect(clozeView(particle, found, ctx)).toMatchObject({ before: '물', after: ' 마셔요.', gapText: '을', romanization: 'mureul masyeoyo.' });
    expect(clozeView(value, startCloze(1), ctx)).toMatchObject({ meaning: 'It is ___ won.', label: 'Sentence: blank wonieyo. It is blank won.', instruction: 'value' });
    expect(clozeView(value, found, ctx)).toMatchObject({ meaning: 'It is three thousand won.', gapText: '삼천' });
  });

  it('romanization in tap mode waits for the answer', () => {
    const tapMode = { ...ctx, romanizationMode: 'tap' as const };
    expect(clozeView(word, startCloze(1), tapMode).romanization).toBe('');
    expect(clozeView(word, stepCloze(startCloze(1), tap('right', 1)).state, tapMode).romanization).toBe('chaegeul ilgeoyo.');
  });
});

describe("Hoya's line", () => {
  const missed = stepCloze(startCloze(1), tap('w1', 1)).state;
  const twice = stepCloze(missed, tap('w2', 500)).state;

  it('none before a miss or after the answer', () => {
    expect(hoyaLineOf(word, startCloze(1), 'quest')).toBeNull();
    expect(hoyaLineOf(word, stepCloze(missed, tap('right', 500)).state, 'quest')).toBeNull();
  });

  it('after a miss, by the gap: the sentence, the word before it, the card', () => {
    expect(hoyaLineOf(word, missed, 'quest')).toBe('miss');
    expect(hoyaLineOf(particle, missed, 'check')).toBe('missParticle');
    expect(hoyaLineOf(value, missed, 'quest')).toBe('missValue');
  });

  it('the second miss: this one fits here (the ring)', () => {
    expect(hoyaLineOf(word, twice, 'quest')).toBe('lookHere');
  });

  it('a review session gives no per-item line', () => {
    expect(hoyaLineOf(word, missed, 'review')).toBeNull();
    expect(clozeView(word, missed, { ...ctx, mode: 'review' }).hoya).toBeNull();
  });
});

describe('tile columns', () => {
  it('two for one- or two-block tiles at any width', () => {
    expect(clozeColumns(particle, 320)).toBe(2);
    expect(clozeColumns(value, 320)).toBe(2);
  });

  it('word tiles: one column on a phone, two from the regular width', () => {
    expect(clozeColumns(word, 320)).toBe(1);
    expect(clozeColumns(word, 599)).toBe(1);
    expect(clozeColumns(word, 768)).toBe(2);
  });
});
