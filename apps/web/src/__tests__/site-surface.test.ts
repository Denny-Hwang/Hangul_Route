import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GROWN_UP_PREFIXES, isGrownUpPath } from '@hangul-route/content-schema';
import { LOCALES } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import robots, { dynamic as robotsDynamic } from '../app/robots';
import sitemap, { dynamic as sitemapDynamic } from '../app/sitemap';
import { SITE_PAGES, SITE_URL, shownSiteLocales, siteAlternates } from '../lib/site-metadata';
import { sitePath } from '../lib/site-path';
import { siteRobots, siteSitemap } from '../lib/site-surface';

/**
 * F-SITE-002 S-9 (section 3.10): the static export writes `out/robots.txt` and `out/sitemap.xml` from the Next
 * metadata routes `app/robots.ts` and `app/sitemap.ts`. The sitemap lists only the site's own pages
 * (`SITE_PAGES`) in every shown locale; a grown-up path (`isGrownUpPath`) or `/design-preview` never appears.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The path of an absolute sitemap URL with its locale prefix removed, so `/es/teachers` reads `/teachers`. */
function barePath(url: string): string {
  const path = new URL(url).pathname;
  for (const locale of LOCALES) {
    if (path === `/${locale}`) return '/';
    if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1);
  }
  return path;
}

describe('robots.txt (F-SITE-002 S-9)', () => {
  it('is static, so the export writes out/robots.txt', () => {
    expect(robotsDynamic).toBe('force-static');
  });

  it('allows the site, disallows /design-preview (the index sheet and every sheet under it) and names the sitemap', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/', disallow: '/design-preview' },
      sitemap: 'https://hangulroute.com/sitemap.xml',
    });
    expect(siteRobots()).toEqual(robots());
    expect(SITE_URL).toBe('https://hangulroute.com');
  });
});

describe('sitemap.xml (F-SITE-002 S-9)', () => {
  it('is static, so the export writes out/sitemap.xml', () => {
    expect(sitemapDynamic).toBe('force-static');
  });

  it('lists every site page in all three shipped locales by default (F-I18N-001 rows 15b / 16b)', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_ALL_LOCALES', '');
    expect(shownSiteLocales()).toEqual(['en', 'es', 'ko']);
    expect(sitemap()).toEqual(siteSitemap(true));
    expect(sitemap()).toHaveLength(SITE_PAGES.length * 3);
  });

  it('is SITE_PAGES x shown locales, with absolute hreflang alternates once a second locale ships', () => {
    const entries = siteSitemap(true);
    const shown = shownSiteLocales(true);
    expect(shown.length).toBeGreaterThan(1);
    expect(entries).toHaveLength(SITE_PAGES.length * shown.length);

    expect(entries.map((entry) => entry.url)).toEqual(
      shown.flatMap((locale) => SITE_PAGES.map((page) => `${SITE_URL}${sitePath(locale, page)}`)),
    );
    expect(shown).toEqual(['en', 'es', 'ko']);

    const teachers = entries.find((entry) => entry.url === 'https://hangulroute.com/es/teachers');
    expect(teachers).toEqual({
      url: 'https://hangulroute.com/es/teachers',
      alternates: {
        languages: {
          en: 'https://hangulroute.com/teachers',
          es: 'https://hangulroute.com/es/teachers',
          ko: 'https://hangulroute.com/ko/teachers',
          'x-default': 'https://hangulroute.com/teachers',
        },
      },
    });
    const home = entries.find((entry) => entry.url === 'https://hangulroute.com/es');
    expect(home).toEqual({
      url: 'https://hangulroute.com/es',
      alternates: {
        languages: {
          en: 'https://hangulroute.com/',
          es: 'https://hangulroute.com/es',
          ko: 'https://hangulroute.com/ko',
          'x-default': 'https://hangulroute.com/',
        },
      },
    });

    for (const page of SITE_PAGES) {
      expect(entries.filter((entry) => barePath(entry.url) === page)).toHaveLength(shown.length);
    }
  });

  it('names the same alternates as the pages themselves (siteAlternates made absolute)', () => {
    for (const showAll of [false, true]) {
      const entries = siteSitemap(showAll);
      for (const page of SITE_PAGES) {
        const languages = siteAlternates(page, showAll)?.languages;
        const expected = languages
          ? Object.fromEntries(Object.entries(languages).map(([lang, href]) => [lang, `${SITE_URL}${String(href)}`]))
          : undefined;
        for (const entry of entries.filter((item) => barePath(item.url) === page)) {
          expect(entry.alternates?.languages).toEqual(expected);
        }
      }
    }
  });

  it('neither file is a grown-up path, so the console role never copies them to the app host', () => {
    expect(isGrownUpPath('/robots.txt')).toBe(false);
    expect(isGrownUpPath('/sitemap.xml')).toBe(false);
  });

  it('never lists a grown-up path, /design-preview or another origin, on a release or a QA build', () => {
    for (const entries of [siteSitemap(false), siteSitemap(true)]) {
      for (const { url, alternates } of entries) {
        for (const href of [url, ...Object.values(alternates?.languages ?? {}).filter((value): value is string => typeof value === 'string')]) {
          expect(href.startsWith(`${SITE_URL}/`)).toBe(true);
          const path = new URL(href).pathname;
          expect(isGrownUpPath(path)).toBe(false);
          expect(isGrownUpPath(barePath(href))).toBe(false);
          expect(path).not.toMatch(/(^|\/)design-preview(\/|$)/);
        }
      }
    }
  });
});

describe('the export check in preview-deploy.yml (F-SITE-002 S-9)', () => {
  const workflow = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../../.github/workflows/preview-deploy.yml'),
    'utf8',
  );

  it('disallows the same robots prefix the route returns', () => {
    expect(siteRobots().rules).toMatchObject({ disallow: '/design-preview' });
    expect(workflow).toContain("grep -qx 'Disallow: /design-preview' apps/web/out/robots.txt");
  });

  it('rejects every grown-up prefix of GROWN_UP_PREFIXES, so a new prefix cannot slip past the shell check', () => {
    const match = /\(\/\[a-z\]\{2\}\)\?\/\(([a-z|-]+)\)/.exec(workflow);
    expect(match).not.toBeNull();
    const segments = (match?.[1] ?? '').split('|');
    expect(segments).toEqual([...GROWN_UP_PREFIXES.map((prefix) => prefix.slice(1)), 'design-preview']);
  });
});
