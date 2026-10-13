import type { RomanizationMode, UiLocale } from '@hangul-route/content-schema';
import { availableLocales } from '@hangul-route/i18n';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RomanizationModeOverride } from '../../i18n/use-romanization-mode';
import { homeLines } from '../../logic/browse/home-view';
import type { BrowsePrefs } from '../../logic/browse/prefs';
import { keepOff, keepOn, readKeepState, savePrefs } from '../../platform/browse-keep';
import { useLocaleStore } from '../../store/locale-store';
import { useBrowseSession } from './browse-session';

/**
 * Lesson display settings and the keep switch for this tab (F-BROWSE-001
 * sections 4.3 and 4.9; mocks `design/screens/browse/lesson-display.md` and
 * `home.md`). Romanization and the UI language live in memory for the tab;
 * with the keep switch on they are also written to `browse:prefs` and read
 * back on the next visit. Every learner renderer below reads the mode through
 * `useRomanizationMode()` (BR-5c), and the language is applied through the
 * locale store's in-memory `setSessionLocale`, so no learner profile's setting
 * and never the device locale is read or written.
 */
export interface BrowseSettings {
  romanization: RomanizationMode;
  setRomanization: (mode: RomanizationMode) => void;
  /** The UI languages the sheet offers (shipped ones only); one means no Language row. */
  languages: readonly UiLocale[];
  setLanguage: (locale: UiLocale) => void;
  /** The keep switch: `null` while it is read (or not offered for this pass). */
  kept: boolean | null;
  setKept: (on: boolean) => void;
  /** The last switch-on could not keep the lessons (the switch went back off): the row says so. */
  keepFailed: boolean;
}

const BrowseSettingsContext = createContext<BrowseSettings | null>(null);

export function BrowseSettingsProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { pass, gatingEnabled, online } = useBrowseSession();
  // The learner default with no profile (`resolveRomanizationMode`).
  const [romanization, setMode] = useState<RomanizationMode>('always');
  const [language, setLanguageState] = useState<UiLocale | undefined>(undefined);
  const [kept, setKeptState] = useState<boolean | null>(null);
  const [keepFailed, setKeepFailed] = useState(false);
  const keepOffered = pass !== null && homeLines({ pass, gatingEnabled, online }).keep;
  const languages = useMemo(() => availableLocales(), []);
  // The latest values, for the writes that follow a change.
  const latest = useRef({ romanization, language, kept });
  latest.current = { romanization, language, kept };

  const applyLanguage = useCallback((locale: UiLocale): void => {
    setLanguageState(locale);
    useLocaleStore.getState().setSessionLocale(locale);
  }, []);

  // Keep switch on: the kept settings come back with the kept pass (section 4.3).
  useEffect(() => {
    if (!keepOffered) return undefined;
    let live = true;
    void readKeepState(Date.now()).then((state) => {
      if (!live) return;
      setKeptState(state.kept);
      if (state.prefs) {
        setMode(state.prefs.romanization);
        if (state.prefs.uiLocale && languages.includes(state.prefs.uiLocale)) applyLanguage(state.prefs.uiLocale);
      }
    });
    return () => {
      live = false;
    };
  }, [keepOffered, languages, applyLanguage]);

  const prefsOf = (over: Partial<BrowsePrefs>): BrowsePrefs => {
    const lang = over.uiLocale ?? latest.current.language;
    return { v: 1, romanization: over.romanization ?? latest.current.romanization, ...(lang ? { uiLocale: lang } : {}) };
  };

  const setRomanization = useCallback((mode: RomanizationMode): void => {
    setMode(mode);
    void savePrefs(latest.current.kept === true, prefsOf({ romanization: mode }));
    // prefsOf reads refs only.
  }, []);

  const setLanguage = useCallback(
    (locale: UiLocale): void => {
      applyLanguage(locale);
      void savePrefs(latest.current.kept === true, prefsOf({ uiLocale: locale }));
    },
    [applyLanguage],
  );

  const setKept = useCallback((on: boolean): void => {
    setKeepFailed(false);
    if (on) {
      setKeptState(true);
      void keepOn(Date.now(), prefsOf({})).then((ok) => {
        // A later tap may have turned it off meanwhile; that tap's removal runs after this write (keepOff waits).
        if (!ok && latest.current.kept === true) {
          setKeptState(false);
          setKeepFailed(true);
        }
      });
    } else {
      // The tab keeps the pass it resolved in memory until it closes or reloads (section 4.3).
      setKeptState(false);
      void keepOff();
    }
  }, []);

  const value = useMemo(
    () => ({ romanization, setRomanization, languages, setLanguage, kept: keepOffered ? kept : null, setKept, keepFailed }),
    [romanization, setRomanization, languages, setLanguage, keepOffered, kept, setKept, keepFailed],
  );
  return (
    <BrowseSettingsContext.Provider value={value}>
      <RomanizationModeOverride mode={romanization}>{children}</RomanizationModeOverride>
    </BrowseSettingsContext.Provider>
  );
}

export function useBrowseSettings(): BrowseSettings {
  const settings = useContext(BrowseSettingsContext);
  if (settings === null) throw new Error('useBrowseSettings outside BrowseSettingsProvider');
  return settings;
}
