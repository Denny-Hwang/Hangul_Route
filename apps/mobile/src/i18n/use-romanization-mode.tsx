import type { RomanizationMode } from '@hangul-route/content-schema';
import React, { createContext, useContext } from 'react';
import { resolveRomanizationMode } from '../logic/locale/romanization-mode';
import { useLocaleStore } from '../store/locale-store';
import { activeProfileSelector, useProfileStore } from '../store/profile-store';

/**
 * The romanization mode every screen shows (F-I18N-001 D2, F-BROWSE-001 §4.9).
 * Like `use-messages.ts`, a hook over the tested store and the pure rule
 * (`logic/locale/romanization-mode.ts`) with no unit test of its own; the
 * source scan `logic/__tests__/romanization-hook-scan.test.ts` keeps every
 * screen on it.
 */
const OverrideContext = createContext<RomanizationMode | null>(null);

/**
 * Sets the mode for everything below it, whatever a profile chose: the All
 * lessons display setting, which has no learner profile. Learner screens are
 * never mounted under it.
 */
export function RomanizationModeOverride({
  mode,
  children,
}: {
  mode: RomanizationMode;
  children: React.ReactNode;
}): React.ReactElement {
  return <OverrideContext.Provider value={mode}>{children}</OverrideContext.Provider>;
}

/**
 * The override when one is set, else the setting of `profileId` (default: the
 * active profile), else `always`.
 */
export function useRomanizationMode(profileId?: string | null): RomanizationMode {
  const override = useContext(OverrideContext);
  const activeId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const id = profileId === undefined ? activeId : profileId;
  const settings = useLocaleStore((s) => (id === null ? undefined : s.byProfile[id]));
  return resolveRomanizationMode(override, settings);
}
