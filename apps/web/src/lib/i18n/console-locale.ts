import { DEFAULT_TEXT_SIZE, TextSizeSchema, UiLocaleSchema, type TextSize } from '@hangul-route/content-schema';
import { detectLocale, type UiLocale } from '@hangul-route/i18n';
import type { DeviceSettingsRead } from './device-settings';
import { browserStorage, readItem, writeItem, type KeyValueStorage } from './safe-storage';

/**
 * The console's UI locale and text size — F-I18N-001 §3.2 / §3.3; owner items 6 and 7: one UI
 * language per device and per account. The grown-up pages read and write the device's one
 * display record (`hr:device:settings`, `device-settings.ts`), which the learner app on the same
 * origin shares. Pure and total; the React provider (`locale-context.tsx`) is a thin layer over
 * these.
 */

/**
 * A read-through mirror of the record's language in `localStorage` (safe-storage): written each
 * time the record resolves, read for the first paint and where IndexedDB cannot be read. It is
 * never the source of truth while the record can be read.
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
  /** A `?lang=` to store as the device's language: only for a readable device that never chose. */
  seed: UiLocale | null;
}

/**
 * The console's language and text size (owner items 6 and 7), among `available` only (a hidden
 * locale is passed over at every step):
 *
 * - the device record readable: its language (a choice made in the learner app, All lessons, the
 *   presenter or here, or an account's language a sign-in merged in) > a `?lang=`, which then
 *   seeds the device because it never chose > the browser languages > `en`; its text size;
 * - the record unreadable (no IndexedDB, a failed read): `?lang=` > the mirror > the browser
 *   languages > `en`; the mirrored text size. Nothing is seeded.
 *
 * A stored console choice from before this change (the mirror) never overrides the device: on
 * one device the learner app and the grown-up pages speak one language.
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
    if (visible(chosen)) return { locale: chosen, textSize, seed: null };
    if (visible(input.query)) return { locale: input.query, textSize, seed: input.query };
    return { locale: detected, textSize, seed: null };
  }
  const textSize = input.mirror.textSize ?? DEFAULT_TEXT_SIZE;
  if (visible(input.query)) return { locale: input.query, textSize, seed: null };
  if (visible(input.mirror.locale)) return { locale: input.mirror.locale, textSize, seed: null };
  return { locale: detected, textSize, seed: null };
}

/** The first paint, before the record is read: the mirror, else the browser languages (never the query: it may not win). */
export function firstPaintLocale(input: { mirror: UiLocale | null; languages: readonly string[]; available: readonly UiLocale[] }): UiLocale {
  if (input.mirror !== null && input.available.includes(input.mirror)) return input.mirror;
  return detectLocale(input.languages, input.available);
}
