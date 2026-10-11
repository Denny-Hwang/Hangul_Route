import { readFileSync } from 'node:fs';
import { LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { HIDDEN_LOCALE_ATTR, isShippedSiteLocale, isSiteLocale, siteLocaleParams } from '../site-locales';
import { sitePath } from '../site-path';

/**
 * The site's locale routes — F-I18N-001 §3.4, PR 11b. English stays at `/`; `/es` and `/ko`
 * are prerendered, and a locale that has not shipped (all are shown on a QA build) is marked and
 * removed from the export, so it never reaches hangulroute.com.
 */
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
