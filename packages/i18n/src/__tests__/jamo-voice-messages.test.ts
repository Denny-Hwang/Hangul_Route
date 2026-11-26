import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * The letter-question copy of AMENDMENTS-AUDIO-CLIPS JV-A4 (row JV-2), pinned in all three
 * languages: the wrong-answer bubble of a letter question, the line under a final consonant, the
 * lecture slide's letter name and Discover's second button. Taught Korean (a letter, a syllable,
 * a Hangul name) arrives only as an argument, so no English or Spanish string holds Hangul.
 */

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/u;
const en = getMessages('en').learner;
const es = getMessages('es').learner;
const ko = getMessages('ko').learner;
const a11y = { en: getMessages('en').a11y, es: getMessages('es').a11y, ko: getMessages('ko').a11y };

describe('letter questions say the letter name: copy (JV-A4)', () => {
  it('the bubble of a letter question names the letter; a sound question keeps its line', () => {
    expect(en.audio.listenAgainLetter).toBe('Listen again. This letter is');
    expect(es.audio.listenAgainLetter).toBe('Escucha otra vez. Esta letra es');
    // A label, so the Korean line is complete before the name that follows it.
    expect(ko.audio.listenAgainLetter).toBe('다시 들어 봐요. 이 글자 이름:');
    expect(en.audio.listenAgain).toBe('Listen again. This one says');
    expect(es.audio.listenAgain).toBe('Escucha otra vez. Esta suena');
    expect(ko.audio.listenAgain).toBe('다시 들어 봐요. 이건 이렇게 읽어요:');
  });

  it('a final is shown with the closed syllable it is heard in, the syllable followed by its romanization', () => {
    expect(en.audio.finalLine('ㄴ', '안 · an')).toBe('ㄴ at the bottom: 안 · an');
    expect(es.audio.finalLine('ㄴ', '안 · an')).toBe('ㄴ abajo: 안 · an');
    expect(ko.audio.finalLine('ㄴ', '안 · an')).toBe('받침 ㄴ: 안 · an');
  });

  it('the lecture slide names the letter in Hangul only in Korean; English and Spanish keep the romanized name', () => {
    expect(en.presenter.slide.letterName('nieun', '니은')).toBe('Letter name: nieun');
    expect(es.presenter.slide.letterName('nieun', '니은')).toBe('Nombre de la letra: nieun');
    expect(ko.presenter.slide.letterName('nieun', '니은')).toBe('글자 이름: 니은 (nieun)');
  });

  it("Discover's second button on a consonant page plays the letter's name (SF-1)", () => {
    expect(en.quest.discover.hearName.cta).toBe('Hear the name');
    expect(es.quest.discover.hearName.cta).toBe('Escuchar el nombre');
    expect(ko.quest.discover.hearName.cta).toBe('글자 이름 들어 보기');
    expect(a11y.en.hearNameLabel('Korean letter g/k')).toBe('Hear the name. Korean letter g/k');
  });

  it("[SF-3] the initial ㅇ card's second button plays 아, 오, 우 (AMENDMENTS-DISCOVER-SOUND-FIRST §12)", () => {
    expect(en.quest.discover.hearVowels.cta).toBe('Hear it with vowels');
    expect(es.quest.discover.hearVowels.cta).toBe('Escuchar con vocales');
    expect(ko.quest.discover.hearVowels.cta).toBe('모음과 함께 들어 보기');
    expect(a11y.en.hearVowelsLabel('Korean letter silent/ng')).toBe('Hear it with vowels. Korean letter silent/ng');
    expect(a11y.es.hearVowelsLabel('Letra coreana silent/ng')).toBe('Escuchar con vocales. Letra coreana silent/ng');
    expect(a11y.ko.hearVowelsLabel('한글 글자 silent/ng')).toBe('모음과 함께 들어 보기. 한글 글자 silent/ng');
  });

  it('label in name: the accessible name of Hear it and Hear the name starts with the visible label, in every locale (WCAG 2.5.3)', () => {
    for (const [locale, m] of [['en', en], ['es', es], ['ko', ko]] as const) {
      expect(a11y[locale].hearItLabel('x').startsWith(m.quest.discover.hearIt.cta), `${locale} hearIt`).toBe(true);
      expect(a11y[locale].hearNameLabel('x').startsWith(m.quest.discover.hearName.cta), `${locale} hearName`).toBe(true);
      expect(a11y[locale].hearVowelsLabel('x').startsWith(m.quest.discover.hearVowels.cta), `${locale} hearVowels`).toBe(true);
    }
  });

  it("the presenter's letter slide keeps Hear it with a vowel (Discover no longer uses it)", () => {
    expect(en.quest.discover.soundWith.cta).toBe('Hear it with a vowel');
    expect(es.quest.discover.soundWith.cta).toBe('Escúchala con una vocal');
    expect(ko.quest.discover.soundWith.cta).toBe('모음과 함께 들어 봐요');
  });

  it('no English or Spanish string holds Hangul of its own (CLAUDE.md section 8)', () => {
    for (const m of [en, es]) {
      expect(m.audio.listenAgainLetter).not.toMatch(HANGUL);
      expect(m.audio.finalLine('n', 'an')).not.toMatch(HANGUL);
      expect(m.presenter.slide.letterName('nieun', 'x')).not.toMatch(HANGUL);
      expect(m.quest.discover.soundWith.cta).not.toMatch(HANGUL);
      expect(m.quest.discover.hearName.cta).not.toMatch(HANGUL);
      expect(m.quest.discover.hearVowels.cta).not.toMatch(HANGUL);
    }
  });
});
