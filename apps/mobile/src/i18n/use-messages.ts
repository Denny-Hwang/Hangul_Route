import { dictionaryLocale, getMessages, LOCALE_META, type Messages, type UiLocale } from '@hangul-route/i18n';
import { useEffect, useMemo } from 'react';
import { setDocumentLang } from '../platform/locale';
import { activeLocale, useLocaleStore } from '../store/locale-store';

/**
 * Hooks over the tested locale store and `getMessages` (F-I18N-001 §3.2). No unit
 * test of their own — the mobile vitest config cannot render hooks, like
 * `platform/motion.ts` — and `e2e/web/locale.spec.ts` exercises them. Business
 * logic never imports these: it takes a message subtree or a locale as a parameter.
 */

/** The device's UI locale (device record > detection > `en`; one language per device, owner items 6 and 7). */
export function useLocale(): UiLocale {
  return useLocaleStore(activeLocale);
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
