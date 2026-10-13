import type { RomanizationMode } from '@hangul-route/content-schema';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { RomanizationModeOverride } from '../../i18n/use-romanization-mode';

/**
 * Lesson display settings for this tab (F-BROWSE-001 section 4.9): how lessons
 * show romanization while an adult previews them. In memory only; BR-7 adds
 * the Lesson display sheet and, with the keep switch, `browse:prefs`. Every
 * learner renderer below reads the mode through `useRomanizationMode()`
 * (BR-5c), so no learner profile's setting is read or written.
 */
export interface BrowseSettings {
  romanization: RomanizationMode;
  setRomanization: (mode: RomanizationMode) => void;
}

const BrowseSettingsContext = createContext<BrowseSettings | null>(null);

export function BrowseSettingsProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  // The learner default with no profile (`resolveRomanizationMode`).
  const [romanization, setRomanization] = useState<RomanizationMode>('always');
  const value = useMemo(() => ({ romanization, setRomanization }), [romanization]);
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
