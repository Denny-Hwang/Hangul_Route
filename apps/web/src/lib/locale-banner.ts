import { browserStorage, readItem, writeItem, type KeyValueStorage } from './i18n/safe-storage';

/**
 * The "View in <language>" banner on `/` (F-I18N-001 §3.3, PR 11c, wireframe profile/language-picker C). It
 * suggests; it never redirects (the static export has no middleware). Kept free of the dictionary, so the
 * client banner does not load it: the page passes the words in.
 */

/** Session storage key for "dismissed": the banner stays away for the rest of the visit. */
export const LOCALE_BANNER_KEY = 'hr:site:localeBanner';

/**
 * The locale to suggest: the first browser language whose primary subtag (`es-MX` -> `es`) is a shown locale,
 * unless that is English. `null` when English comes first or nothing matches, so a hidden locale is never offered.
 */
export function bannerLocale(languages: readonly string[], shown: readonly string[]): string | null {
  for (const tag of languages) {
    const primary = (tag.split(/[-_]/)[0] ?? '').toLowerCase();
    if (shown.includes(primary)) return primary === 'en' ? null : primary;
  }
  return null;
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
  /** The locale's home, `/es`. */
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
