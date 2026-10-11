'use client';

import {
  DEFAULT_LOCALE,
  LOCALE_META,
  availableLocales,
  getMessages,
  type Messages,
  type UiLocale,
} from '@hangul-route/i18n';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { browserLanguages, pickConsoleLocale, readStoredLocale, writeStoredLocale } from './console-locale';

/**
 * Console locale provider — F-I18N-001 §3.2. The static HTML is always English
 * (the locale of the `/teach` route); after mount the stored choice, else the
 * browser languages, picks the locale among `availableLocales()`, and the client
 * re-renders in place. `<html lang>` follows the choice and is restored when the
 * console unmounts. No telemetry: the web console has no telemetry client.
 */
export interface ConsoleLocale {
  locale: UiLocale;
  messages: Messages;
  /** Locales the header select may offer (only shipped ones, unless the QA flag is set). */
  available: readonly UiLocale[];
  /** Switches the console and keeps the choice in `hr:console:uiLocale` (this page only when storage is blocked). */
  setLocale: (locale: UiLocale) => void;
}

const ENGLISH_ONLY: readonly UiLocale[] = [DEFAULT_LOCALE];

const LocaleContext = createContext<ConsoleLocale>({
  locale: DEFAULT_LOCALE,
  messages: getMessages(DEFAULT_LOCALE),
  available: ENGLISH_ONLY,
  setLocale: () => undefined,
});

export function LocaleProvider({ children, available }: { children: ReactNode; available?: readonly UiLocale[] }): JSX.Element {
  const offered = useMemo(() => available ?? availableLocales(), [available]);
  const [locale, setLocaleState] = useState<UiLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(pickConsoleLocale({ stored: readStoredLocale(), languages: browserLanguages(), available: offered }));
  }, [offered]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.lang;
    root.lang = LOCALE_META[locale].htmlLang;
    return () => {
      root.lang = previous;
    };
  }, [locale]);

  const setLocale = useCallback(
    (next: UiLocale) => {
      if (!offered.includes(next)) return;
      writeStoredLocale(next);
      setLocaleState(next);
    },
    [offered],
  );

  const value = useMemo<ConsoleLocale>(
    () => ({ locale, messages: getMessages(locale), available: offered, setLocale }),
    [locale, offered, setLocale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useConsoleLocale(): ConsoleLocale {
  return useContext(LocaleContext);
}

/** The console's UI locale. */
export function useLocale(): UiLocale {
  return useContext(LocaleContext).locale;
}

/** The dictionary for the console's UI locale; re-renders when it changes. */
export function useMessages(): Messages {
  return useContext(LocaleContext).messages;
}

/** The setter behind the header select. */
export function useSetLocale(): (locale: UiLocale) => void {
  return useContext(LocaleContext).setLocale;
}
