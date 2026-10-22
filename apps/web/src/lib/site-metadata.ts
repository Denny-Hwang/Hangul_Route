import { DEFAULT_LOCALE, LOCALE_META, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { Metadata } from 'next';
import { landingCopy } from '../data/landing-copy';
import { isShippedSiteLocale, isSiteLocale, siteLocaleParams, siteShowAllLocales } from './site-locales';
import { sitePath } from './site-path';

/**
 * Per-locale metadata and hreflang for the site's pages (F-I18N-001 §3.4, PR 11c). Each page in `(en)` and
 * `(loc)/[locale]` exports `generateMetadata` from here: the title, description and Open Graph words come from
 * that locale's dictionary, and `alternates.languages` links the same page in every locale a visitor can
 * reach. es and ko ship (LOCALE_STATUS, 2026-10-14), so every page names its alternates; a hidden locale would name none.
 */

/** The production origin: hreflang URLs are absolute, resolved against it (`metadataBase`). */
export const SITE_URL = 'https://hangulroute.com';

/**
 * The site's pages, as English paths; `sitePath` puts the locale in front. The persona pages of F-SITE-002 (§3.4 to
 * §3.6) join as they ship: `/learners` in S-4a, `/parents` and `/teachers` in S-4b. `/licenses` is the open-source
 * notices (owner decision 2026-10-14, the proprietary LICENSE).
 */
export const SITE_PAGES = ['/', '/about', '/privacy', '/terms', '/learners', '/parents', '/teachers', '/licenses'] as const;
export type SitePage = (typeof SITE_PAGES)[number];

/** The persona pages, keyed by path, and the key of their own title and description (`landing.meta.pages`). */
const PERSONA_META = { '/learners': 'learners', '/parents': 'parents', '/teachers': 'teachers' } as const satisfies Partial<Record<SitePage, string>>;

/** A persona page's own title and description in `<title>`, Open Graph and Twitter (F-SITE-002 §3.12); else none. */
function pageWords(locale: UiLocale, page: SitePage): Metadata {
  if (!(page in PERSONA_META)) return {};
  const site = landingCopy(locale).metadata;
  const { title, description } = getMessages(locale).landing.meta.pages[PERSONA_META[page as keyof typeof PERSONA_META]];
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

/**
 * The metadata of `page` in `locale`. A hidden locale is `noindex` and names no alternates. With alternates the page
 * also names itself as canonical (`alternates.canonical`), as search engines expect beside hreflang.
 */
export function siteMetadataFor(locale: UiLocale, page: SitePage, showAll: boolean = siteShowAllLocales()): Metadata {
  const hidden = isSiteLocale(locale) && !isShippedSiteLocale(locale, showAll);
  const alternates = hidden ? undefined : siteAlternates(page, showAll);
  return {
    ...landingCopy(locale).metadata,
    ...pageWords(locale, page),
    metadataBase: new URL(SITE_URL),
    ...(alternates ? { alternates: { canonical: sitePath(locale, page), ...alternates } } : {}),
    ...(hidden ? { robots: { index: false, follow: false } } : {}),
  };
}
