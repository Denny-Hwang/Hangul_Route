import type { RomanizationMode } from '@hangul-route/content-schema';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RomanizationModeOverride } from '../../i18n/use-romanization-mode';
import { homeLines } from '../../logic/browse/home-view';
import type { BrowsePrefs } from '../../logic/browse/prefs';
import { keepOff, keepOn, readKeepState, savePrefs } from '../../platform/browse-keep';
import { useBrowseSession } from './browse-session';

/**
 * Lesson display settings and the keep switch for this tab (F-BROWSE-001
 * sections 4.3 and 4.9; mocks `design/screens/browse/lesson-display.md` and
 * `home.md`). Romanization lives in memory for the tab; with the keep switch on
 * it is also written to `browse:prefs` and read back on the next visit. Every
 * learner renderer below reads the mode through `useRomanizationMode()`
 * (BR-5c), so no learner profile's setting is read or written. The UI language
 * and the text size are not kept here any more: they are the device's one
 * record (owner items 6 and 7), which the Lesson display sheet writes through
 * the locale store like every other surface.
 */
export interface BrowseSettings {
  romanization: RomanizationMode;
  setRomanization: (mode: RomanizationMode) => void;
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
  const [kept, setKeptState] = useState<boolean | null>(null);
  const [keepFailed, setKeepFailed] = useState(false);
  const keepOffered = pass !== null && homeLines({ pass, gatingEnabled, online }).keep;
  // The latest values, for the writes that follow a change.
  const latest = useRef({ romanization, kept });
  latest.current = { romanization, kept };

  // Keep switch on: the kept settings come back with the kept pass (section 4.3).
  useEffect(() => {
    if (!keepOffered) return undefined;
    let live = true;
    void readKeepState(Date.now()).then((state) => {
      if (!live) return;
      setKeptState(state.kept);
      if (state.prefs) setMode(state.prefs.romanization);
    });
    return () => {
      live = false;
    };
  }, [keepOffered]);

  // A kept `uiLocale` from before the device record is never written again (owner items 6 and 7).
  const prefsOf = (over: Partial<BrowsePrefs>): BrowsePrefs => ({ v: 1, romanization: over.romanization ?? latest.current.romanization });

  const setRomanization = useCallback((mode: RomanizationMode): void => {
    setMode(mode);
    void savePrefs(latest.current.kept === true, prefsOf({ romanization: mode }));
    // prefsOf reads refs only.
  }, []);

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
    () => ({ romanization, setRomanization, kept: keepOffered ? kept : null, setKept, keepFailed }),
    [romanization, setRomanization, keepOffered, kept, setKept, keepFailed],
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
