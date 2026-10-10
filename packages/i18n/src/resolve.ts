import { en } from './messages/en';
import { es } from './messages/es/index';
import { ko } from './messages/ko';
import { pseudoLocaleEnabled } from './env';
import type { UiLocale } from './locales';
import { PSEUDO_LOCALE, pseudoLocalize } from './pseudo';
import { deepMerge, leafPaths } from './tree';
import type { DeepPartial, Messages } from './types';

/** Locales `getMessages` accepts: the UI locales plus the QA pseudo-locale. */
export type MessageLocale = UiLocale | typeof PSEUDO_LOCALE;

const OVERLAYS: Record<UiLocale, DeepPartial<Messages>> = { en: {}, es, ko };

/** First defined of profile, device, detected; else `en` (F-I18N-001 §3.1). */
export function resolveLocale(input: {
  profile?: UiLocale | null;
  device?: UiLocale | null;
  detected?: UiLocale | null;
}): UiLocale {
  return input.profile ?? input.device ?? input.detected ?? 'en';
}

const cache = new Map<MessageLocale, Messages>();

/**
 * The dictionary for an explicit locale: English with that locale's overlay laid
 * over it, so a missing key falls back to English. Memoised per locale.
 * `en-XA` is pseudo-localised English, and only when the build flag is set.
 */
export function getMessages(locale: MessageLocale): Messages {
  if (locale === 'en') return en;
  const cached = cache.get(locale);
  if (cached !== undefined) return cached;
  if (locale === PSEUDO_LOCALE) {
    if (!pseudoLocaleEnabled()) return en;
    const pseudo = pseudoLocalize<Messages>(en);
    cache.set(locale, pseudo);
    return pseudo;
  }
  const merged = deepMerge<Messages>(en, OVERLAYS[locale]);
  cache.set(locale, merged);
  return merged;
}

/** Dotted paths that fell back to English for `locale` (tests and `scripts/i18n-status.mjs`). */
export function fallbackPaths(locale: MessageLocale): string[] {
  if (locale === 'en' || locale === PSEUDO_LOCALE) return [];
  const translated = new Set(leafPaths(OVERLAYS[locale]));
  return leafPaths(en).filter((path) => !translated.has(path));
}
