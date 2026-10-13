import type { MetadataRoute } from 'next';
import { SITE_PAGES, SITE_URL, shownSiteLocales, siteAlternates } from './site-metadata';
import { siteShowAllLocales } from './site-locales';
import { sitePath } from './site-path';

/**
 * `robots.txt` and `sitemap.xml` of hangulroute.com (F-SITE-002 §3.10, S-9). `app/robots.ts` and `app/sitemap.ts`
 * return these, and the static export writes them to `out/`. The site is intro-only: the sitemap names the site's
 * own pages (`SITE_PAGES`) in every shown locale and nothing of the app (no grown-up path, no `/design-preview`).
 */

/** The absolute URL of a site path on `SITE_URL`; the English home is `https://hangulroute.com/`. */
function absolute(path: string): string {
  return `${SITE_URL}${path}`;
}

/**
 * Everyone may crawl the site except the design contact sheets; the sitemap is named on `SITE_URL`. The rule is the
 * bare prefix `/design-preview`, so it covers the index sheet at `/design-preview` (no trailing slash) as well as
 * every sheet under `/design-preview/`.
 */
export function siteRobots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/design-preview' },
    sitemap: absolute('/sitemap.xml'),
  };
}

/**
 * Every page of `SITE_PAGES` in every shown locale, English first. With a second shown locale each entry names the
 * same page in every shown locale plus `x-default` (English) as hreflang alternates; while only English ships there
 * are none. The alternates are the pages' own `siteAlternates()` made absolute, so the sitemap and the in-page
 * `<link rel="alternate">` tags never drift apart.
 */
export function siteSitemap(showAll: boolean = siteShowAllLocales()): MetadataRoute.Sitemap {
  const shown = shownSiteLocales(showAll);
  return shown.flatMap((locale) =>
    SITE_PAGES.map((page) => {
      const url = absolute(sitePath(locale, page));
      const languages = siteAlternates(page, showAll)?.languages;
      if (!languages) return { url };
      const absoluteLanguages: Record<string, string> = {};
      for (const [lang, href] of Object.entries(languages)) {
        if (typeof href === 'string') absoluteLanguages[lang] = absolute(href);
      }
      return { url, alternates: { languages: absoluteLanguages } };
    }),
  );
}
