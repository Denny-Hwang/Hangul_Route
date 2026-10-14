import { describe, expect, it } from 'vitest';
import type { BuildName, NarrationPiece } from '../build-steps';
import {
  PRESENTER_AUDIO_SOURCE,
  QUIZ_MARKERS,
  checkPromptParts,
  quizMarker,
  quizOptionRomShown,
  readToMePlan,
  romShown,
  storyNarrationSteps,
} from '../story-slides';
import { GLOSS_HIDDEN_KINDS } from '../../story/check-view';

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

describe('readToMePlan (Read-to-me on a story scene, D6; the story reader\'s voice rules)', () => {
  const scene = { kind: 'story' as const, narration };
  const base = { sound: true, canPlayKorean: true, voiceChecked: true, narrationLang: 'en-US' as const };

  it('plays the narration with its keyword chips in Korean once the voice check has settled', () => {
    expect(readToMePlan(scene, base)).toEqual({ steps: storyNarrationSteps(narration, 'en-US'), options: { skipUnavailableKorean: false } });
  });

  it('skips an unavailable Korean step only while the voice check is still running', () => {
    expect(readToMePlan(scene, { ...base, voiceChecked: false })?.options).toEqual({ skipUnavailableKorean: true });
  });

  it('with no Korean voice, plays the English narration only, as the story reader does', () => {
    const plan = readToMePlan(scene, { ...base, canPlayKorean: false });
    expect(plan?.steps.every((s) => s.language === 'en-US')).toBe(true);
    expect(plan?.steps).toHaveLength(2);
  });

  it('a narration that is all Korean still asks, so the fallback is learned', () => {
    const ko: NarrationPiece[] = [{ ko: 'baek-seong-ko', romanization: 'baekseong', gloss: 'the people' }];
    expect(readToMePlan({ kind: 'story', narration: ko }, { ...base, canPlayKorean: false })?.steps).toHaveLength(1);
  });

  it('speaks in the narration language it is given', () => {
    expect(readToMePlan(scene, { ...base, narrationLang: 'es-US' })?.steps[0]?.language).toBe('es-US');
  });

  it('nothing with sound off, on a slide that is not a story scene, or with nothing to say', () => {
    expect(readToMePlan(scene, { ...base, sound: false })).toBeNull();
    expect(readToMePlan({ kind: 'letter' }, base)).toBeNull();
    expect(readToMePlan({ kind: 'story', narration: [{ text: ', ' }] }, base)).toBeNull();
  });
});

describe('the projected check shares the learner check rules', () => {
  it('hides the gloss of a pick-meaning or fill-word target until the answer', () => {
    expect(GLOSS_HIDDEN_KINDS).toEqual(['pick-meaning', 'fill-word']);
  });
});
