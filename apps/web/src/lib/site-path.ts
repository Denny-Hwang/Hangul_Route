import type { UiLocale } from '@hangul-route/i18n';

/**
 * A site page's URL in `locale` (F-I18N-001 §3.4, PR 11b). English lives at the root (`/about`); the
 * other locales are prefixed (`/es/about`). The locale home is `/es`: the export writes `es.html`
 * (`trailingSlash` is off) and the Worker serves it at `/es` and `/es/`. In-page anchors stay as they are.
 * Type-only import, so the landing's client form can call it without loading the dictionary.
 */
export function sitePath(locale: UiLocale, path: string): string {
  if (locale === 'en' || !path.startsWith('/')) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}
