import { describe, expect, it } from 'vitest';
import type { BuildName, NarrationPiece } from '../build-steps';
import {
  PRESENTER_AUDIO_SOURCE,
  checkPromptParts,
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

describe("readToMePlan reads the scene's Korean once it shows (section 3.4 amendment 2026-10-17)", () => {
  const base = { sound: true, canPlayKorean: true, voiceChecked: true, narrationLang: 'en-US' as const };
  const builds: BuildName[] = ['art', 'narration', 'korean'];
  const line = { ko: '세종대왕은 조선의 왕이었어요.', romanization: 'Sejongdaewangeun Joseonui wangieosseoyo.', gloss: 'King Sejong was a king of Joseon.', speech: 'sentence' as const };
  const scene = { kind: 'story' as const, narration: [{ text: 'Here lived King Sejong.' }], korean: line, builds };
  const texts = (plan: ReturnType<typeof readToMePlan>) => plan?.steps.map((s) => [s.text, s.language, s.kind]);

  it('after the narration, the line in Korean at the sentence rate, from the korean build on', () => {
    expect(texts(readToMePlan(scene, { ...base, reveal: 2 }))).toEqual([
      ['Here lived King Sejong.', 'en-US', 'narration'],
      ['세종대왕은 조선의 왕이었어요.', 'ko-KR', 'sentence'],
    ]);
    expect(readToMePlan(scene, { ...base, reveal: 2 })?.steps[1]?.source).toBe(PRESENTER_AUDIO_SOURCE);
    // Every part when no reveal is given.
    expect(texts(readToMePlan(scene, base))).toEqual(texts(readToMePlan(scene, { ...base, reveal: 2 })));
  });

  it('not before the korean build shows', () => {
    expect(texts(readToMePlan(scene, { ...base, reveal: 1 }))).toEqual([['Here lived King Sejong.', 'en-US', 'narration']]);
    expect(readToMePlan({ ...scene, narration: [{ text: ', ' }] }, { ...base, reveal: 1 })).toBeNull();
  });

  it('a keyword is read at the word rate; one the narration already says as a chip is not said twice', () => {
    const keyword = { ko: '한자', romanization: 'hanja', gloss: 'Chinese characters', speech: 'word' as const };
    expect(texts(readToMePlan({ ...scene, korean: keyword }, base))?.at(-1)).toEqual(['한자', 'ko-KR', 'word']);
    const chip = { ...scene, narration: [{ text: 'They wrote ' }, { ko: '한자', romanization: 'hanja', gloss: 'Chinese characters' }], korean: keyword };
    expect(texts(readToMePlan(chip, base))).toEqual([
      ['They wrote ', 'en-US', 'narration'],
      ['한자', 'ko-KR', 'word'],
    ]);
  });

  it('with no Korean voice the English plays alone, as the story reader does; a Korean line alone still asks', () => {
    expect(texts(readToMePlan(scene, { ...base, canPlayKorean: false }))).toEqual([['Here lived King Sejong.', 'en-US', 'narration']]);
    expect(texts(readToMePlan({ ...scene, narration: [] }, { ...base, canPlayKorean: false }))).toEqual([['세종대왕은 조선의 왕이었어요.', 'ko-KR', 'sentence']]);
  });
});

describe('the projected check shares the learner check rules', () => {
  it('hides the gloss of a pick-meaning or fill-word target until the answer', () => {
    expect(GLOSS_HIDDEN_KINDS).toEqual(['pick-meaning', 'fill-word']);
  });
});
