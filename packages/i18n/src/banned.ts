import bannedWords from './banned-words.json';
import { LOCALES, type UiLocale } from './locales';

export type BannedSurface = 'learner' | 'caregiver';

const RAW: Record<UiLocale, Record<BannedSurface, readonly string[]>> = bannedWords;

function resolveLists(): Record<UiLocale, Record<BannedSurface, readonly string[]>> {
  const out = {} as Record<UiLocale, Record<BannedSurface, readonly string[]>>;
  for (const locale of LOCALES) {
    out[locale] = {
      learner: RAW[locale].learner,
      // The JSON lists only what the caregiver surface ADDS; a caregiver never reads a learner-banned word either.
      caregiver: [...RAW[locale].learner, ...RAW[locale].caregiver],
    };
  }
  return out;
}

/**
 * Banned words per locale and surface, resolved from `banned-words.json` (the one
 * list, also read by `scripts/validate-content.mjs`). The caregiver lists include
 * the learner words.
 */
export const BANNED_WORDS = resolveLists();

export function bannedWordsFor(locale: UiLocale, surface: BannedSurface): readonly string[] {
  return BANNED_WORDS[locale][surface];
}

// Explicit letter ranges (Latin-1 + Latin Extended-A/B accents), not Unicode
// property escapes and not look-behind: neither is verified on Hermes (F-I18N-001 §3.1).
const TOKEN_SPLIT = /[^a-zà-ɏ0-9]+/;

function tokens(text: string): string[] {
  return text.toLowerCase().split(TOKEN_SPLIT).filter((t) => t !== '');
}

/**
 * The first of `words` found in `text`, or null. `en` and `es` match whole
 * tokens ("dismissed" is fine, "vencidos" is not "vencido"; a phrase matches
 * its tokens in a row); `ko` matches substrings because particles attach to
 * the stem (`실패했어요`). Shared by the banned lists and the copy tests that
 * keep their own word lists (F-REPORT-001 section 3.11).
 */
export function findWord(text: string, words: readonly string[], locale: UiLocale): string | null {
  if (locale === 'ko') return words.find((word) => text.includes(word)) ?? null;
  const haystack = ` ${tokens(text).join(' ')} `;
  return words.find((word) => haystack.includes(` ${tokens(word).join(' ')} `)) ?? null;
}

/** The first banned word found in `text`, or null (`findWord` on the locale's list for `surface`). */
export function findBannedWord(text: string, locale: UiLocale, surface: BannedSurface): string | null {
  return findWord(text, BANNED_WORDS[locale][surface], locale);
}

export function isCopySafe(text: string, locale: UiLocale, surface: BannedSurface): boolean {
  return findBannedWord(text, locale, surface) === null;
}

/** Every banned word found across a set of strings, de-duplicated. */
export function scanCopy(texts: readonly string[], locale: UiLocale, surface: BannedSurface): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    const hit = findBannedWord(text, locale, surface);
    if (hit !== null) found.add(hit);
  }
  return [...found];
}
