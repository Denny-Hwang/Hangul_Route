import { LOCALE_META, getMessages } from '@hangul-route/i18n';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { siteMetadata } from '../../data/landing-copy';
import {
  SHARE_IMAGE_SIZE,
  SITE_ICONS,
  SITE_PAGES,
  SITE_URL,
  shownSiteLocales,
  siteAlternates,
  siteMetadataFor,
  siteNotFoundMetadata,
  siteShareImage,
  siteUrl,
} from '../site-metadata';
import { siteSitemap } from '../site-surface';

/** `alternates` as the page names them: every URL absolute on the site, the English home with its slash (SN-2). */
function absoluteAlternates(canonical: string, page: (typeof SITE_PAGES)[number], showAll?: boolean) {
  const languages = Object.fromEntries(Object.entries(siteAlternates(page, showAll)?.languages ?? {}).map(([lang, path]) => [lang, siteUrl(String(path))]));
  return { canonical: siteUrl(canonical), languages };
}

/**
 * Per-locale metadata and hreflang for the site (F-I18N-001 §3.4, PR 11c). The alternates name only the
 * locales a visitor can reach: es and ko ship (F-I18N-001 rows 15b / 16b), so every page links all three,
 * with English as x-default. The hidden-locale paths (noindex, no alternates) are held by
 * `site-hidden-locale.test.ts`, which stands a fixture locale in for one that has not shipped.
 */
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('shownSiteLocales', () => {
  it('is all three now that es and ko ship, English first', () => {
    expect(shownSiteLocales()).toEqual(['en', 'es', 'ko']);
    expect(shownSiteLocales(false)).toEqual(['en', 'es', 'ko']);
  });

  it('is every locale on a QA build, English first, in the dictionary order', () => {
    expect(shownSiteLocales(true)).toEqual(['en', 'es', 'ko']);
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '1');
    expect(shownSiteLocales()).toEqual(['en', 'es', 'ko']);
  });
});

describe('siteAlternates (hreflang)', () => {
  it('links every page in all three shipped locales without the QA flag', () => {
    for (const page of SITE_PAGES) expect(siteAlternates(page, false)).toEqual(siteAlternates(page, true));
    expect(siteAlternates('/', false)).toEqual({ languages: { en: '/', es: '/es', ko: '/ko', 'x-default': '/' } });
  });

  it('links the same page in every shown locale, with English as x-default', () => {
    expect(siteAlternates('/', true)).toEqual({ languages: { en: '/', es: '/es', ko: '/ko', 'x-default': '/' } });
    expect(siteAlternates('/about', true)).toEqual({ languages: { en: '/about', es: '/es/about', ko: '/ko/about', 'x-default': '/about' } });
    expect(siteAlternates('/privacy', true)?.languages).toMatchObject({ es: '/es/privacy' });
    expect(siteAlternates('/terms', true)?.languages).toMatchObject({ ko: '/ko/terms' });
  });
});

