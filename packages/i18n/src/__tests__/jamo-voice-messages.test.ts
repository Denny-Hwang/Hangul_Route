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

  it("Discover's second button on a consonant page plays the letter on a vowel", () => {
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
    }
  });
});
