import { getMessages } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The site's hidden-locale machinery (F-I18N-001 §3.4, PR 11b/11c) after es and ko shipped (rows 15b / 16b).
 * Nothing in the real `LOCALE_STATUS` is hidden now, so this fixture stands es and ko in for a locale that has
 * not shipped (the way a new locale starts): it must be noindex, carry no hreflang alternates, and stay out of
 * the alternates of the shipped pages, while the QA flag shows it.
 */
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  return {
    ...actual,
    availableLocales: (showAll: boolean = actual.showAllLocalesEnabled()): import('@hangul-route/i18n').UiLocale[] =>
      showAll ? [...actual.LOCALES] : ['en'],
  };
});

import { isShippedSiteLocale } from '../site-locales';
import { SITE_PAGES, shownSiteLocales, siteAlternates, siteMetadataFor } from '../site-metadata';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('a locale that has not shipped (fixture)', () => {
  it.each(['es', 'ko'] as const)('%s is hidden without the flag and shown on a QA build', (locale) => {
    expect(isShippedSiteLocale(locale, false)).toBe(false);
    expect(isShippedSiteLocale(locale, true)).toBe(true);
  });

  it('the learner app flag (EXPO_PUBLIC_SHOW_ALL_LOCALES=1) alone leaves it hidden on the site', () => {
    vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
    expect(isShippedSiteLocale('es')).toBe(false);
    expect(isShippedSiteLocale('ko')).toBe(false);
  });

  it('English alone is shown, and an English page carries no alternates', () => {
    expect(shownSiteLocales(false)).toEqual(['en']);
    for (const page of SITE_PAGES) expect(siteAlternates(page, false)).toBeUndefined();
    expect(siteMetadataFor('en', '/', false).alternates).toBeUndefined();
  });

  it.each(['es', 'ko'] as const)('%s: its own words, noindex and no alternates while hidden', (locale) => {
    const meta = siteMetadataFor(locale, '/about', false);
    expect(meta.title).toBe(getMessages(locale).landing.meta.title);
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates).toBeUndefined();
  });
});
