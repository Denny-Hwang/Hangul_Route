import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { getMessages } from '../resolve';

/**
 * Test the sound on the presenter start screen (F-TCH-004 section 3.7, F-AUDIO-004 2026-10-17):
 * the button and the two lines under it, in en, es and ko as reviewed (MAR, 2026-10-17). Every
 * locale has its own value, the button stays inside the 28-character budget (F-I18N-001 §3.11),
 * nothing trips a ban list or frames the page for one age, no English or Spanish value holds
 * Hangul, no value has an emoji, and no value types the greeting the button says: the Korean is
 * heard, never written into a sentence.
 */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const SPOKEN_WORD = '안녕하세요';

type TestSound = ReturnType<typeof getMessages>['learner']['presenter']['start']['testSound'];

const TABLE: Record<keyof TestSound, Record<'en' | 'es' | 'ko', string>> = {
  cta: { en: 'Test the sound', es: 'Probar el sonido', ko: '소리 확인' },
  played: {
    en: 'Did you hear it? If not, turn up the volume.',
    es: '¿Lo oíste? Si no, sube el volumen.',
    ko: '들렸나요? 안 들리면 볼륨을 올려 주세요.',
  },
  failed: {
    en: 'The sound did not play here. You can say each word yourself.',
    es: 'El sonido no se reprodujo aquí. Tú puedes decir cada palabra.',
    ko: '여기서는 소리가 나지 않았어요. 낱말을 직접 읽어 주세요.',
  },
};

const testSound = (locale: UiLocale): TestSound => getMessages(locale).learner.presenter.start.testSound;

describe('Test the sound: the start screen strings (F-TCH-004 section 3.7)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s has the reviewed values', (locale) => {
    for (const [key, row] of Object.entries(TABLE)) expect(testSound(locale)[key as keyof TestSound], `${locale} ${key}`).toBe(row[locale]);
  });

  it('gives every key its own es and ko value', () => {
    for (const locale of ['es', 'ko'] as const) {
      for (const key of Object.keys(TABLE) as (keyof TestSound)[]) expect(testSound(locale)[key], `${locale} ${key}`).not.toBe(testSound('en')[key]);
    }
  });

  it('muted reuses the shipped Turn sound on, so it needs no new key', () => {
    for (const locale of LOCALES) expect(getMessages(locale).learner.audio.action.turn_on.cta.length, locale).toBeGreaterThan(0);
  });

  it.each(LOCALES)('%s: a short button, no ban-list word, no age framing, Hangul only in Korean, no emoji, no typed greeting', (locale) => {
    for (const key of Object.keys(TABLE) as (keyof TestSound)[]) {
      const value = testSound(locale)[key];
      expect(value.trim().length, `${locale} ${key}`).toBeGreaterThan(0);
      if (key === 'cta') expect(value.length, `${locale} ${key}`).toBeLessThanOrEqual(28);
      expect(findBannedWord(value, locale, 'learner'), `${locale} ${key}`).toBeNull();
      expect(findBannedWord(value, locale, 'caregiver'), `${locale} ${key}`).toBeNull();
      for (const pattern of KIDS_ONLY_FRAMING) expect(pattern.re.test(value), `${locale} ${pattern.name} ${key}`).toBe(false);
      if (locale !== 'ko') expect(HANGUL.test(value), `${locale} ${key}`).toBe(false);
      expect(value).not.toContain(SPOKEN_WORD);
      expect(value).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
