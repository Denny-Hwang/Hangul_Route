import { DEFAULT_LOCALE, dictionaryLocale, getMessages, LOCALE_META, type Messages, type UiLocale } from '@hangul-route/i18n';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { lessonContent } from '../content/lessons';
import { setDocumentLang } from '../platform/locale';
import { activeLocale, useLocaleStore } from '../store/locale-store';

/**
 * Hooks over the tested locale store and `getMessages` (F-I18N-001 §3.2). No unit
 * test of their own — the mobile vitest config cannot render hooks, like
 * `platform/motion.ts` — and `e2e/web/locale.spec.ts` exercises them. Business
 * logic never imports these: it takes a message subtree or a locale as a parameter.
 */

/** The locale the screens last drew in: kept while a newly chosen locale's lesson titles load. */
let shownLocale: UiLocale = DEFAULT_LOCALE;

/**
 * The device's UI locale (device record > detection > `en`; one language per device, owner items 6 and 7).
 * The lesson titles of Spanish and Korean are a chunk of their own, loaded for the active locale only
 * (F-CURR-002 §10): a newly chosen locale applies once its titles are in (or failed, which keeps their
 * English), so the whole screen changes language at once, never with English lesson titles left over.
 */
export function useLocale(): UiLocale {
  const wanted = useLocaleStore(activeLocale);
  const settled = useSyncExternalStore(lessonContent.subscribe, () => lessonContent.titlesSettled(wanted));
  useEffect(() => {
    if (!settled) lessonContent.ensureTitles(wanted).catch(() => undefined);
  }, [wanted, settled]);
  if (settled) shownLocale = wanted;
  return settled ? wanted : shownLocale;
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
