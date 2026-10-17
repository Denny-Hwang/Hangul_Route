import { LOCALE_STATUS, availableLocales } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { deviceChoice, languageOptions, showLanguagePickers } from '../language-picker';

describe('what ships: English, Spanish and Korean (F-I18N-001 rows 15b / 16b)', () => {
  it('shows the language pickers in the default build, listing all three', () => {
    expect(LOCALE_STATUS).toEqual({ en: 'shipped', es: 'shipped', ko: 'shipped' });
    expect(showLanguagePickers(availableLocales(false))).toBe(true);
    expect(languageOptions(availableLocales(false)).map((o) => o.locale)).toEqual(['en', 'es', 'ko']);
  });

  it('shows no language picker when only one locale is available (a build with every other locale hidden)', () => {
    expect(showLanguagePickers(['en'])).toBe(false);
  });

  it('shows the pickers when the QA flag lists every locale', () => {
    expect(showLanguagePickers(availableLocales(true))).toBe(true);
    expect(languageOptions(availableLocales(true)).map((o) => o.locale)).toEqual(['en', 'es', 'ko']);
  });
});

describe('languageOptions', () => {
  it('uses the endonyms and html lang tags, in a fixed order whatever the input order', () => {
    expect(languageOptions(['ko', 'en', 'es'])).toEqual([
      { locale: 'en', endonym: 'English', htmlLang: 'en' },
      { locale: 'es', endonym: 'Español', htmlLang: 'es' },
      { locale: 'ko', endonym: '한국어', htmlLang: 'ko' },
    ]);
  });

  it('lists only the available locales', () => {
    expect(languageOptions(['en', 'ko']).map((o) => o.locale)).toEqual(['en', 'ko']);
    expect(languageOptions([])).toEqual([]);
  });
});

describe('showLanguagePickers', () => {
  it('needs at least two locales to choose between', () => {
    expect(showLanguagePickers([])).toBe(false);
    expect(showLanguagePickers(['en'])).toBe(false);
    expect(showLanguagePickers(['en', 'es'])).toBe(true);
  });
});

describe('deviceChoice: which chip is on in Welcome\'s language row', () => {
  it('is the stored device choice, else what detection found', () => {
    expect(deviceChoice('ko', 'en', ['en', 'ko'])).toBe('ko');
    expect(deviceChoice(null, 'es', ['en', 'es'])).toBe('es');
  });

  it('is English when the stored or detected locale is not offered', () => {
    expect(deviceChoice('ko', 'en', ['en'])).toBe('en');
    expect(deviceChoice(null, 'es', ['en'])).toBe('en');
  });
});
