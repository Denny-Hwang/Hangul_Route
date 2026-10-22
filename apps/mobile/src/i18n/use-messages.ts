import { DEFAULT_LOCALE, dictionaryLocale, getMessages, LOCALE_META, type Messages, type UiLocale } from '@hangul-route/i18n';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { lessonContent } from '../content/lessons';
import { localePacks } from '../content/locale-packs';
import { setDocumentLang } from '../platform/locale';
import { activeLocale, useLocaleStore } from '../store/locale-store';

/**
 * Hooks over the tested locale store and `getMessages` (F-I18N-001 §3.2). The render
 * tests `screens/__tests__/use-locale-{grace,titles,packs}.test.tsx` cover their chunk
 * gates, and `e2e/web/locale.spec.ts` exercises them in the app. Business logic never
 * imports these: it takes a message subtree or a locale as a parameter.
 */

/** The locale the screens last drew in: kept while a newly chosen locale's lesson titles or locale chunk load. */
let shownLocale: UiLocale = DEFAULT_LOCALE;

/**
 * The device's UI locale (device record > detection > `en`; one language per device, owner items 6 and 7).
 * The lesson titles of Spanish and Korean are a chunk of their own, loaded for the active locale only
 * (F-CURR-002 §10): a newly chosen locale applies once its titles are in (or failed, which keeps their
 * English), so the whole screen changes language at once, never with English lesson titles left over.
 * It waits for them `TITLES_GRACE_MS` at most (`content/lessons.ts`): past that it applies with the lesson
 * titles in English, and the screens draw again when the chunk arrives (`useLessonTitlesVersion`).
 * On the web the locale's UI messages and content text are a chunk of their own too (`content/locale-packs.ts`):
 * the locale applies only once that chunk is in, with no grace, so a screen is never drawn in a locale whose
 * menus are not there; until then (and while a failed chunk waits for its next try) the screens keep the
 * locale they last drew in. Native builds carry every locale from the start.
 */
export function useLocale(): UiLocale {
  const wanted = useLocaleStore(activeLocale);
  const settled = useSyncExternalStore(lessonContent.subscribe, () => lessonContent.titlesSettled(wanted));
  const packed = useSyncExternalStore(localePacks.subscribe, () => localePacks.isLoaded(wanted));
  // A title chunk that arrives after the grace draws the screen again with its titles.
  useSyncExternalStore(lessonContent.subscribe, lessonContent.titlesVersion);
  useEffect(() => {
    if (!settled) lessonContent.ensureTitles(wanted).catch(() => undefined);
  }, [wanted, settled]);
  useEffect(() => {
    if (!packed) localePacks.ensure(wanted).catch(() => undefined);
  }, [wanted, packed]);
  const ready = settled && packed;
  if (ready) shownLocale = wanted;
  return ready ? wanted : shownLocale;
}

/**
 * Loads these locales' chunks (F-CURR-002 §10) and changes as each arrives: what a screen that draws a
 * locale other than the UI's keys its text on (the level check's test language, the language tiles, the
 * consent sheet's language, the Display sheet's pending language). Constant on native.
 */
export function useLocalePacks(locales: readonly UiLocale[]): number {
  const version = useSyncExternalStore(localePacks.subscribe, localePacks.version);
  const key = locales.join(',');
  useEffect(() => {
    for (const locale of locales) localePacks.ensure(locale).catch(() => undefined);
    // `key` stands for the list, so a new array of the same locales asks nothing again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return version;
}

/**
 * Changes when the active locale's lesson titles arrive (F-CURR-002 §10): a memo of localized lesson
 * titles (`localizeEpisode`, `localizeQuest`, `localizedRouteContent`) keys on it next to the locale,
 * because a title chunk that arrives after `useLocale` applied its locale fills the glosses in place.
 */
export function useLessonTitlesVersion(): number {
  return useSyncExternalStore(lessonContent.subscribe, lessonContent.titlesVersion);
}

/**
 * The dictionary for the UI locale; re-renders when the locale changes. A pseudo build
 * (`EXPO_PUBLIC_PSEUDO_LOCALE=1`, QA only) draws English as `en-XA` (`dictionaryLocale`).
 */
export function useMessages(): Messages {
  const locale = useLocale();
  return useMemo(() => getMessages(dictionaryLocale(locale)), [locale]);
}

/** Keeps `<html lang>` in step with the UI locale (a no-op on native). */
export function useDocumentLang(): void {
  const locale = useLocale();
  useEffect(() => {
    setDocumentLang(LOCALE_META[locale].htmlLang);
  }, [locale]);
}
