import { LOCALE_STATUS, availableLocales } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  deviceChoice,
  languageOptions,
  planLanguageChange,
  profileChoice,
  profileTarget,
  showLanguagePickers,
} from '../language-picker';

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

describe('profileChoice: which radio is on in "This profile"', () => {
  it('is "device" when the profile has no override', () => {
    expect(profileChoice(undefined, ['en', 'es', 'ko'])).toBe('device');
  });

  it('is the override when it is available', () => {
    expect(profileChoice('es', ['en', 'es', 'ko'])).toBe('es');
  });

  it('falls back to "device" for an override of a locale that is no longer offered', () => {
    expect(profileChoice('ko', ['en'])).toBe('device');
  });
});

describe('deviceChoice: which radio is on in "New profiles and this device start in"', () => {
  it('is the stored device choice, else what detection found', () => {
    expect(deviceChoice('ko', 'en', ['en', 'ko'])).toBe('ko');
    expect(deviceChoice(null, 'es', ['en', 'es'])).toBe('es');
  });

  it('is English when the stored or detected locale is not offered', () => {
    expect(deviceChoice('ko', 'en', ['en'])).toBe('en');
    expect(deviceChoice(null, 'es', ['en'])).toBe('en');
  });
});

describe('profileTarget: the language a "This profile" choice would show', () => {
  it('"device" means whatever the device language is', () => {
    expect(profileTarget('device', 'ko')).toBe('ko');
  });

  it('a locale means itself', () => {
    expect(profileTarget('es', 'ko')).toBe('es');
  });
});

describe('planLanguageChange: when the confirm sheet appears', () => {
  it('applies at once when the language does not change', () => {
    expect(planLanguageChange('en', 'en')).toEqual({ action: 'apply' });
  });

  it('asks first, in the new language, when it changes, remembering the way back', () => {
    expect(planLanguageChange('en', 'es')).toEqual({ action: 'confirm', target: 'es', previous: 'en' });
    expect(planLanguageChange('ko', 'en')).toEqual({ action: 'confirm', target: 'en', previous: 'ko' });
  });
});
