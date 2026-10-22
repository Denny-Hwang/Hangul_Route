import { BUNDLED_MESSAGE_OVERLAYS } from './bundled-messages';
import { en } from './messages/en';
import { pseudoLocaleEnabled } from './env';
import type { UiLocale } from './locales';
import { PSEUDO_LOCALE, pseudoLocalize } from './pseudo';
import { deepMerge, leafPaths } from './tree';
import type { DeepPartial, Messages } from './types';

/** Locales `getMessages` accepts: the UI locales plus the QA pseudo-locale. */
export type MessageLocale = UiLocale | typeof PSEUDO_LOCALE;

/** A UI locale that has a message overlay: every one but English. */
export type OverlayMessageLocale = Exclude<UiLocale, 'en'>;

/**
 * The es / ko overlays in hand: both from the start everywhere but the learner PWA, which registers the
 * active locale's overlay when its chunk arrives (`bundled-messages.ts`, F-CURR-002 §10).
 */
const OVERLAYS: Partial<Record<UiLocale, DeepPartial<Messages>>> = { en: {}, ...BUNDLED_MESSAGE_OVERLAYS };

/**
 * First defined of device, account, detected; else `en` (F-I18N-001 §3.1; one UI language per
 * device and per account since owner items 6 and 7, so there is no per-profile level). `account`
 * is a signed-in grown-up's language, a seed for a device that never chose.
 */
export function resolveLocale(input: {
  device?: UiLocale | null;
  account?: UiLocale | null;
  detected?: UiLocale | null;
}): UiLocale {
  return input.device ?? input.account ?? input.detected ?? 'en';
}

const cache = new Map<MessageLocale, Messages>();

/**
 * Hands in a locale's overlay that the build did not carry from the start (the learner PWA's locale chunk,
 * `bundled-messages.web.ts`); the next `getMessages(locale)` merges it. Registering the same overlay again
 * changes nothing.
 */
export function registerMessageOverlay(locale: OverlayMessageLocale, overlay: DeepPartial<Messages>): void {
  if (OVERLAYS[locale] === overlay) return;
  OVERLAYS[locale] = overlay;
  cache.delete(locale);
}

/** True when `getMessages(locale)` has the locale's own overlay: always for English and the pseudo-locale. */
export function hasMessageOverlay(locale: MessageLocale): boolean {
  return locale === 'en' || locale === PSEUDO_LOCALE || OVERLAYS[locale] !== undefined;
}

/**
 * The dictionary for an explicit locale: English with that locale's overlay laid
 * over it, so a missing key falls back to English. Memoised per locale.
 * `en-XA` is pseudo-localised English, and only when the build flag is set.
 * A locale whose overlay is not in yet (the learner PWA before its locale chunk) reads English, unmemoised.
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
  const overlay = OVERLAYS[locale];
  if (overlay === undefined) return en;
  const merged = deepMerge<Messages>(en, overlay);
  cache.set(locale, merged);
  return merged;
}

/**
 * The dictionary a UI locale is drawn with. A pseudo build (`EXPO_PUBLIC_PSEUDO_LOCALE=1`, a QA flag, §3.11)
 * draws English as `en-XA`, so the layout matrix sees every English string padded and accented without a
 * user-selectable locale; es and ko keep their own dictionaries. Without the flag every locale is itself.
 */
export function dictionaryLocale(locale: UiLocale, pseudo: boolean = pseudoLocaleEnabled()): MessageLocale {
  return pseudo && locale === 'en' ? PSEUDO_LOCALE : locale;
}

/**
 * Dictionary subtrees that stay English in every locale on purpose: the Privacy Policy and the Terms of
 * Service are English-authoritative until legal review (decision L10, F-I18N-001 §4). es / ko show the
 * English text under a localized notice (`landing.legal.draft` and `backHome` stay translatable), so an
 * overlay must not set a leaf under these prefixes (messages.structure.test.ts), and they are not
 * fallbacks: they never count against a locale's key coverage (§3.10 release gate).
 */
export const ENGLISH_AUTHORITATIVE_PREFIXES = ['landing.legal.privacy.', 'landing.legal.terms.'] as const;

/** True when `path` is in a subtree that stays English in every locale (ENGLISH_AUTHORITATIVE_PREFIXES). */
export function isEnglishAuthoritative(path: string): boolean {
  return ENGLISH_AUTHORITATIVE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Dotted paths that fell back to English for `locale` (tests and `scripts/i18n-status.mjs`). The
 * English-authoritative legal text is intentionally English, so it is never listed.
 */
export function fallbackPaths(locale: MessageLocale): string[] {
  if (locale === 'en' || locale === PSEUDO_LOCALE) return [];
  const translated = new Set(leafPaths(OVERLAYS[locale] ?? {}));
  return leafPaths(en).filter((path) => !translated.has(path) && !isEnglishAuthoritative(path));
}