describe('siteMetadataFor', () => {
  it('lists the site pages: home, About, the legal pages and the persona pages (F-SITE-002 S-4a, S-4b)', () => {
    expect(SITE_PAGES).toEqual(['/', '/about', '/privacy', '/terms', '/learners', '/parents', '/teachers', '/licenses']);
  });

  it('English home: the site metadata, the icons, og:url and the other locales, and absolute hreflang alternates with itself as canonical', () => {
    const meta = siteMetadataFor('en', '/');
    const { alternates, icons, openGraph, twitter, ...rest } = meta;
    const { openGraph: siteOpenGraph, twitter: siteTwitter, ...siteRest } = siteMetadata;
    expect(rest).toEqual(siteRest);
    expect(icons).toEqual(SITE_ICONS);
    const image = siteShareImage('en');
    expect(openGraph).toEqual({ ...siteOpenGraph, url: 'https://hangulroute.com/', alternateLocale: ['es_419', 'ko_KR'], images: [image] });
    // The large card with the share image (AMENDMENTS-SITE-NEWUSER §3.14); the site's words otherwise.
    expect(twitter).toEqual({ ...siteTwitter, card: 'summary_large_image', images: [{ url: image.url, alt: image.alt }] });
    expect(alternates).toEqual(absoluteAlternates('/', '/'));
    // No metadataBase: Next would drop the home's slash from a URL it resolves against one (SN-2).
    expect(meta.metadataBase).toBeUndefined();
  });

  it('the English home is https://hangulroute.com/ with its slash, in the canonical, hreflang and the sitemap alike (SN-2)', () => {
    const { alternates } = siteMetadataFor('en', '/');
    expect(alternates?.canonical).toBe('https://hangulroute.com/');
    expect(alternates?.languages).toMatchObject({ en: 'https://hangulroute.com/', 'x-default': 'https://hangulroute.com/', es: 'https://hangulroute.com/es' });
    expect(siteSitemap()[0]?.url).toBe(alternates?.canonical);
  });

  it.each(['en', 'es', 'ko'] as const)('%s: every canonical and hreflang URL is the sitemap entry of that page', (locale) => {
    const entries = new Map(siteSitemap().map((entry) => [entry.url, entry]));
    for (const page of SITE_PAGES) {
      const { alternates } = siteMetadataFor(locale, page);
      const entry = entries.get(String(alternates?.canonical));
      expect(entry, `${locale} ${page}`).toBeDefined();
      expect(entry?.alternates?.languages).toEqual(alternates?.languages);
    }
  });

  it.each(['es', 'ko'] as const)('%s: its own words and og:locale; indexable, with alternates (shipped)', (locale) => {
    const meta = siteMetadataFor(locale, '/about', false);
    const l = getMessages(locale).landing.meta.pages.about;
    expect(meta.title).toBe(l.title);
    expect(meta.description).toBe(l.description);
    expect(meta.openGraph).toMatchObject({ locale: LOCALE_META[locale].ogLocale, title: l.title });
    expect(siteMetadataFor(locale, '/', false).title).toBe(getMessages(locale).landing.meta.title);
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates).toEqual(absoluteAlternates(`/${locale}/about`, '/about', false));
  });

  it.each(['en', 'es', 'ko'] as const)('%s on a QA build: indexable, with hreflang alternates and itself as canonical', (locale) => {
    const meta = siteMetadataFor(locale, '/terms', true);
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.alternates).toEqual(absoluteAlternates(locale === 'en' ? '/terms' : `/${locale}/terms`, '/terms', true));
    expect(siteMetadataFor(locale, '/', true).alternates?.canonical).toBe(locale === 'en' ? 'https://hangulroute.com/' : `https://hangulroute.com/${locale}`);
    expect(meta.openGraph).toMatchObject({ locale: LOCALE_META[locale].ogLocale });
  });

  it.each(
    (['en', 'es', 'ko'] as const).flatMap((locale) => (['learners', 'parents', 'teachers'] as const).map((page) => [locale, page] as const)),
  )('%s /%s: its own title and description, in <title>, Open Graph and Twitter', (locale, page) => {
    const meta = siteMetadataFor(locale, `/${page}`, false);
    const site = getMessages(locale).landing.meta;
    const { title, description } = site.pages[page];
    expect(meta.title).toBe(title);
    expect(meta.description).toBe(description);
    expect(meta.openGraph).toMatchObject({ title, description, locale: LOCALE_META[locale].ogLocale, siteName: getMessages(locale).landing.brand.name });
    expect(meta.twitter).toMatchObject({ title, description });
    expect(meta.keywords).toEqual([...site.keywords]);
    expect(meta.icons).toEqual(SITE_ICONS);
  });

  it.each(['/learners', '/parents', '/teachers'] as const)('%s links itself in every shown locale on a QA build', (page) => {
    expect(siteAlternates(page, true)).toEqual({
      languages: { en: page, es: `/es${page}`, ko: `/ko${page}`, 'x-default': page },
    });
    expect(siteMetadataFor('es', page, true).alternates?.canonical).toBe(`https://hangulroute.com/es${page}`);
  });

  /** The pages with their own words since SN-2, and their key in `landing.meta.pages`. */
  const SN2_PAGES = [
    ['/about', 'about'],
    ['/privacy', 'privacy'],
    ['/terms', 'terms'],
    ['/licenses', 'licenses'],
  ] as const;

  it.each((['en', 'es', 'ko'] as const).flatMap((locale) => SN2_PAGES.map(([path, key]) => [locale, path, key] as const)))(
    '%s %s: its own title and description in <title>, Open Graph and Twitter (SN-2)',
    (locale, path, key) => {
      const meta = siteMetadataFor(locale, path, false);
      const { title, description } = getMessages(locale).landing.meta.pages[key];
      expect(meta.title).toBe(title);
      expect(meta.description).toBe(description);
      expect(meta.openGraph).toMatchObject({ title, description, locale: LOCALE_META[locale].ogLocale });
      expect(meta.twitter).toMatchObject({ title, description, card: 'summary_large_image' });
    },
  );

  it('the English words of About, the legal pages and the notices are the SN-2 ones', () => {
    const titles = SN2_PAGES.map(([path]) => siteMetadataFor('en', path).title);
    expect(titles).toEqual(['About Hangul Route', 'Privacy Policy — Hangul Route', 'Terms of Service — Hangul Route', 'Open-source notices — Hangul Route']);
    expect(SN2_PAGES.map(([path]) => siteMetadataFor('es', path).title)).toEqual([
      'Acerca de Hangul Route',
      'Política de privacidad: Hangul Route',
      'Términos del servicio: Hangul Route',
      'Avisos de código abierto: Hangul Route',
    ]);
    expect(SN2_PAGES.map(([path]) => siteMetadataFor('ko', path).title)).toEqual([
      'Hangul Route 소개',
      '개인정보 처리방침 — Hangul Route',
      '이용약관 — Hangul Route',
      '오픈소스 라이선스 — Hangul Route',
    ]);
  });

  it.each(['en', 'es', 'ko'] as const)('%s: every site page has a title and a description of its own (8 pages, SN-2)', (locale) => {
    const metas = SITE_PAGES.map((page) => siteMetadataFor(locale, page));
    expect(new Set(metas.map((meta) => meta.title)).size).toBe(SITE_PAGES.length);
    expect(new Set(metas.map((meta) => meta.description)).size).toBe(SITE_PAGES.length);
    // Search snippets are cut near 160 characters; the home page keeps the site's longer description.
    for (const [i, meta] of metas.entries()) {
      expect(typeof meta.title === 'string' && meta.title.length > 0, SITE_PAGES[i]).toBe(true);
      if (SITE_PAGES[i] !== '/') expect(String(meta.description).length, SITE_PAGES[i]).toBeLessThanOrEqual(160);
    }
  });

  it('no two pages share a title across the three locales either (24 titles)', () => {
    const titles = (['en', 'es', 'ko'] as const).flatMap((locale) => SITE_PAGES.map((page) => siteMetadataFor(locale, page).title));
    expect(new Set(titles).size).toBe(24);
  });
});

