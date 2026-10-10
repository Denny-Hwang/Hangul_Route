import type { UiLocale } from '@hangul-route/i18n';
import { getLocales } from 'expo-localization';

/**
 * Device language detection (F-I18N-001 §3.3). Native variant, backed by
 * `expo-localization`; Metro picks `locale.web.ts` for the web build. Every
 * function is total: a failing native module reads as "no preference".
 */

/** The device's preferred languages, most preferred first (BCP 47 tags). */
export function deviceLanguages(): readonly string[] {
  try {
    const locales = getLocales() as ReadonlyArray<{ languageTag?: string | null }> | undefined;
    if (!Array.isArray(locales)) return [];
    return locales.flatMap((l) => (typeof l.languageTag === 'string' && l.languageTag.length > 0 ? [l.languageTag] : []));
  } catch {
    return [];
  }
}

/** Web-only `?lang=` hand-off from the landing page; there is none on native. */
export function takeLangHandoff(): UiLocale | null {
  return null;
}

/** Web-only: keeps `<html lang>` in step with the UI locale. No document on native. */
export function setDocumentLang(_htmlLang: string): void {}
