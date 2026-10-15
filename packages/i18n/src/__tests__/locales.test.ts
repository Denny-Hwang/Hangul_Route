import { afterEach, describe, expect, it, vi } from 'vitest';
import { UI_LOCALES as SCHEMA_LOCALES } from '@hangul-route/content-schema';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_META,
  LOCALE_STATUS,
  PSEUDO_LOCALE,
  UI_LOCALES,
  availableLocales,
} from '../index';
import { pseudoLocaleEnabled, showAllLocalesEnabled } from '../env';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('locales', () => {
  it('re-exports the one source of truth from content-schema', () => {
    expect(UI_LOCALES).toBe(SCHEMA_LOCALES);
    expect(LOCALES).toBe(SCHEMA_LOCALES);
    expect(DEFAULT_LOCALE).toBe('en');
    expect(PSEUDO_LOCALE).toBe('en-XA');
  });

  it('keeps endonyms and speech tags as constants (spec table)', () => {
    expect(LOCALE_META).toEqual({
      en: { endonym: 'English', htmlLang: 'en', speechLang: 'en-US', ogLocale: 'en_US' },
      es: { endonym: 'Español', htmlLang: 'es', speechLang: 'es-US', ogLocale: 'es_419' },
      ko: { endonym: '한국어', htmlLang: 'ko', speechLang: 'ko-KR', ogLocale: 'ko_KR' },
    });
  });

  it('ships English, Spanish and Korean (F-I18N-001 rows 15b / 16b)', () => {
    expect(LOCALE_STATUS).toEqual({ en: 'shipped', es: 'shipped', ko: 'shipped' });
  });
});

describe('availableLocales', () => {
  it('lists only shipped locales by default (all three since rows 15b / 16b)', () => {
    expect(availableLocales()).toEqual(['en', 'es', 'ko']);
  });

  it('lists all locales for QA builds (explicit flag)', () => {
    expect(availableLocales(true)).toEqual(['en', 'es', 'ko']);
    expect(availableLocales(false)).toEqual(['en', 'es', 'ko']);
  });

  it('reads the Expo and Next QA flags from the environment', () => {
    vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
    expect(availableLocales()).toEqual(['en', 'es', 'ko']);
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    expect(availableLocales()).toEqual(['en', 'es', 'ko']);
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '0');
    expect(availableLocales()).toEqual(['en', 'es', 'ko']);
  });
});

describe('env flags', () => {
  it('reads the pseudo-locale flag from either build env', () => {
    expect(pseudoLocaleEnabled()).toBe(false);
    vi.stubEnv('EXPO_PUBLIC_PSEUDO_LOCALE', '1');
    expect(pseudoLocaleEnabled()).toBe(true);
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    expect(pseudoLocaleEnabled()).toBe(true);
  });

  it('is false (never throws) where there is no process object', () => {
    vi.stubGlobal('process', undefined);
    expect(showAllLocalesEnabled()).toBe(false);
    expect(pseudoLocaleEnabled()).toBe(false);
  });
});
