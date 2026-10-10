import { DEFAULT_UI_LOCALE, UI_LOCALES, type UiLocale } from '@hangul-route/content-schema';
import { showAllLocalesEnabled } from './env';

// One source of truth for the locale ids lives in content-schema; i18n depends on it, never the reverse.
export { UI_LOCALES, type UiLocale };

export const LOCALES = UI_LOCALES;
export const DEFAULT_LOCALE: UiLocale = DEFAULT_UI_LOCALE;

export interface LocaleMeta {
  /** The language's own name, shown in pickers. */
  endonym: string;
  /** `<html lang>` / `lang` attribute. */
  htmlLang: string;
  /** Speech and `Intl` tag (F-AUDIO-004 reads this). */
  speechLang: string;
  /** Open Graph locale. */
  ogLocale: string;
}

/** Endonyms and language tags: constants, never messages. */
export const LOCALE_META: Record<UiLocale, LocaleMeta> = {
  en: { endonym: 'English', htmlLang: 'en', speechLang: 'en-US', ogLocale: 'en_US' },
  es: { endonym: 'Español', htmlLang: 'es', speechLang: 'es-US', ogLocale: 'es_419' },
  ko: { endonym: '한국어', htmlLang: 'ko', speechLang: 'ko-KR', ogLocale: 'ko_KR' },
};

export type LocaleStatus = 'shipped' | 'hidden';

/** `es` and `ko` stay hidden until native review flips them (F-I18N-001 §3.10 step 5). */
export const LOCALE_STATUS: Record<UiLocale, LocaleStatus> = {
  en: 'shipped',
  es: 'hidden',
  ko: 'hidden',
};

/**
 * Locales a picker may list and detection may choose. All of them when the QA
 * flag (`EXPO_PUBLIC_SHOW_ALL_LOCALES` / `NEXT_PUBLIC_SHOW_ALL_LOCALES` = `1`) is set.
 */
export function availableLocales(showAll: boolean = showAllLocalesEnabled()): UiLocale[] {
  return LOCALES.filter((locale) => showAll || LOCALE_STATUS[locale] === 'shipped');
}
