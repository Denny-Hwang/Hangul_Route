import type { RomanizationMode } from '@hangul-route/content-schema';
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { Platform } from 'react-native';
import { readerPath } from '../logic/answer-feedback';
import { fadeOfSnapshot } from '../logic/locale/romanization-fade';
import {
  romanizationChoiceOf,
  romanizationResolver,
  type FadeContext,
  type RomanizationResolver,
} from '../logic/locale/romanization-mode';
import { isScreenReaderEnabled, subscribeScreenReader } from '../platform/screen-reader';
import { useLocaleStore } from '../store/locale-store';
import { activeProfileSelector, useProfileStore } from '../store/profile-store';
import { useProgressStore } from '../store/progress-store';

/**
 * The romanization mode every screen shows (F-I18N-001 D2, F-BROWSE-001 §4.9; AMENDMENTS-ROMANIZATION-FADE sections
 * 3.5 to 3.7). Like `use-messages.ts`, a hook over the tested store and the pure rules
 * (`logic/locale/romanization-mode.ts`, `romanization-fade.ts`) with no unit test of its own; the source scan
 * `logic/__tests__/romanization-hook-scan.test.ts` keeps every screen on it.
 */
const OverrideContext = createContext<RomanizationMode | null>(null);
const CheckScopeContext = createContext(false);

/**
 * Sets the mode for everything below it, whatever a profile chose: the All lessons display setting, which has no learner
 * profile, and the Stage Check's per-attempt "hide the romanization until I tap" switch (until row DC-1b removes
 * it). The Hangul Check no longer uses it: every Check holds its romanization until
 * the answer by `logic/locale/check-hold.ts`, not by an override
 * (AMENDMENTS-STAGE1-DECODING-CHECK section 3.1, row DC-1a). No other learner
 * screen is mounted under it.
 */
export function RomanizationModeOverride({
  mode,
  children,
}: {
  mode: RomanizationMode;
  children: ReactNode;
}): ReactElement {
  return <OverrideContext.Provider value={mode}>{children}</OverrideContext.Provider>;
}

/**
 * Marks everything below it as a quest's Check step (section 3.7): `useRomanizationMode()` returns the resolver's
 * `check` mode there, so the fade never folds anything inside a Check (`auto` reads as `always`). It is no override: an
 * override above it still wins. `active` lets one host wrap every step and mark only its Check (a stable tree, so a step
 * never remounts). What a Check holds before the answer is `logic/locale/check-hold.ts`'s, not this scope's.
 */
export function RomanizationCheckScope({ active = true, children }: { active?: boolean; children: ReactNode }): ReactElement {
  const inside = useContext(CheckScopeContext);
  // `active` false (a quest's practice step on the same host) leaves a scope above it alone and sets none of its own.
  return <CheckScopeContext.Provider value={inside || active}>{children}</CheckScopeContext.Provider>;
}

/**
 * The native screen-reader signal, one holder for the whole app (section 3.13): one platform subscription shared by
 * every reader (each game's announcement hook and this hook) instead of one per game. It starts with the first reader
 * that mounts, reads the platform once then, and ends with the last one, forgetting the value (unknown reads as off, as a
 * game's own state did) so a reader switched on while nothing was listening is read again at the next start. The web
 * cannot tell (its `platform/screen-reader` reads as off), so there the device flag "I use a screen reader" is the signal.
 */
let nativeReader = false;
let stopNativeReader: (() => void) | null = null;
const nativeReaderListeners = new Set<() => void>();

function setNativeReader(on: boolean): void {
  if (nativeReader === on) return;
  nativeReader = on;
  for (const listener of [...nativeReaderListeners]) listener();
}

function subscribeNativeReader(listener: () => void): () => void {
  nativeReaderListeners.add(listener);
  if (stopNativeReader === null) {
    let alive = true;
    void isScreenReaderEnabled().then((on) => {
      if (alive) setNativeReader(on);
    });
    const off = subscribeScreenReader(setNativeReader);
    stopNativeReader = () => {
      alive = false;
      off();
    };
  }
  return () => {
    nativeReaderListeners.delete(listener);
    if (nativeReaderListeners.size === 0 && stopNativeReader !== null) {
      stopNativeReader();
      stopNativeReader = null;
      nativeReader = false;
    }
  };
}

const subscribeNothing = (): (() => void) => () => undefined;
const never = (): boolean => false;

/**
 * Whether the platform's own screen reader (VoiceOver, TalkBack) is on, from the one holder; always false on the web.
 * `needed` false (the fade reads it only for a profile on **As I learn**) joins the holder with nothing: no platform call.
 */
export function useNativeScreenReader(needed = true): boolean {
  return useSyncExternalStore(needed ? subscribeNativeReader : subscribeNothing, needed ? () => nativeReader : never, never);
}

/**
 * The resolver of the active profile (or of `profileId`): the override, the choice, the fade phase and the screen reader
 * folded into the three resolutions of section 3.5. Memoized on the override, the choice, the phase and the screen
 * reader, so a progress write that leaves the phase as it is re-renders nothing. The phase is read only for a profile
 * on **As I learn** (`auto`): any other choice never looks at progress. A surface that must not change under an open
 * screen (the item-level surfaces of section 3.6) keeps the first value it gets for its mount.
 */
export function useRomanizationResolver(profileId?: string | null): RomanizationResolver {
  const override = useContext(OverrideContext);
  const activeId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const id = profileId === undefined ? activeId : profileId;
  const settings = useLocaleStore((s) => (id === null ? undefined : s.byProfile[id]));
  const choice = romanizationChoiceOf(settings);
  // The two stored fields the choice is read from; the memo below is keyed on them, not on the record object.
  const storedChoice = settings?.romanizationChoice;
  const storedMode = settings?.romanizationMode;
  const webFlag = useLocaleStore((s) => s.screenReader);
  // Only a profile on As I learn reads the screen reader (row S5): any other choice makes no platform call.
  const native = useNativeScreenReader(choice === 'auto');
  const screenReader = readerPath({ platform: Platform.OS, nativeReader: native, webFlag }) === 'reader';
  const phase = useProgressStore((s) => {
    if (choice !== 'auto' || id === null) return null;
    const snapshot = s.byProfile[id];
    return snapshot === undefined ? null : fadeOfSnapshot(snapshot).phase;
  });
  return useMemo(() => {
    let fade: FadeContext | null = null;
    if (choice === 'auto' && id !== null && phase !== null) {
      // The met symbols are read when the phase is: they only matter in `reading`, where they are all of quests 1 to 10.
      const snapshot = useProgressStore.getState().byProfile[id];
      if (snapshot !== undefined) fade = { phase, met: fadeOfSnapshot(snapshot).met, screenReader };
    }
    return romanizationResolver(override, { romanizationChoice: storedChoice, romanizationMode: storedMode }, fade);
  }, [override, choice, storedChoice, storedMode, phase, screenReader, id]);
}

/**
 * The override when one is set, else the setting of `profileId` (default: the active profile), else `always`. Inside a
 * Check scope it is the resolver's `check` mode, otherwise its `surface` mode. With the shipped default (`always`) and
 * no profile on **As I learn**, this is exactly the old rule.
 */
export function useRomanizationMode(profileId?: string | null): RomanizationMode {
  const inCheck = useContext(CheckScopeContext);
  const resolver = useRomanizationResolver(profileId);
  return inCheck ? resolver.check : resolver.surface;
}
