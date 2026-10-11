import { DEFAULT_LOCALE, bannedWordsFor, findBannedWord as findBannedFor, type UiLocale } from '@hangul-route/i18n';

/**
 * Caregiver-surface copy guard (F-HW-001 §3.3, F-PAR-001 §3.6, F-CONSOLE-001 §3.5).
 * A thin re-export of `@hangul-route/i18n`, whose `banned-words.json` is the one list
 * per locale and surface (F-I18N-001 §3.1); the hand-kept mirror is gone. English
 * stays the default locale, so existing callers do not change.
 */

/** The English caregiver list: the learner words plus "behind" and "lazy". */
export const BANNED_WORDS: readonly string[] = bannedWordsFor(DEFAULT_LOCALE, 'caregiver');

/** The first caregiver-banned word in `text` for `locale` (whole tokens in en/es, substrings in ko), or null. */
export function findBannedWord(text: string, locale: UiLocale = DEFAULT_LOCALE): string | null {
  return findBannedFor(text, locale, 'caregiver');
}

export function isCaregiverSafe(text: string, locale: UiLocale = DEFAULT_LOCALE): boolean {
  return findBannedWord(text, locale) === null;
}
