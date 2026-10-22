import { DEFAULT_LOCALE, LOCALE_META, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { Metadata } from 'next';
import { landingCopy } from '../data/landing-copy';
import { isShippedSiteLocale, isSiteLocale, siteLocaleParams, siteShowAllLocales } from './site-locales';
import { sitePath } from './site-path';

/**
 * Per-locale metadata and hreflang for the site's pages (F-I18N-001 §3.4, PR 11c). Each page in `(en)` and
 * `(loc)/[locale]` exports `generateMetadata` from here: the title, description and Open Graph words come from
 * that locale's dictionary, and `alternates.languages` links the same page in every locale a visitor can
 * reach. While es and ko are hidden there are no alternates, so the English pages' HTML stays as it was.
 */

/** The production origin: the canonical and hreflang URLs are absolute, on it (`siteUrl`). */
export const SITE_URL = 'https://hangulroute.com';

/**
 * The absolute URL of a site path on `SITE_URL`; the English home is `https://hangulroute.com/`, with its slash, in the
 * sitemap, the canonical and the hreflang alternates alike (AMENDMENTS-SITE-NEWUSER SN-2). The metadata spells these
 * out instead of resolving them against `metadataBase`, because Next drops the slash of a root URL it resolves.
 */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/**
 * The site's icons (SN-2), files in `public/` resized from the learner app's icon (apps/mobile/public/icon-1024.png):
 * `favicon.ico` 48 px, `icon.png` 512 px, `apple-icon.png` 180 px. On the site pages and the 404 pages only, so the
 * console pages on the app host, which never get these files, keep the learner app's own favicon there.
 */
export const SITE_ICONS = {
  icon: [
    { url: '/favicon.ico', sizes: '48x48' },
    { url: '/icon.png', type: 'image/png', sizes: '512x512' },
  ],
  apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
} as const satisfies Metadata['icons'];

/** The share image's size (AMENDMENTS-SITE-NEWUSER §3.14): 1200 x 630, the large-card size of Open Graph and X. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * The share image of `locale` (§3.14, row SN-2): `public/site/<locale>/og.png` (made by `scripts/site-og.mjs` from the
 * design drawing), absolute on `SITE_URL`, with its alt text in the locale (`landing.captures.og`, the brand and the
 * tagline the image shows). A hidden locale's folder leaves the export with its pages (`prune-hidden-locales.mjs`).
 */
export function siteShareImage(locale: UiLocale): { url: string; width: number; height: number; alt: string } {
  const t = getMessages(locale).landing;
  return { url: siteUrl(`/site/${locale}/og.png`), ...SHARE_IMAGE_SIZE, alt: t.captures.og(t.brand.name, t.meta.tagline) };
}

/**
 * The site's pages, as English paths; `sitePath` puts the locale in front. The persona pages of F-SITE-002 (§3.4 to
 * §3.6) join as they ship: `/learners` in S-4a, `/parents` and `/teachers` in S-4b. `/licenses` is the open-source
 * notices (owner decision 2026-10-14, the proprietary LICENSE).
 */
export const SITE_PAGES = ['/', '/about', '/privacy', '/terms', '/learners', '/parents', '/teachers', '/licenses'] as const;
export type SitePage = (typeof SITE_PAGES)[number];

/**
 * The pages with their own title and description, keyed by path, and their key in `landing.meta.pages`: the persona
 * pages (F-SITE-002 §3.12) and, since AMENDMENTS-SITE-NEWUSER SN-2, About, the legal pages and the open-source notices.
 * The home page keeps the site's own words.
 */
const PAGE_META = {
  '/learners': 'learners',
  '/parents': 'parents',
  '/teachers': 'teachers',
  '/about': 'about',
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/licenses': 'licenses',
} as const satisfies Partial<Record<SitePage, string>>;

/** A page's own title and description in `<title>`, Open Graph and Twitter; none for the home page. */
function pageWords(locale: UiLocale, page: SitePage): Metadata {
  if (!(page in PAGE_META)) return {};
  const site = landingCopy(locale).metadata;
  const { title, description } = getMessages(locale).landing.meta.pages[PAGE_META[page as keyof typeof PAGE_META]];
  return {
    title,
    description,
    openGraph: { ...site.openGraph, title, description },
    twitter: { ...site.twitter, title, description },
  };
}

/** English and every site locale that has shipped (all of them on a QA build), English first. */
export function shownSiteLocales(showAll: boolean = siteShowAllLocales()): UiLocale[] {
  return [DEFAULT_LOCALE, ...siteLocaleParams().map(({ locale }) => locale).filter((locale) => isShippedSiteLocale(locale, showAll))];
}

/** `alternates` for `page`: the page in each shown locale plus `x-default` (English); none while only English ships. */
export function siteAlternates(page: SitePage, showAll: boolean = siteShowAllLocales()): Metadata['alternates'] | undefined {
  const shown = shownSiteLocales(showAll);
  if (shown.length < 2) return undefined;
  const languages: Record<string, string> = {};
  for (const locale of shown) languages[LOCALE_META[locale].htmlLang] = sitePath(locale, page);
  languages['x-default'] = sitePath(DEFAULT_LOCALE, page);
  return { languages };
}

/** `alternates` with every URL absolute on `SITE_URL` (`siteUrl`), as the sitemap names them. */
function absoluteAlternates(canonical: string, languages: Record<string, string>): NonNullable<Metadata['alternates']> {
  return {
    canonical: siteUrl(canonical),
    languages: Object.fromEntries(Object.entries(languages).map(([lang, path]) => [lang, siteUrl(path)])),
  };
}

/**
 * The metadata of `page` in `locale`. A hidden locale is `noindex` and names no alternates. With alternates the page
 * also names itself as canonical (`alternates.canonical`, also `og:url`), as search engines expect beside hreflang;
 * every one of these URLs is absolute and the English home keeps its slash, as in the sitemap (SN-2). Open Graph names
 * the other shown locales (`og:locale:alternate`), and the page carries the site's icons and, in a shown locale, that
 * locale's share image as a large card (`summary_large_image`; §3.14).
 */
export function siteMetadataFor(locale: UiLocale, page: SitePage, showAll: boolean = siteShowAllLocales()): Metadata {
  const hidden = isSiteLocale(locale) && !isShippedSiteLocale(locale, showAll);
  const languages = hidden ? undefined : (siteAlternates(page, showAll)?.languages as Record<string, string> | undefined);
  const alternates = languages ? absoluteAlternates(sitePath(locale, page), languages) : undefined;
  const site = landingCopy(locale).metadata;
  const words = pageWords(locale, page);
  const alternateLocale = hidden ? [] : shownSiteLocales(showAll).filter((other) => other !== locale).map((other) => LOCALE_META[other].ogLocale);
  const image = hidden ? undefined : siteShareImage(locale);
  return {
    ...site,
    ...words,
    icons: SITE_ICONS,
    openGraph: {
      ...site.openGraph,
      ...words.openGraph,
      ...(alternates ? { url: alternates.canonical as string } : {}),
      ...(alternateLocale.length > 0 ? { alternateLocale } : {}),
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      ...site.twitter,
      ...words.twitter,
      ...(image ? { card: 'summary_large_image' as const, images: [{ url: image.url, alt: image.alt }] } : {}),
    },
    ...(alternates ? { alternates } : {}),
    ...(hidden ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * The metadata of the 404 page in `locale` (SN-2): its one `<title>` (`notFound.title`) and the site's icons. `robots`
 * is `noindex` alone: the English 404 (`app/not-found.tsx`) gets that line from Next, so it passes `nextAddsNoindex`
 * and clears the site's `index, follow`; the `/es` and `/ko` 404 pages are ordinary exported pages and say it here.
 */
export function siteNotFoundMetadata(locale: UiLocale, nextAddsNoindex = false): Metadata {
  const site = landingCopy(locale).metadata;
  const title = getMessages(locale).landing.notFound.title;
  return {
    ...site,
    title,
    icons: SITE_ICONS,
    openGraph: { ...site.openGraph, title },
    twitter: { ...site.twitter, title },
    robots: nextAddsNoindex ? null : { index: false },
  };
}
