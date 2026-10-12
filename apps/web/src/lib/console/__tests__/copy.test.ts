import { LOCALES, en, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { BANNED_WORDS, findBannedWord, isCaregiverSafe } from '../banned-text';
import * as copyModule from '../copy';
import { allCopyStrings } from '../copy';

describe('console copy stays caregiver-safe (F-CONSOLE-001 §3.5)', () => {
  it('flags banned words on word boundaries only', () => {
    expect(findBannedWord('3 students missed it')).toBe('missed');
    expect(findBannedWord('she dismissed the idea')).toBeNull();
    expect(isCaregiverSafe('Falling Behind?')).toBe(false);
    expect(BANNED_WORDS.length).toBeGreaterThan(3);
  });

  it('every console string passes', () => {
    const strings = allCopyStrings();
    expect(strings.length).toBeGreaterThan(10);
    for (const s of strings) expect(isCaregiverSafe(s)).toBe(true);
    expect(en.console.capWarning(16, 20)).toBe('Free plan: 16 / 20 students');
  });
});

describe('the guard is a thin re-export of @hangul-route/i18n (F-I18N-001 §3.1, PR 9)', () => {
  it('keeps the English caregiver list: the learner words plus behind and lazy', () => {
    expect([...BANNED_WORDS].sort()).toEqual(['behind', 'failed', 'incomplete', 'lazy', 'missed', 'overdue']);
  });

  it('reads the per-locale lists from banned-words.json', () => {
    expect(findBannedWord('Va atrasado', 'es')).toBe('atrasado');
    expect(findBannedWord('Es perezoso', 'es')).toBe('perezoso');
    expect(findBannedWord('missed', 'es')).toBeNull();
    expect(findBannedWord('실패했어요', 'ko')).toBe('실패');
    expect(isCaregiverSafe('Bien hecho', 'es')).toBe(true);
    expect(isCaregiverSafe('게으른 학생', 'ko')).toBe(false);
  });

  it('accented letters never split a token', () => {
    expect(findBannedWord('behindé')).toBeNull();
    expect(findBannedWord('Behind, again')).toBe('behind');
  });
});

describe('the console namespace of the dictionary', () => {
  it('keeps the former COPY keys; the English-only COPY alias is gone now every page reads useMessages() (F-I18N-001 PR 10c)', () => {
    expect(en.console.tryAgain).toBe('Try again');
    expect(Object.keys(copyModule)).not.toContain('COPY');
  });

  for (const locale of LOCALES) {
    it(`${locale}: every console string, function messages rendered, is caregiver-safe in its locale`, () => {
      const strings = allCopyStrings(locale);
      expect(strings.length).toBeGreaterThan(80);
      for (const s of strings) expect(isCaregiverSafe(s, locale), s).toBe(true);
      expect(strings).toContain(getMessages(locale).console.capWarning(16, 20));
    });
  }
});
