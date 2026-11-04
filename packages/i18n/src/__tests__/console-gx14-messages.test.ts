import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';

/**
 * AMENDMENTS-GROWNUP-UX row GX-14 (sections 9 P5, P9 and 8 T14; section 10.2): the console error page's title, the
 * set-a-PIN card's clearer button and the lecture card's one minutes line, in English, Spanish and Korean in one PR.
 * The error page's button is the console's shipped `tryAgain`, so a grown-up meets one word for it everywhere.
 */
const en = getMessages('en').console;
const es = getMessages('es').console;
const ko = getMessages('ko').console;
const all = [
  ['en', en],
  ['es', es],
  ['ko', ko],
] as const;

describe('console GX-14 strings (section 10.2)', () => {
  it('English, word for word', () => {
    expect(en.errorPage.title).toBe('Something went wrong on this page.');
    expect(en.pinPrompt.cta).toBe('Set the PIN in the app');
    expect(en.lecture.minutesOf(14, 20)).toBe('about 14 min (of 20)');
  });

  it('Spanish and Korean', () => {
    expect(es.errorPage.title).toBe('Algo salió mal en esta página.');
    expect(ko.errorPage.title).toBe('이 화면을 여는 중에 문제가 생겼어요.');
    expect(es.pinPrompt.cta).toBe('Crear el PIN en la app');
    expect(ko.pinPrompt.cta).toBe('앱에서 PIN 만들기');
    expect(es.lecture.minutesOf(14, 20)).toBe('cerca de 14 min (de 20)');
    expect(ko.lecture.minutesOf(14, 20)).toBe('약 14분 (20분 중)');
  });

  it('the minutes line starts with the words of outline.about, so the open card reads like the closed ones', () => {
    for (const [, messages] of all) expect(messages.lecture.minutesOf(14, 20).startsWith(messages.lecture.outline.about(14))).toBe(true);
  });

  it('the error page has no button of its own: Try again is the shipped console.tryAgain', () => {
    for (const [, messages] of all) expect(Object.keys(messages.errorPage)).toEqual(['title']);
  });

  it('Spanish and Korean have their own value (no English fallback); Korean is 해요체, Spanish uses tú', () => {
    for (const messages of [es, ko]) {
      expect(messages.errorPage.title).not.toBe(en.errorPage.title);
      expect(messages.pinPrompt.cta).not.toBe(en.pinPrompt.cta);
      expect(messages.lecture.minutesOf(14, 20)).not.toBe(en.lecture.minutesOf(14, 20));
    }
    expect(ko.errorPage.title).toMatch(/요\.$/);
    for (const text of [es.errorPage.title, es.pinPrompt.cta]) expect(text).not.toMatch(/\busted\b/i);
  });

  it('blame nobody and pass the caregiver ban list', () => {
    for (const [locale, messages] of all) {
      for (const text of [messages.errorPage.title, messages.pinPrompt.cta, messages.lecture.minutesOf(14, 20)]) {
        expect(findBannedWord(text, locale, 'caregiver'), text).toBeNull();
        expect(text).not.toMatch(/\byou\b|fault|culpa|잘못/i);
      }
    }
  });
});
