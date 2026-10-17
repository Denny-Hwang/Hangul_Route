import { LOCALE_META, LOCALES, resolveLocale, type UiLocale } from '@hangul-route/i18n';

/**
 * Rules behind the Welcome language row and the Display sheet's languages
 * (F-I18N-001 §3.3; AMENDMENTS-DISPLAY-NAV section 3.6: one language per device, so
 * there is no per-profile choice any more). Pure, so the "who sees what" decisions
 * are tested without a renderer; the components only paint what these return.
 */

export interface LanguageOption {
  locale: UiLocale;
  /** The language's own name: a constant, never a message. */
  endonym: string;
  /** `lang` for the chip, so a screen reader says the name in its own language. */
  htmlLang: string;
}

/** Chips for the available locales, always in the fixed order of `LOCALES` (never reshuffled by detection). */
export function languageOptions(available: readonly UiLocale[]): LanguageOption[] {
  return LOCALES.filter((locale) => available.includes(locale)).map((locale) => ({
    locale,
    endonym: LOCALE_META[locale].endonym,
    htmlLang: LOCALE_META[locale].htmlLang,
  }));
}

/** The pickers exist only when there is something to choose between; with English alone nothing new is drawn. */
export function showLanguagePickers(available: readonly UiLocale[]): boolean {
  return available.length >= 2;
}

/** The chip on in Welcome's language row: the stored choice, else detection, else English. */
export function deviceChoice(device: UiLocale | null, detected: UiLocale, available: readonly UiLocale[]): UiLocale {
  const effective = resolveLocale({ device, detected });
  return available.includes(effective) ? effective : 'en';
}
