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

  it('vocab: a topic word with a WordArt key has the art build after the gloss (README D9)', () => {
    const body: SlideBody = { kind: 'vocab', word: { ko: '사과', romanization: 'sagwa', gloss: 'apple' }, spoken: { text: '사과', romanization: 'sagwa' }, speech: 'word', wordId: 'vocab:sagwa-apple', wordArt: 'food-apple' };
    expect(buildsFor(body, ALWAYS)).toEqual(['ko', 'gloss', 'art']);
    expect(buildsFor(body, { ...ALWAYS, romanization: 'tap' })).toEqual(['ko', 'rom', 'gloss', 'art']);
  });

  it('vocab: word, gloss, art; tap adds romanization; no art = text only', () => {
    const body: SlideBody = { kind: 'vocab', word: { ko: '김치', romanization: 'gimchi', gloss: 'kimchi' }, spoken: { text: '김치', romanization: 'gimchi' }, speech: 'word', cardId: 'card:kimchi' };
    expect(buildsFor(body, ALWAYS)).toEqual(['ko', 'gloss', 'art']);
    expect(buildsFor(body, TAP)).toEqual(['ko', 'rom', 'gloss', 'art']);
    expect(buildsFor({ kind: 'vocab', word: { ko: '물', romanization: 'mul', gloss: 'water' }, spoken: { text: '물', romanization: 'mul' }, speech: 'word' }, ALWAYS)).toEqual(['ko', 'gloss']);
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
    // No romanization means no chip on the slide, so no romanization build to press through.
    expect(buildsFor({ kind: 'card', cardId: 'card:x', title: 'X', ko: '책', fact: 'A fact.' }, TAP)).toEqual(['art', 'fact']);
  });

  it('title, activity and end are one build', () => {
    expect(buildsFor({ kind: 'title', source: 'quest', title: 'Meet g, n, d, l' }, TAP)).toEqual(['title']);
    expect(buildsFor({ kind: 'activity', preset: 'air-write', minutes: 3 }, TAP)).toEqual(['prompt']);
    expect(buildsFor({ kind: 'end', letters: [], words: [] }, TAP)).toEqual(['summary']);
  });

  it('trace-stroke letter (strokeFirst): the stroke guide comes first, unless it is off or missing', () => {
    expect(buildsFor(letter({ strokeFirst: true }), ALWAYS)).toEqual(['stroke', 'ko', 'sound', 'name', 'example']);
    expect(buildsFor(letter({ strokeFirst: true }), TAP)).toEqual(['stroke', 'ko', 'rom', 'sound', 'name', 'example']);
    expect(buildsFor(letter({ strokeFirst: true }), { romanization: 'always', strokeGuide: false })).toEqual(['ko', 'sound', 'name', 'example']);
    expect(buildsFor(letter({ strokeFirst: true, hasStrokes: false }), ALWAYS)).toEqual(['ko', 'sound', 'name', 'example']);
  });

  it("sequence with 'tap': the steps' romanization gets one build of its own before the order", () => {
    const body: SlideBody = {
      kind: 'sequence',
      steps: [
        { id: 'a', gloss: 'Wash hands', ko: '손 씻기', romanization: 'son ssitgi' },
        { id: 'b', gloss: 'Eat' },
      ],
      shuffled: ['b', 'a'],
    };
    expect(buildsFor(body, TAP)).toEqual(['step', 'step', 'rom', 'order']);
    expect(buildsFor(body, ALWAYS)).toEqual(['step', 'step', 'order']);
    expect(buildsFor({ ...body, steps: [{ id: 'b', gloss: 'Eat' }] }, TAP)).toEqual(['step', 'order']);
  });

  it("story narration keyword chips with 'tap': their romanization gets a build of its own", () => {
    const body: SlideBody = {
      kind: 'story',
      storyId: 'story:x',
      sceneId: 's1',
      narration: [{ text: 'The ' }, { ko: '해', romanization: 'hae', gloss: 'sun' }],
    };
    expect(buildsFor(body, TAP)).toEqual(['art', 'narration', 'rom']);
    expect(buildsFor(body, ALWAYS)).toEqual(['art', 'narration']);
    expect(buildsFor({ ...body, korean: { ko: '해', romanization: 'hae', gloss: 'sun' } }, TAP)).toEqual(['art', 'narration', 'korean', 'rom']);
  });
});
