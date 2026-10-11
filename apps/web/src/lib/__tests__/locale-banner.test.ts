import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../i18n/safe-storage';
import { LOCALE_BANNER_KEY, bannerLocale, browserLanguages, cameFromLocalePage, dismissLocaleBanner, localeBannerDismissed, localeBannerTarget } from '../locale-banner';

/**
 * The "View in <language>" banner on `/` (F-I18N-001 §3.3, PR 11c): it suggests a shipped locale the
 * browser prefers over English and never redirects; a dismissal lasts for the session.
 */
const memory = (): KeyValueStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('bannerLocale', () => {
  const shown = ['en', 'es', 'ko'];

  it('suggests the first preferred locale that is shown, when it is not English', () => {
    expect(bannerLocale(['es-MX', 'en-US'], shown)).toBe('es');
    expect(bannerLocale(['ko_KR'], shown)).toBe('ko');
    expect(bannerLocale(['fr-FR', 'ko', 'es'], shown)).toBe('ko');
  });

  it('suggests nothing when English comes first, or nothing matches', () => {
    expect(bannerLocale(['en-GB', 'es'], shown)).toBeNull();
    expect(bannerLocale(['fr', 'de'], shown)).toBeNull();
    expect(bannerLocale([], shown)).toBeNull();
    expect(bannerLocale([''], shown)).toBeNull();
  });

  it('never suggests a hidden locale', () => {
    expect(bannerLocale(['es-ES', 'ko'], ['en'])).toBeNull();
    expect(bannerLocale(['es-ES', 'ko'], ['en', 'ko'])).toBe('ko');
  });

  it('reads the primary subtag in any case', () => {
    expect(bannerLocale(['ES-419'], shown)).toBe('es');
  });
});

describe('dismissal lasts for the session (guarded storage)', () => {
  it('is remembered once dismissed', () => {
    const storage = memory();
    expect(localeBannerDismissed(storage)).toBe(false);
    expect(dismissLocaleBanner(storage)).toBe(true);
    expect(storage.data.get(LOCALE_BANNER_KEY)).toBe('dismissed');
    expect(localeBannerDismissed(storage)).toBe(true);
  });

  it('works without storage: nothing is remembered and nothing throws', () => {
    expect(localeBannerDismissed(null)).toBe(false);
    expect(dismissLocaleBanner(null)).toBe(false);
    expect(localeBannerDismissed(throwing)).toBe(false);
    expect(dismissLocaleBanner(throwing)).toBe(false);
  });

  it('reads the browser session storage by default (none in Node)', () => {
    expect(localeBannerDismissed()).toBe(false);
    expect(dismissLocaleBanner()).toBe(false);
  });

  it('keys the session store under the site prefix', () => {
    expect(LOCALE_BANNER_KEY).toBe('hr:site:localeBanner');
  });
});

describe('browserLanguages', () => {
  it('prefers navigator.languages, then navigator.language, then none', () => {
    expect(browserLanguages({ languages: ['es-MX', 'en'], language: 'ko' })).toEqual(['es-MX', 'en']);
    expect(browserLanguages({ languages: [], language: 'ko-KR' })).toEqual(['ko-KR']);
    expect(browserLanguages({ language: 'es' })).toEqual(['es']);
    expect(browserLanguages({ languages: [], language: '' })).toEqual([]);
    expect(browserLanguages({})).toEqual([]);
    expect(browserLanguages(undefined)).toEqual([]);
  });
});

describe('localeBannerTarget: the banner decision on /', () => {
  it('offers the preferred locale until dismissed', () => {
    expect(localeBannerTarget(['es-MX', 'en'], ['es', 'ko'], false)).toBe('es');
    expect(localeBannerTarget(['es-MX', 'en'], ['es', 'ko'], true)).toBeNull();
  });

  it('offers nothing to an English-first browser, or a locale that is not offered', () => {
    expect(localeBannerTarget(['en-US', 'es'], ['es', 'ko'], false)).toBeNull();
    expect(localeBannerTarget(['ko'], ['es'], false)).toBeNull();
    expect(localeBannerTarget(['es'], [], false)).toBeNull();
  });
});

describe('cameFromLocalePage: a switch to English is not undone', () => {
  const origin = 'https://hangulroute.com';
  const locales = ['es', 'ko'];

  it('is true for a same-origin locale page, home or deeper', () => {
    expect(cameFromLocalePage('https://hangulroute.com/es', origin, locales)).toBe(true);
    expect(cameFromLocalePage('https://hangulroute.com/ko/about', origin, locales)).toBe(true);
    expect(cameFromLocalePage('https://hangulroute.com/es/', origin, locales)).toBe(true);
    expect(cameFromLocalePage('https://hangulroute.com/es.html', origin, locales)).toBe(true);
    expect(cameFromLocalePage('https://hangulroute.com/ES?x=1', origin, locales)).toBe(true);
  });

  it('is false for English pages, other origins, a locale not offered, and no or bad referrer', () => {
    expect(cameFromLocalePage('https://hangulroute.com/', origin, locales)).toBe(false);
    expect(cameFromLocalePage('https://hangulroute.com/about', origin, locales)).toBe(false);
    expect(cameFromLocalePage('https://hangulroute.com/en', origin, [...locales, 'en'])).toBe(false);
    expect(cameFromLocalePage('https://hangulroute.com/essay', origin, locales)).toBe(false);
    expect(cameFromLocalePage('https://example.com/es', origin, locales)).toBe(false);
    expect(cameFromLocalePage('https://hangulroute.com/ko', origin, ['es'])).toBe(false);
    expect(cameFromLocalePage('', origin, locales)).toBe(false);
    expect(cameFromLocalePage('not a url', origin, locales)).toBe(false);
  });
});

