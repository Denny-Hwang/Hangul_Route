import { describe, expect, it } from 'vitest';
import { FIXTURE_CHAIN } from '../e2e-chain';
import { pageLine, storyLines } from '../page';

describe('My Story page lines (row CM-38)', () => {
  it('each written frame is one line: Korean with the fitted ending, the converter romanization, the meaning', () => {
    const lines = storyLines(FIXTURE_CHAIN, [
      { roundIdx: 0, words: ['공원'] },
      { roundIdx: 1, words: ['호야'] },
      { roundIdx: 2, words: ['괜찮아요'] },
    ]);
    expect(lines).toEqual([
      { index: 0, ko: '저는 주말에 공원에 가요.', romanization: 'jeoneun jumare gongwone gayo', gloss: 'On the weekend I go to the park.' },
      { index: 1, ko: '호야와 같이 가요.', romanization: 'hoyawa gachi gayo', gloss: 'I go with Hoya.' },
      { index: 2, ko: '기분이 괜찮아요.', romanization: 'gibuni gwaenchanayo', gloss: 'I feel okay.' },
    ]);
  });

  it('the particle follows the pick (과 after a final, 와 after a vowel)', () => {
    expect(storyLines(FIXTURE_CHAIN, [{ roundIdx: 1, words: ['가족'] }])[0]).toMatchObject({ ko: '가족과 같이 가요.', gloss: 'I go with my family.' });
  });

  it('a frame the chain does not have draws nothing; a word not in the bank keeps its Korean as the meaning', () => {
    expect(storyLines(FIXTURE_CHAIN, [{ roundIdx: 9, words: ['공원'] }])).toEqual([]);
    expect(storyLines(FIXTURE_CHAIN, [{ roundIdx: 0, words: ['바다'] }])[0]?.gloss).toBe('On the weekend I go to 바다.');
  });

  it('Hoya says the whole story only when every frame was written', () => {
    expect(pageLine(3, 3)).toBe('done');
    expect(pageLine(2, 3)).toBe('donePartial');
    expect(pageLine(1, 5)).toBe('donePartial');
  });
});
