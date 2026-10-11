import { LOCALE_META, LOCALES, resolveLocale, type UiLocale } from '@hangul-route/i18n';

/**
 * Rules behind the Welcome language row and the Profile Language card
 * (F-I18N-001 §3.3, wireframe profile/language-picker.md A and B). Pure, so the
 * "who sees what" decisions are tested without a renderer; the components only
 * paint what these return.
 */

export interface LanguageOption {
  locale: UiLocale;
  /** The language's own name: a constant, never a message. */
  endonym: string;
  /** `lang` for the chip, so a screen reader says the name in its own language. */
  htmlLang: string;
}

/** The choice in "This profile": a language of its own, or none (follow the device). */
export type ProfileChoice = UiLocale | 'device';

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

/** The radio on in "This profile". An override of a locale that is no longer offered shows as "Same as this device". */
export function profileChoice(override: UiLocale | undefined, available: readonly UiLocale[]): ProfileChoice {
  return override !== undefined && available.includes(override) ? override : 'device';
}

/** The radio on in "New profiles and this device start in": the stored choice, else detection, else English. */
export function deviceChoice(device: UiLocale | null, detected: UiLocale, available: readonly UiLocale[]): UiLocale {
  const effective = resolveLocale({ device, detected });
  return available.includes(effective) ? effective : 'en';
}

/** The language a "This profile" choice would show. */
export function profileTarget(choice: ProfileChoice, deviceLocale: UiLocale): UiLocale {
  return choice === 'device' ? deviceLocale : choice;
}

export type LanguageChangePlan =
  | { action: 'apply' }
  | { action: 'confirm'; target: UiLocale; previous: UiLocale };

/**
 * A change that keeps the language applies at once; one that switches it first
 * shows the sheet in the new language, with the way back to `previous`.
 */
export function planLanguageChange(current: UiLocale, target: UiLocale): LanguageChangePlan {
  return current === target ? { action: 'apply' } : { action: 'confirm', target, previous: current };
}
