import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../i18n/safe-storage';
import { LOCALE_BANNER_KEY, bannerLocale, dismissLocaleBanner, localeBannerDismissed } from '../locale-banner';

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
