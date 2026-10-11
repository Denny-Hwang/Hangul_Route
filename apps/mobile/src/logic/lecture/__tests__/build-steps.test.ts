import { describe, expect, it } from 'vitest';
import { buildsFor, type BuildOptions, type SlideBody } from '../build-steps';

const ALWAYS: BuildOptions = { romanization: 'always', strokeGuide: true };
const TAP: BuildOptions = { romanization: 'tap', strokeGuide: true };

const letter = (over: Partial<Extract<SlideBody, { kind: 'letter' }>> = {}): SlideBody => ({
  kind: 'letter',
  jamoId: 'jamo:giyeok',
  char: 'ㄱ',
  romanization: 'g/k',
  nameEn: 'giyeok',
  spoken: { text: '가', romanization: 'ga' },
  example: { ko: '가족', romanization: 'gajok', gloss: 'family' },
  hasStrokes: true,
  strokeReviewed: false,
  ...over,
});

describe('buildsFor: one teacher click per build (F-TCH-004 §3.4)', () => {
  it('letter: glyph with romanization, stroke guide, sound, name, example', () => {
    expect(buildsFor(letter(), ALWAYS)).toEqual(['ko', 'stroke', 'sound', 'name', 'example']);
  });

  it("letter with romanization 'tap': romanization is its own build after the glyph (D2)", () => {
    expect(buildsFor(letter(), TAP)).toEqual(['ko', 'rom', 'stroke', 'sound', 'name', 'example']);
  });

  it('strokeGuide off drops the stroke build', () => {
    expect(buildsFor(letter(), { romanization: 'always', strokeGuide: false })).toEqual(['ko', 'sound', 'name', 'example']);
  });

  it('a jamo with no stroke skeleton or no example word has no build for them', () => {
    expect(buildsFor(letter({ hasStrokes: false, example: undefined }), ALWAYS)).toEqual(['ko', 'sound', 'name']);
  });

  it('syllable: parts, join, romanization, sound in both modes', () => {
    const body: SlideBody = { kind: 'syllable', ko: '가', romanization: 'ga', split: 'ga', parts: ['ㄱ', 'ㅏ'], spoken: { text: '가', romanization: 'ga' } };
    expect(buildsFor(body, ALWAYS)).toEqual(['parts', 'join', 'rom', 'sound']);
    expect(buildsFor(body, TAP)).toEqual(['parts', 'join', 'rom', 'sound']);
  });

  it('vocab: word, gloss, art; tap adds romanization; no art = text only', () => {
    const body: SlideBody = { kind: 'vocab', word: { ko: '김치', romanization: 'gimchi', gloss: 'kimchi' }, cardId: 'card:kimchi' };
    expect(buildsFor(body, ALWAYS)).toEqual(['ko', 'gloss', 'art']);
    expect(buildsFor(body, TAP)).toEqual(['ko', 'rom', 'gloss', 'art']);
    expect(buildsFor({ kind: 'vocab', word: { ko: '물', romanization: 'mul', gloss: 'water' } }, ALWAYS)).toEqual(['ko', 'gloss']);
  });

  it('sequence: one build per step, then the order question', () => {
    const body: SlideBody = {
      kind: 'sequence',
      steps: [
        { id: 'a', gloss: 'Wash hands' },
        { id: 'b', gloss: 'Set the table' },
        { id: 'c', gloss: 'Eat' },
      ],
      shuffled: ['c', 'a', 'b'],
    };
    expect(buildsFor(body, ALWAYS)).toEqual(['step', 'step', 'step', 'order']);
  });

  it('story: art, narration, Korean line; tap adds romanization; no Korean line, no build for it', () => {
    const body: SlideBody = {
      kind: 'story',
      storyId: 'story:x',
      sceneId: 's1',
      narration: [{ text: 'Once.' }],
      korean: { ko: '해', romanization: 'hae', gloss: 'sun' },
    };
    expect(buildsFor(body, ALWAYS)).toEqual(['art', 'narration', 'korean']);
    expect(buildsFor(body, TAP)).toEqual(['art', 'narration', 'korean', 'rom']);
    expect(buildsFor({ ...body, korean: undefined }, TAP)).toEqual(['art', 'narration']);
  });

  it('quiz: question then answer (option romanizations show at the answer in tap mode, no extra build)', () => {
    const body: SlideBody = { kind: 'quiz', prompt: { ask: 'odd-one-out' }, options: [], textPrompt: false };
    expect(buildsFor(body, ALWAYS)).toEqual(['question', 'answer']);
    expect(buildsFor(body, TAP)).toEqual(['question', 'answer']);
  });

  it('card: art then fact; tap reveals the romanization first', () => {
    const body: SlideBody = { kind: 'card', cardId: 'card:book', title: 'Book', ko: '책', romanization: 'chaek', fact: 'A fact.' };
    expect(buildsFor(body, ALWAYS)).toEqual(['art', 'fact']);
    expect(buildsFor(body, TAP)).toEqual(['art', 'rom', 'fact']);
    expect(buildsFor({ kind: 'card', cardId: 'card:x', title: 'X' }, TAP)).toEqual(['art']);
  });

  it('title, activity and end are one build', () => {
    expect(buildsFor({ kind: 'title', source: 'quest', title: 'Meet g, n, d, l' }, TAP)).toEqual(['title']);
    expect(buildsFor({ kind: 'activity', preset: 'air-write', minutes: 3 }, TAP)).toEqual(['prompt']);
    expect(buildsFor({ kind: 'end', letters: [], words: [] }, TAP)).toEqual(['summary']);
  });
});
