import { describe, expect, it } from 'vitest';
import type { BuildName, NarrationPiece } from '../build-steps';
import {
  PRESENTER_AUDIO_SOURCE,
  QUIZ_MARKERS,
  checkPromptParts,
  quizMarker,
  quizOptionRomShown,
  romShown,
  storyNarrationSteps,
} from '../story-slides';

/**
 * The story slides' pure decisions (F-TCH-004 PR 11): what Read-to-me says on a story scene,
 * when romanization shows (D2), and the shape-and-number markers of a story check (section 3.4).
 */

const narration: NarrationPiece[] = [
  { text: 'An old word for the people is ' },
  { ko: 'baek-seong-ko', romanization: 'baekseong', gloss: 'the people' },
  { text: '. ' },
  { text: 'He made the letters.' },
];

describe('storyNarrationSteps (Read-to-me, section 3.4)', () => {
  it('speaks the narration in its own voice and each keyword chip in Korean, in order', () => {
    expect(storyNarrationSteps(narration, 'en-US')).toEqual([
      { text: 'An old word for the people is ', language: 'en-US', kind: 'narration', source: PRESENTER_AUDIO_SOURCE },
      { text: 'baek-seong-ko', language: 'ko-KR', kind: 'word', source: PRESENTER_AUDIO_SOURCE },
      { text: 'He made the letters.', language: 'en-US', kind: 'narration', source: PRESENTER_AUDIO_SOURCE },
    ]);
  });

  it('follows the narration language (an overlay narration reads in the UI voice)', () => {
    const steps = storyNarrationSteps([{ text: 'Hola.' }], 'es-US');
    expect(steps).toEqual([{ text: 'Hola.', language: 'es-US', kind: 'narration', source: PRESENTER_AUDIO_SOURCE }]);
  });

  it('says nothing for punctuation alone or an empty narration', () => {
    expect(storyNarrationSteps([{ text: ' , ' }, { text: '!' }], 'en-US')).toEqual([]);
    expect(storyNarrationSteps([], 'en-US')).toEqual([]);
  });
});

describe('romShown (D2)', () => {
  const shown = (...b: BuildName[]) => new Set<BuildName>(b);

  it('with always, the romanization comes with its Korean', () => {
    const builds: BuildName[] = ['art', 'narration', 'korean'];
    expect(romShown(builds, shown('art'), 'korean')).toBe(false);
    expect(romShown(builds, shown('art', 'narration', 'korean'), 'korean')).toBe(true);
    expect(romShown(builds, shown('art', 'narration'), 'narration')).toBe(true);
  });

  it('with tap, every romanization waits for the rom build', () => {
    const builds: BuildName[] = ['art', 'narration', 'korean', 'rom'];
    expect(romShown(builds, shown('art', 'narration', 'korean'), 'korean')).toBe(false);
    expect(romShown(builds, shown('art', 'narration', 'korean', 'rom'), 'narration')).toBe(true);
  });
});

describe('quizOptionRomShown (D2)', () => {
  it('shows option romanization at once with always, at the answer with tap', () => {
    expect(quizOptionRomShown('always', new Set<BuildName>(['question']))).toBe(true);
    expect(quizOptionRomShown('tap', new Set<BuildName>(['question']))).toBe(false);
    expect(quizOptionRomShown('tap', new Set<BuildName>(['question', 'answer']))).toBe(true);
  });
});

describe('quizMarker (section 3.4)', () => {
  it('gives options circle 1, triangle 2, square 3, star 4 by position', () => {
    expect(QUIZ_MARKERS).toEqual(['circle', 'triangle', 'square', 'star']);
    expect([0, 1, 2, 3].map(quizMarker)).toEqual([
      { shape: 'circle', n: 1 },
      { shape: 'triangle', n: 2 },
      { shape: 'square', n: 3 },
      { shape: 'star', n: 4 },
    ]);
  });

  it('wraps past four (the schema allows at most four options)', () => {
    expect(quizMarker(4)).toEqual({ shape: 'circle', n: 5 });
  });
});

describe('checkPromptParts (story checks, D14)', () => {
  const target = { ko: 'target-ko', romanization: 'sacho', gloss: 'draft notes' };

  it('puts the target where the prompt holds {target}', () => {
    expect(checkPromptParts('Who could read {target}?', target)).toEqual([{ text: 'Who could read ' }, { target }, { text: '?' }]);
    expect(checkPromptParts('{target}', target)).toEqual([{ target }]);
  });

  it('a prompt without the token, or without a target, is its own text', () => {
    expect(checkPromptParts('Who created Hangul?', undefined)).toEqual([{ text: 'Who created Hangul?' }]);
    expect(checkPromptParts('Who created Hangul?', target)).toEqual([{ text: 'Who created Hangul?' }]);
  });
});
