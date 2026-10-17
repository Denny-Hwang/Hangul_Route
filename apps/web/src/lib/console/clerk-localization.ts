import { enUS, esMX, koKR } from '@clerk/localizations';
import type { UiLocale } from '@hangul-route/i18n';

/**
 * The Clerk widget's own words (sign-in, sign-up, verification) in the console's language (owner
 * items 6 and 7), from `@clerk/localizations` pinned to the release of the installed
 * `@clerk/clerk-react`. Spanish is Clerk's Latin-American `esMX`, the es_419 product the style
 * guide's neutral Latin-American Spanish matches (F-I18N-001 §3.10).
 */
export type ClerkLocalization = typeof enUS;

const BY_LOCALE: Readonly<Record<UiLocale, ClerkLocalization>> = { en: enUS, es: esMX, ko: koKR };

export function clerkLocalization(locale: UiLocale): ClerkLocalization {
  return BY_LOCALE[locale];
}
