import { browserStorage, readItem, writeItem, type KeyValueStorage } from './i18n/safe-storage';

/**
 * The "View in <language>" banner (F-I18N-001 §3.3, PR 11c, wireframe profile/language-picker C), on every English
 * site page since AMENDMENTS-SITE-NEWUSER §3.2. It suggests; it never redirects (the static export has no
 * middleware). Kept free of the dictionary, so the client banner does not load it: the page passes the words in.
 */

/** Session storage key for "dismissed": the banner stays away for the rest of the visit. */
export const LOCALE_BANNER_KEY = 'hr:site:localeBanner';

/**
 * The locale to suggest: the first browser language whose primary subtag (`es-MX` -> `es`) is a shown locale,
 * unless that is English. `null` when English comes first or nothing matches, so a hidden locale is never offered.
 */
export function bannerLocale(languages: readonly string[], shown: readonly string[]): string | null {
  for (const tag of languages) {
    const primary = tag.toLowerCase().replace(/[-_].*$/, '');
    if (shown.includes(primary)) return primary === 'en' ? null : primary;
  }
  return null;
}

/** The browser's preferred languages: `navigator.languages`, else `navigator.language`, else none. */
export function browserLanguages(nav: { languages?: readonly string[]; language?: string } | undefined): readonly string[] {
  if (!nav) return [];
  if (nav.languages && nav.languages.length > 0) return nav.languages;
  return nav.language ? [nav.language] : [];
}

/**
 * True when the visitor arrived from one of the site's own locale pages (`/es`, `/ko/about`): following the footer
 * switcher's English link is an explicit choice of English, so the banner does not offer back the locale they left.
 * `referrer` is `document.referrer` (the full URL for a same-origin link); anything unparsable or cross-origin is `false`.
 */
export function cameFromLocalePage(referrer: string, origin: string, locales: readonly string[]): boolean {
  if (!referrer) return false;
  try {
    const url = new URL(referrer);
    if (url.origin !== origin) return false;
    const first = (url.pathname.split('/')[1] ?? '').toLowerCase().replace(/\.html$/, '');
    return first !== 'en' && locales.includes(first);
  } catch {
    return false;
  }
}

/** The locale the banner offers on `/`: none once dismissed, else `bannerLocale` among English and the offered locales. */
export function localeBannerTarget(languages: readonly string[], offered: readonly string[], dismissed: boolean): string | null {
  if (dismissed) return null;
  return bannerLocale(languages, ['en', ...offered]);
}

export function localeBannerDismissed(storage: KeyValueStorage | null = browserStorage('session')): boolean {
  return readItem(storage, LOCALE_BANNER_KEY) === 'dismissed';
}

/** Remembers the dismissal for the session; `false` when storage is blocked (the banner still closes). */
export function dismissLocaleBanner(storage: KeyValueStorage | null = browserStorage('session')): boolean {
  return writeItem(storage, LOCALE_BANNER_KEY, 'dismissed');
}

/** One suggestion, worded in the suggested locale by the page (`localeBannerOffers` in data/landing-copy.ts). */
export interface LocaleBannerOffer {
  /** The same page in the suggested locale (`/es`, `/es/parents`; on the English 404, the locale home). */
  href: string;
  /** Its `lang` / `hreflang`. */
  lang: string;
  /** The banner's accessible name. */
  label: string;
  /** "View in Español". */
  text: string;
  /** The close button's accessible name. */
  dismiss: string;
  /** The close button's glyph. */
  close: string;
}
