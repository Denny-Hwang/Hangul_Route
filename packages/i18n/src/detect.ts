import { availableLocales, LOCALES, type UiLocale } from './locales';

/**
 * Pick the first preferred language that is available (F-I18N-001 §3.1).
 * `es-MX` -> `es`, `ko_KR` -> `ko`; unknown languages are skipped; none -> `en`.
 * A hidden locale is never chosen, so a Spanish phone sees English until Spanish ships.
 */
export function detectLocale(
  languages: readonly string[],
  available: readonly UiLocale[] = availableLocales(),
): UiLocale {
  for (const tag of languages) {
    const primary = tag.split(/[-_]/)[0].toLowerCase();
    const match = LOCALES.find((locale) => locale === primary);
    if (match !== undefined && available.includes(match)) return match;
  }
  return 'en';
}
