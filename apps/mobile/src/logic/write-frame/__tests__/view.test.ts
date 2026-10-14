import { describe, expect, it } from 'vitest';
import { fillGloss, fittedEnding, frameParts, frameReading, sentenceKo, sentenceRomanization } from '../view';

const words = { blank: 'blank', either: (a: string, b: string) => `${a} or ${b}` };

describe('frameParts (F-CURR-001 §3.7: the ending follows the pick)', () => {
  it('shows both forms of a pair until the slot has a word', () => {
    expect(frameParts('저는 ___을/를 좋아해요.', [null])).toEqual([
      { kind: 'text', text: '저는 ' },
      { kind: 'slot', slot: 0, word: null },
      { kind: 'ending', slot: 0, text: '을/를', pair: true },
      { kind: 'text', text: ' 좋아해요.' },
    ]);
  });

  it('fits the ending to the last block of the word: 를 after a vowel, 을 after a final', () => {
    expect(frameParts('저는 ___을/를 좋아해요.', ['떡볶이'])[2]).toEqual({ kind: 'ending', slot: 0, text: '를', pair: true });
    expect(frameParts('저는 ___을/를 좋아해요.', ['김밥'])[2]).toEqual({ kind: 'ending', slot: 0, text: '을', pair: true });
    expect(frameParts('제 이름은 ___이에요/예요.', ['호야'])[2]).toMatchObject({ text: '예요' });
    expect(frameParts('제 이름은 ___이에요/예요.', ['지민'])[2]).toMatchObject({ text: '이에요' });
  });

  it('keeps both forms while a name ends in an unfinished block', () => {
    expect(frameParts('제 이름은 ___이에요/예요.', ['호ㅇ'])[2]).toMatchObject({ text: '이에요/예요' });
    expect(frameParts('제 이름은 ___이에요/예요.', [''])[2]).toMatchObject({ text: '이에요/예요' });
  });

  it('draws a single form as it is, a bare slot with no ending, and two slots in order', () => {
    expect(frameParts('오늘 ___에 가요.', ['학교'])).toEqual([
      { kind: 'text', text: '오늘 ' },
      { kind: 'slot', slot: 0, word: '학교' },
      { kind: 'ending', slot: 0, text: '에', pair: false },
      { kind: 'text', text: ' 가요.' },
    ]);
    expect(frameParts('___ 좋아요', [null])).toEqual([
      { kind: 'slot', slot: 0, word: null },
      { kind: 'text', text: ' 좋아요' },
    ]);
    const two = frameParts('___에 ___을/를 먹었어요.', ['설날', null]);
    expect(two.filter((p) => p.kind === 'slot')).toEqual([
      { kind: 'slot', slot: 0, word: '설날' },
      { kind: 'slot', slot: 1, word: null },
    ]);
  });
});

describe('the finished sentence', () => {
  it('fills the frame, romanizes it with the converter and fills the gloss', () => {
    expect(sentenceKo('저는 ___을/를 좋아해요.', ['떡볶이'])).toBe('저는 떡볶이를 좋아해요.');
    expect(sentenceRomanization('아침에 ___을/를 먹어요.', ['빵'])).toBe('achime ppangeul meogeoyo');
    expect(fillGloss('At ___ I ate ___.', ['Seollal', 'rice cakes'])).toBe('At Seollal I ate rice cakes.');
    expect(fillGloss('I like ___.', [])).toBe('I like ___.');
  });
});

describe('frameReading (wireframe Accessibility)', () => {
  it('says an empty slot as "blank" and a pair as both forms', () => {
    const parts = frameParts('저는 ___을/를 좋아해요.', [null]);
    expect(frameReading(parts, 'I like ___.', words)).toBe('저는, blank, 을 or 를, 좋아해요. I like blank.');
  });

  it('reads the pick and the fitted ending once a word is picked', () => {
    const parts = frameParts('저는 ___을/를 좋아해요.', ['떡볶이']);
    expect(frameReading(parts, 'I like spicy rice cakes.', words)).toBe('저는, 떡볶이, 를, 좋아해요. I like spicy rice cakes.');
  });
});

describe('fittedEnding (the polite "를 after 떡볶이")', () => {
  it('names the form chosen for a pair once the slot has a word', () => {
    expect(fittedEnding(frameParts('저는 ___을/를 좋아해요.', ['떡볶이']), 0)).toEqual({ particle: '를', word: '떡볶이' });
  });

  it('says nothing for an empty slot, a single form, no ending or an unfinished block', () => {
    expect(fittedEnding(frameParts('저는 ___을/를 좋아해요.', [null]), 0)).toBeNull();
    expect(fittedEnding(frameParts('오늘 ___에 가요.', ['학교']), 0)).toBeNull();
    expect(fittedEnding(frameParts('___ 좋아요', ['사과']), 0)).toBeNull();
    expect(fittedEnding(frameParts('제 이름은 ___이에요/예요.', ['호ㅇ']), 0)).toBeNull();
  });
});
