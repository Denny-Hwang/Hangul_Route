import type { UiLocale } from '@hangul-route/i18n';

/**
 * The default UI locale, spelled here so this file stays type-only (`DEFAULT_LOCALE` lives in the
 * dictionary module); `site-locales.test.ts` checks the two agree.
 */
export const SITE_DEFAULT_LOCALE = 'en' satisfies UiLocale;

/**
 * A site page's URL in `locale` (F-I18N-001 §3.4, PR 11b). English lives at the root (`/about`); the
 * other locales are prefixed (`/es/about`). The locale home is `/es`: the export writes `es.html`
 * (`trailingSlash` is off) and the Worker serves it at `/es` and `/es/`. In-page anchors stay as they are.
 * Type-only import, so the landing's client form can call it without loading the dictionary.
 */
export function sitePath(locale: UiLocale, path: string): string {
  if (locale === SITE_DEFAULT_LOCALE || !path.startsWith('/')) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/**
 * The learner app's address from a site page in `locale` (F-I18N-001 §3.3, PR 11c): from `/es` or `/ko` the
 * "Play now" links add `?lang=<locale>`, which the app takes as the device language only when none was chosen
 * yet, then removes from the URL. English links stay as they are.
 */
export function appEntryUrl(appUrl: string, locale: UiLocale): string {
  if (locale === SITE_DEFAULT_LOCALE) return appUrl;
  return `${appUrl}${appUrl.includes('?') ? '&' : '?'}lang=${locale}`;
}
