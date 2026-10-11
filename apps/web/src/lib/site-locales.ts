import { availableLocales, DEFAULT_LOCALE, LOCALES, showAllLocalesEnabled, type UiLocale } from '@hangul-route/i18n';

/**
 * The site's locale routes, `app/(loc)/[locale]` (F-I18N-001 §3.4, PR 11b). English is the default and
 * lives at `/`, so a site locale is any UI locale but English.
 */
export type SiteLocale = Exclude<UiLocale, 'en'>;

export function isSiteLocale(value: unknown): value is SiteLocale {
  return typeof value === 'string' && value !== DEFAULT_LOCALE && (LOCALES as readonly string[]).includes(value);
}

/**
 * `generateStaticParams` for `[locale]`: every site locale. Next 14 refuses an empty list under
 * `output: 'export'` ("missing generateStaticParams()"), and es and ko are both hidden today, so the build
 * renders them all and a hidden one is removed from `out/` after the build (`isShippedSiteLocale`, the
 * `HIDDEN_LOCALE_ATTR` marker and `scripts/prune-hidden-locales.mjs`).
 */
export function siteLocaleParams(): Array<{ locale: SiteLocale }> {
  return LOCALES.filter(isSiteLocale).map((locale) => ({ locale }));
}

/** True once `locale` has shipped, or on a QA build (`NEXT_PUBLIC_SHOW_ALL_LOCALES=1`). */
export function isShippedSiteLocale(locale: SiteLocale, showAll: boolean = showAllLocalesEnabled()): boolean {
  return availableLocales(showAll).includes(locale);
}

/**
 * The `<html>` attribute a hidden locale's pages carry. The web build's postbuild step
 * (`scripts/prune-hidden-locales.mjs`, which names the same attribute) deletes every exported page that has it,
 * so a hidden locale never reaches hangulroute.com.
 */
export const HIDDEN_LOCALE_ATTR = 'data-hr-hidden-locale';
