import { UiLocaleSchema } from '@hangul-route/content-schema';
import { detectLocale, type UiLocale } from '@hangul-route/i18n';
import { browserStorage, readItem, writeItem, type KeyValueStorage } from './safe-storage';

/**
 * The console's UI locale — F-I18N-001 §3.2 / §3.3 (wireframe
 * `design/wireframes/profile/language-picker.md` §C). Pure and total; the React
 * provider (`locale-context.tsx`) is a thin layer over these.
 */

/** Device-local choice made in the console header (a different origin from the learner app). */
export const CONSOLE_LOCALE_KEY = 'hr:console:uiLocale';

/** The stored choice, or null when there is none, storage is blocked or the value is not a UI locale. */
export function readStoredLocale(storage: KeyValueStorage | null = browserStorage('local')): UiLocale | null {
  const parsed = UiLocaleSchema.safeParse(readItem(storage, CONSOLE_LOCALE_KEY));
  return parsed.success ? parsed.data : null;
}

/** False when the choice could not be kept (blocked storage): it then lasts for this page only. */
export function writeStoredLocale(locale: UiLocale, storage: KeyValueStorage | null = browserStorage('local')): boolean {
  return writeItem(storage, CONSOLE_LOCALE_KEY, locale);
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
  try {
    const parsed = UiLocaleSchema.safeParse(new URLSearchParams(search).get('lang'));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * `?lang=` > stored choice > browser languages > `en`, among `available` only: a query, stored
 * or detected locale that is hidden (not yet shipped, or rolled back) is ignored.
 */
export function pickConsoleLocale(input: {
  /** The page's `?lang=` (F-APP-001 section 3.7); the provider stores it as the choice. */
  query?: UiLocale | null;
  stored: UiLocale | null;
  languages: readonly string[];
  available: readonly UiLocale[];
}): UiLocale {
  if (input.query != null && input.available.includes(input.query)) return input.query;
  if (input.stored !== null && input.available.includes(input.stored)) return input.stored;
  return detectLocale(input.languages, input.available);
}
