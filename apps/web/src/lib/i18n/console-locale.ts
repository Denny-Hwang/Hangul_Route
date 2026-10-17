import { DEFAULT_TEXT_SIZE, TextSizeSchema, UiLocaleSchema, type TextSize } from '@hangul-route/content-schema';
import { detectLocale, type UiLocale } from '@hangul-route/i18n';
import type { DeviceSettingsRead } from './device-settings';
import { browserStorage, readItem, removeItem, writeItem, type KeyValueStorage } from './safe-storage';

/**
 * The console's UI locale and text size — F-I18N-001 §3.2 / §3.3; owner items 6 and 7: one UI
 * language per device and per account. The grown-up pages read and write the device's one
 * display record (`hr:device:settings`, `device-settings.ts`), which the learner app on the same
 * origin shares. Pure and total; the React provider (`locale-context.tsx`) is a thin layer over
 * these.
 */

/**
 * A read-through mirror of the record's language in `localStorage` (safe-storage): it says what
 * the record's language is (and nothing when the record holds none), read for the first paint and
 * where IndexedDB cannot be read. It is never the source of truth while the record can be read,
 * with one exception: the console's own stored choice from before the record existed is folded
 * into the record of a device with no learner profiles (`resolveConsoleDisplay`).
 */
export const CONSOLE_LOCALE_KEY = 'hr:console:uiLocale';
/** The same mirror for the record's text size. */
export const CONSOLE_TEXT_SIZE_KEY = 'hr:console:textSize';

/** The stored choice, or null when there is none, storage is blocked or the value is not a UI locale. */
export function readStoredLocale(storage: KeyValueStorage | null = browserStorage('local')): UiLocale | null {
  const parsed = UiLocaleSchema.safeParse(readItem(storage, CONSOLE_LOCALE_KEY));
  return parsed.success ? parsed.data : null;
}

/** False when the mirror could not be kept (blocked storage). */
export function writeStoredLocale(locale: UiLocale, storage: KeyValueStorage | null = browserStorage('local')): boolean {
  return writeItem(storage, CONSOLE_LOCALE_KEY, locale);
}

/** The record holds no language: neither does the mirror. */
export function clearStoredLocale(storage: KeyValueStorage | null = browserStorage('local')): void {
  removeItem(storage, CONSOLE_LOCALE_KEY);
}

/** The mirrored text size, or null when there is none, storage is blocked or the value is not a step. */
export function readStoredTextSize(storage: KeyValueStorage | null = browserStorage('local')): TextSize | null {
  const parsed = TextSizeSchema.safeParse(readItem(storage, CONSOLE_TEXT_SIZE_KEY));
  return parsed.success ? parsed.data : null;
}

export function writeStoredTextSize(size: TextSize, storage: KeyValueStorage | null = browserStorage('local')): boolean {
  return writeItem(storage, CONSOLE_TEXT_SIZE_KEY, size);
}

interface NavigatorLike {
  languages?: readonly string[];
  language?: string;
}

/** `navigator.languages`, else `[navigator.language]`, else `[]`; junk entries dropped, never throws. */
export function browserLanguages(
  nav: NavigatorLike | null | undefined = (globalThis as { navigator?: NavigatorLike }).navigator,
): readonly string[] {
  try {
    if (!nav) return [];
    const list = nav.languages && nav.languages.length > 0 ? nav.languages : nav.language ? [nav.language] : [];
    return list.filter((tag): tag is string => typeof tag === 'string' && tag !== '');
  } catch {
    return [];
  }
}

/**
 * The `?lang=` of a URL's query (F-I18N-001 hand-off convention; F-APP-001 section 3.7): a UI
 * locale, or null when absent or not one.
 */
export function queryLocale(search: string): UiLocale | null {
  const parsed = UiLocaleSchema.safeParse(new URLSearchParams(search).get('lang'));
  return parsed.success ? parsed.data : null;
}

export interface ConsoleDisplay {
  locale: UiLocale;
  textSize: TextSize;
  /**
   * A language to store as the device's, stamped `MIGRATED_AT` (it was not chosen on this
   * device just now, so any account choice beats it): only for a readable device that never
   * chose. A `?lang=` hand-off, or the console's own stored choice from before the record existed.
   */
  seed: UiLocale | null;
  /** What the language mirror should say now: a language, `clear` (the record holds none), or `keep` (the record cannot be read). */
  mirror: UiLocale | 'clear' | 'keep';
}

/**
 * The console's language and text size (owner items 6 and 7; AMENDMENTS-DISPLAY-NAV sections
 * 3.3 and 3.4), among `available` only (a hidden locale is passed over at every step):
 *
 * - the device record readable: its language (a choice made in the learner app, All lessons, the
 *   presenter or here, or an account's language a sign-in merged in) > on a device with no
 *   learner profiles, the console's stored choice from before the record existed (folded into the
 *   record) > a `?lang=` (it seeds the device, which never chose) > the browser languages > `en`;
 *   its text size. The account merge runs after this, once signed in.
 * - the record unreadable (no IndexedDB, a failed read): `?lang=` > the mirror > the browser
 *   languages > `en`; the mirrored text size. Nothing is seeded.
 *
 * On a device with learner profiles, an old stored console choice never overrides the device:
 * the learner app's language (chosen, or detected and handed off as `?lang=`) is the device's,
 * and the learner app and the grown-up pages speak one language.
 */
export function resolveConsoleDisplay(input: {
  device: DeviceSettingsRead;
  mirror: { locale: UiLocale | null; textSize: TextSize | null };
  /** The page's `?lang=` (the learner app's hand-off, F-APP-001 section 3.7). */
  query: UiLocale | null;
  languages: readonly string[];
  available: readonly UiLocale[];
}): ConsoleDisplay {
  const visible = (locale: UiLocale | null | undefined): locale is UiLocale => locale != null && input.available.includes(locale);
  const detected = detectLocale(input.languages, input.available);
  if (input.device.readable) {
    const textSize = input.device.value.textSize ?? DEFAULT_TEXT_SIZE;
    const chosen = input.device.value.uiLocale;
    if (visible(chosen)) return { locale: chosen, textSize, seed: null, mirror: chosen };
    if (!input.device.hasProfiles && visible(input.mirror.locale)) return { locale: input.mirror.locale, textSize, seed: input.mirror.locale, mirror: input.mirror.locale };
    if (visible(input.query)) return { locale: input.query, textSize, seed: input.query, mirror: input.query };
    return { locale: detected, textSize, seed: null, mirror: 'clear' };
  }
  const textSize = input.mirror.textSize ?? DEFAULT_TEXT_SIZE;
  if (visible(input.query)) return { locale: input.query, textSize, seed: null, mirror: 'keep' };
  if (visible(input.mirror.locale)) return { locale: input.mirror.locale, textSize, seed: null, mirror: 'keep' };
  return { locale: detected, textSize, seed: null, mirror: 'keep' };
}

/** The first paint, before the record is read: the mirror, else the browser languages (never the query: it may not win). */
export function firstPaintLocale(input: { mirror: UiLocale | null; languages: readonly string[]; available: readonly UiLocale[] }): UiLocale {
  if (input.mirror !== null && input.available.includes(input.mirror)) return input.mirror;
  return detectLocale(input.languages, input.available);
}
