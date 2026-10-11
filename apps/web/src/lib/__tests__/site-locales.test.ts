import { readFileSync } from 'node:fs';
import { DEFAULT_LOCALE, LOCALES } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HIDDEN_LOCALE_ATTR, isShippedSiteLocale, isSiteLocale, siteLocaleParams } from '../site-locales';
import { SITE_DEFAULT_LOCALE, appEntryUrl, sitePath } from '../site-path';

/**
 * The site's locale routes — F-I18N-001 §3.4, PR 11b. English stays at `/`; `/es` and `/ko`
 * are prerendered, and a locale that has not shipped (all are shown on a QA build) is marked and
 * removed from the export, so it never reaches hangulroute.com.
 */
// A shell that exports either QA flag (common while QA-ing the learner app) must not change these tests.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('siteLocaleParams (generateStaticParams for [locale])', () => {
  it('lists every non-English locale; English lives at /', () => {
    expect(siteLocaleParams()).toEqual([{ locale: 'es' }, { locale: 'ko' }]);
  });
});

describe('isShippedSiteLocale (hidden until shipped)', () => {
  it.each(['es', 'ko'] as const)('%s is hidden today', (locale) => {
    expect(isShippedSiteLocale(locale, false)).toBe(false);
  });

  it.each(['es', 'ko'] as const)('%s is shown on a QA build', (locale) => {
    expect(isShippedSiteLocale(locale, true)).toBe(true);
  });

  it('reads the build flag by default (off in tests)', () => {
    expect(isShippedSiteLocale('es')).toBe(false);
  });

  it('NEXT_PUBLIC_SHOW_ALL_LOCALES=1 shows every site locale', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    expect(isShippedSiteLocale('es')).toBe(true);
    expect(isShippedSiteLocale('ko')).toBe(true);
  });

  it('the learner app flag (EXPO_PUBLIC_SHOW_ALL_LOCALES=1) alone leaves the site locales hidden', () => {
    vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
    expect(isShippedSiteLocale('es')).toBe(false);
    expect(isShippedSiteLocale('ko')).toBe(false);
  });
});

describe('HIDDEN_LOCALE_ATTR', () => {
  it('is the attribute the postbuild prune looks for', () => {
    const script = readFileSync(new URL('../../../scripts/prune-hidden-locales.mjs', import.meta.url), 'utf8');
    expect(script).toContain(`const HIDDEN_LOCALE_ATTR = '${HIDDEN_LOCALE_ATTR}';`);
  });
});

describe('isSiteLocale', () => {
  it.each(['es', 'ko'])('accepts %s', (value) => expect(isSiteLocale(value)).toBe(true));

  it.each(['en', 'fr', '', 'ES', 'es-MX', undefined, null, 1])('rejects %s', (value) => {
    expect(isSiteLocale(value)).toBe(false);
  });

  it('covers every UI locale but the default', () => {
    expect(LOCALES.filter(isSiteLocale)).toEqual(['es', 'ko']);
  });
});

describe('sitePath', () => {
  it('spells the default locale the way the dictionary does', () => {
    expect(SITE_DEFAULT_LOCALE).toBe(DEFAULT_LOCALE);
  });

  it.each(['/', '/about', '/privacy', '/terms', '#get'])('keeps English paths as they are: %s', (path) => {
    expect(sitePath('en', path)).toBe(path);
  });

  it('puts the locale in front of a site page', () => {
    expect(sitePath('es', '/about')).toBe('/es/about');
    expect(sitePath('ko', '/privacy')).toBe('/ko/privacy');
  });

  it('serves the locale home at /es (the export writes es.html; trailingSlash is off)', () => {
    expect(sitePath('es', '/')).toBe('/es');
    expect(sitePath('ko', '/')).toBe('/ko');
  });

  it('leaves in-page anchors alone', () => {
    expect(sitePath('es', '#cards')).toBe('#cards');
  });
});

describe('appEntryUrl (the "Play now" hand-off, F-I18N-001 §3.3, PR 11c)', () => {
  it('leaves the app URL alone in English', () => {
    expect(appEntryUrl('https://app.hangulroute.com', 'en')).toBe('https://app.hangulroute.com');
  });

  it('adds ?lang=<locale> from /es and /ko, so the app starts in that locale when nothing is stored', () => {
    expect(appEntryUrl('https://app.hangulroute.com', 'es')).toBe('https://app.hangulroute.com?lang=es');
    expect(appEntryUrl('https://app.hangulroute.com/', 'ko')).toBe('https://app.hangulroute.com/?lang=ko');
  });

  it('keeps a query the deployment already has', () => {
    expect(appEntryUrl('https://preview.example.com/?ref=site', 'es')).toBe('https://preview.example.com/?ref=site&lang=es');
  });
});
