import { LOCALE_META, getMessages } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { siteMetadata } from '../../data/landing-copy';
import { SITE_PAGES, SITE_URL, shownSiteLocales, siteAlternates, siteMetadataFor } from '../site-metadata';

/**
 * Per-locale metadata and hreflang for the site (F-I18N-001 §3.4, PR 11c). The alternates name only the
 * locales a visitor can reach: while es and ko are hidden the English pages carry none (their HTML is what
 * it was), and a QA build links all three, with English as x-default.
 */
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('shownSiteLocales', () => {
  it('is English alone while es and ko are hidden', () => {
    expect(shownSiteLocales()).toEqual(['en']);
    expect(shownSiteLocales(false)).toEqual(['en']);
  });

  it('is every locale on a QA build, English first, in the dictionary order', () => {
    expect(shownSiteLocales(true)).toEqual(['en', 'es', 'ko']);
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    expect(shownSiteLocales()).toEqual(['en', 'es', 'ko']);
  });
});

describe('siteAlternates (hreflang)', () => {
  it('is nothing while only English ships', () => {
    for (const page of SITE_PAGES) expect(siteAlternates(page, false)).toBeUndefined();
  });

  it('links the same page in every shown locale, with English as x-default', () => {
    expect(siteAlternates('/', true)).toEqual({ languages: { en: '/', es: '/es', ko: '/ko', 'x-default': '/' } });
    expect(siteAlternates('/about', true)).toEqual({ languages: { en: '/about', es: '/es/about', ko: '/ko/about', 'x-default': '/about' } });
    expect(siteAlternates('/privacy', true)?.languages).toMatchObject({ es: '/es/privacy' });
    expect(siteAlternates('/terms', true)?.languages).toMatchObject({ ko: '/ko/terms' });
  });
});

describe('siteMetadataFor', () => {
  it('lists the site pages: home, About, the legal pages and /learners (F-SITE-002 S-4a)', () => {
    expect(SITE_PAGES).toEqual(['/', '/about', '/privacy', '/terms', '/learners']);
  });

  it('English while only English ships: the site metadata as before, plus the base for absolute URLs', () => {
    for (const page of ['/', '/about', '/privacy', '/terms'] as const) {
      const meta = siteMetadataFor('en', page);
      const { metadataBase, ...rest } = meta;
      expect(rest).toEqual(siteMetadata);
      expect(metadataBase).toEqual(new URL(SITE_URL));
      expect(meta.alternates).toBeUndefined();
    }
  });

  it.each(['es', 'ko'] as const)('%s: its own words and og:locale; noindex and no alternates while hidden', (locale) => {
    const meta = siteMetadataFor(locale, '/about', false);
    const l = getMessages(locale).landing.meta;
    expect(meta.title).toBe(l.title);
    expect(meta.description).toBe(l.description);
    expect(meta.openGraph).toMatchObject({ locale: LOCALE_META[locale].ogLocale, title: l.title });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates).toBeUndefined();
  });

  it.each(['en', 'es', 'ko'] as const)('%s on a QA build: indexable, with hreflang alternates and itself as canonical', (locale) => {
    const meta = siteMetadataFor(locale, '/terms', true);
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates).toEqual({ canonical: locale === 'en' ? '/terms' : `/${locale}/terms`, ...siteAlternates('/terms', true) });
    expect(siteMetadataFor(locale, '/', true).alternates?.canonical).toBe(locale === 'en' ? '/' : `/${locale}`);
    expect(meta.openGraph).toMatchObject({ locale: LOCALE_META[locale].ogLocale });
  });

  it.each(['en', 'es', 'ko'] as const)('%s /learners: its own title and description, in <title>, Open Graph and Twitter', (locale) => {
    const meta = siteMetadataFor(locale, '/learners', false);
    const site = getMessages(locale).landing.meta;
    const { title, description } = site.pages.learners;
    expect(meta.title).toBe(title);
    expect(meta.description).toBe(description);
    expect(meta.openGraph).toMatchObject({ title, description, locale: LOCALE_META[locale].ogLocale, siteName: getMessages(locale).landing.brand.name });
    expect(meta.twitter).toMatchObject({ title, description });
    expect(meta.keywords).toEqual([...site.keywords]);
    expect(meta.metadataBase).toEqual(new URL(SITE_URL));
  });

  it('/learners links itself in every shown locale on a QA build', () => {
    expect(siteAlternates('/learners', true)).toEqual({
      languages: { en: '/learners', es: '/es/learners', ko: '/ko/learners', 'x-default': '/learners' },
    });
    expect(siteMetadataFor('es', '/learners', true).alternates?.canonical).toBe('/es/learners');
  });

  it('the site address is the production origin (hreflang URLs are absolute)', () => {
    expect(SITE_URL).toBe('https://hangulroute.com');
  });
});