describe('icons and the share card (SN-2)', () => {
  it('names the favicon, the 512 px icon and the 180 px Apple touch icon, all files in public/', () => {
    expect(SITE_ICONS).toEqual({
      icon: [
        { url: '/favicon.ico', sizes: '48x48' },
        { url: '/icon.png', type: 'image/png', sizes: '512x512' },
      ],
      apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
    });
    const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public');
    expect(readFileSync(join(publicDir, 'favicon.ico')).readUInt16LE(2)).toBe(1);
    for (const [file, size] of [['icon.png', 512], ['apple-icon.png', 180]] as const) {
      const png = readFileSync(join(publicDir, file));
      expect(png.subarray(1, 4).toString('latin1'), file).toBe('PNG');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], file).toEqual([size, size]);
      // Palette PNGs: a browser may fetch these as favicon candidates on a first visit, so they stay small.
      expect(png.length, file).toBeLessThan(40 * 1024);
    }
  });

  it('the site metadata the console inherits names no icon, so the app host keeps the learner app favicon', () => {
    expect(siteMetadata.icons).toBeUndefined();
  });

  // AMENDMENTS-SITE-NEWUSER §3.14 and §8 (row SN-2): a share image per shown locale, as a large card on every page.
  it.each((['en', 'es', 'ko'] as const).flatMap((locale) => SITE_PAGES.map((page) => [locale, page] as const)))(
    '%s %s: an absolute 1200 x 630 og:image with the localized alt, and the large card with the same image',
    (locale, page) => {
      const meta = siteMetadataFor(locale, page);
      const t = getMessages(locale).landing;
      const image = {
        url: `https://hangulroute.com/site/${locale}/og.png`,
        width: 1200,
        height: 630,
        alt: t.captures.og(t.brand.name, t.meta.tagline),
      };
      expect(siteShareImage(locale)).toEqual(image);
      expect(meta.openGraph).toMatchObject({ images: [image] });
      expect(meta.twitter).toMatchObject({ card: 'summary_large_image', images: [{ url: image.url, alt: image.alt }] });
    },
  );

  it.each(['en', 'es', 'ko'] as const)('%s: the share image file exists, is a 1200 x 630 PNG and at most 60 KB', (locale) => {
    const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public');
    const png = readFileSync(join(publicDir, 'site', locale, 'og.png'));
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([SHARE_IMAGE_SIZE.width, SHARE_IMAGE_SIZE.height]);
    expect(png.length).toBeLessThanOrEqual(60 * 1024);
    // The approved drawing (design/screens/site/newuser/head/og-<locale>.png), copied byte for byte by scripts/site-og.mjs.
    const drawing = readFileSync(join(publicDir, '..', '..', '..', 'design', 'screens', 'site', 'newuser', 'head', `og-${locale}.png`));
    expect(png.equals(drawing)).toBe(true);
  });

  it('the console metadata and the 404 pages keep the small card with no image (nothing to preview there)', () => {
    expect(siteMetadata.twitter).toMatchObject({ card: 'summary' });
    expect(siteMetadata.openGraph).not.toHaveProperty('images');
    for (const locale of ['en', 'es', 'ko'] as const) expect(siteNotFoundMetadata(locale).openGraph).not.toHaveProperty('images');
  });

  it.each(['en', 'es', 'ko'] as const)('%s: og:locale:alternate names the other two locales', (locale) => {
    const others = (['en', 'es', 'ko'] as const).filter((other) => other !== locale).map((other) => LOCALE_META[other].ogLocale);
    expect(siteMetadataFor(locale, '/learners').openGraph).toMatchObject({ locale: LOCALE_META[locale].ogLocale, alternateLocale: others });
  });
});

describe('siteNotFoundMetadata (the 404 pages, SN-2)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: one title, the page-not-found words, noindex alone, the icons', (locale) => {
    const meta = siteNotFoundMetadata(locale);
    expect(meta.title).toBe(getMessages(locale).landing.notFound.title);
    expect(meta.robots).toEqual({ index: false });
    expect(meta.icons).toEqual(SITE_ICONS);
    expect(meta.alternates).toBeUndefined();
    expect(meta.openGraph).toMatchObject({ locale: LOCALE_META[locale].ogLocale });
  });

  it('the English 404 clears the site robots line: Next writes noindex on that page itself', () => {
    expect(siteNotFoundMetadata('en', true).robots).toBeNull();
  });
});

describe('the site address', () => {
  it('the site address is the production origin (hreflang URLs are absolute)', () => {
    expect(SITE_URL).toBe('https://hangulroute.com');
    expect(siteUrl('/')).toBe('https://hangulroute.com/');
    expect(siteUrl('/es/about')).toBe('https://hangulroute.com/es/about');
  });
});
