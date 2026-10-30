import { CheckOptionSchema, type StoryCheck } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { checkSpeech, targetAccessibilityLabel, targetView } from '../check-game';
import type { CheckState } from '../check-player';
import { buildCheckView } from '../check-view';
import { spokenRomanization } from '../spoken-label';

/**
 * A story's lone letter says its name, and the button that plays it names what it says
 * (AMENDMENTS-AUDIO-CLIPS M8): the keyword shows ㅁ with its sound value "m", the voice says 미음,
 * and the Hear label carries "mieum".
 */

const copy = getMessages('en').learner.story.check;
const answering: CheckState = { index: 0, phase: 'answering', wrong: [], taps: 0 };

describe('spokenRomanization', () => {
  it('a lone letter with a spokenKo is named by the romanization of what it says', () => {
    expect(spokenRomanization({ ko: 'ㅁ', romanization: 'm', spokenKo: '미음' })).toBe('mieum');
    expect(spokenRomanization({ ko: 'ㄱ', romanization: 'g/k', spokenKo: '기역' })).toBe('giyeok');
    expect(spokenRomanization({ ko: 'ㄷ', romanization: 'd/t', spokenKo: '디귿' })).toBe('digeut');
    expect(spokenRomanization({ ko: 'ㅇ', romanization: 'silent/ng', spokenKo: '이응' })).toBe('ieung');
    expect(spokenRomanization({ ko: 'ㅏ', romanization: 'a', spokenKo: '아' })).toBe('a');
  });

  it('a word keeps its own romanization, and so does a letter without a spokenKo', () => {
    expect(spokenRomanization({ ko: '한글', romanization: 'hangeul', spokenKo: '한글' })).toBe('hangeul');
    expect(spokenRomanization({ ko: '1446년', romanization: 'cheonsabaeksasimnyungnyeon', spokenKo: '천사백사십육 년' })).toBe('cheonsabaeksasimnyungnyeon');
    expect(spokenRomanization({ ko: 'ㅁ', romanization: 'm' })).toBe('m');
  });
});

const check: StoryCheck = {
  id: 'c1',
  kind: 'detail',
  promptEn: 'What does the shape of {target} copy?',
  target: { ko: 'ㅁ', romanization: 'm', en: 'the consonant letter mieum', spokenKo: '미음' },
  options: [
    { id: 'a', ko: 'ㅣ', spokenKo: '이', romanization: 'i', en: 'the vowel letter i', isCorrect: true },
    { id: 'b', ko: 'ㅡ', spokenKo: '으', romanization: 'eu', en: 'the vowel letter eu', isCorrect: false },
    { id: 'c', en: 'The round dot', isCorrect: false },
  ],
  shuffle: false,
  factIds: ['f1'],
};

describe('story checks speak a letter by its name', () => {
  const item = buildCheckView(check, 'story:shapes-of-hangeul');

  it('the check view keeps an option spokenKo', () => {
    expect(item.options.map((o) => o.spokenKo)).toEqual(['이', '으', undefined]);
  });

  it('the target and each Korean option say the name; nothing says a bare letter', () => {
    const speech = checkSpeech(item, undefined, 'en-US');
    expect(speech.target?.text).toBe('미음');
    expect(speech.question.filter((s) => s.language === 'ko-KR').map((s) => s.text)).toEqual(['미음']);
    expect(speech.options.filter((s) => s.language === 'ko-KR').map((s) => s.text)).toEqual(['이', '으']);
  });

  it("the target's speaker label names what it says once the romanization shows, never before (D2)", () => {
    const shown = targetView(item, answering, { romanizationMode: 'always', revealed: false })!;
    expect(shown.spokenRomanization).toBe('mieum');
    expect(targetAccessibilityLabel(shown, copy)).toBe(`ㅁ, m. ${copy.speakerTarget}, mieum`);
    const hidden = targetView(item, answering, { romanizationMode: 'tap', revealed: false })!;
    expect(hidden.spokenRomanization).toBeUndefined();
    expect(targetAccessibilityLabel(hidden, copy)).toBe(`ㅁ. ${copy.speakerTarget}`);
  });

  it('a word target names nothing extra', () => {
    const word = buildCheckView({ ...check, target: { ko: '입', romanization: 'ip', en: 'mouth' } }, 'story:shapes-of-hangeul');
    const view = targetView(word, answering, { romanizationMode: 'always', revealed: false })!;
    expect(targetAccessibilityLabel(view, copy)).toBe(`입, ip. ${copy.speakerTarget}`);
  });
});

describe('CheckOptionSchema spokenKo (additive)', () => {
  it('a Korean option may say its name', () => {
    expect(CheckOptionSchema.safeParse({ id: 'a', ko: 'ㅣ', spokenKo: '이', romanization: 'i', en: 'the vowel letter i', isCorrect: true }).success).toBe(true);
    expect(CheckOptionSchema.parse({ id: 'a', ko: 'ㅣ', spokenKo: '이', romanization: 'i', en: 'i', isCorrect: true }).spokenKo).toBe('이');
  });

  it('a spokenKo needs the Korean it is said for', () => {
    expect(CheckOptionSchema.safeParse({ id: 'a', spokenKo: '이', en: 'the vowel letter i', isCorrect: true }).success).toBe(false);
  });
});
