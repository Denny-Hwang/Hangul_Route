import type { RomanizationMode } from '@hangul-route/content-schema';
import { createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { Platform } from 'react-native';
import { readerPath } from '../logic/answer-feedback';
import { fadeOfSnapshot, isStage1Quest, readingNoticeDue } from '../logic/locale/romanization-fade';
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
 * Sets the mode for everything below it, whatever a profile chose: the All
 * lessons display setting, which has no learner profile. No Check uses it: every
 * Check holds its romanization until the answer by `logic/locale/check-hold.ts`,
 * not by an override (AMENDMENTS-STAGE1-DECODING-CHECK section 3.1, rows DC-1a and
 * DC-1b). No other learner screen is mounted under it.
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
/** The platform has answered at least once since the holder started (the first read is a promise): the reading line waits for it. */
let nativeReaderKnown = false;
let stopNativeReader: (() => void) | null = null;
const nativeReaderListeners = new Set<() => void>();

function setNativeReader(on: boolean): void {
  if (nativeReader === on && nativeReaderKnown) return;
  nativeReader = on;
  nativeReaderKnown = true;
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
      nativeReaderKnown = false;
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
  // Until the platform has answered (a moment after the holder starts) a profile on As I learn is treated as a reader in
  // use: everything shows, which can only show more, never hide (section 3.13, OD-RF-3). The web needs no wait.
  const known = useNativeReaderKnown(choice === 'auto');
  const screenReader = readerPath({ platform: Platform.OS, nativeReader: native, webFlag }) === 'reader' || !known;
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
 * The resolver for an item-level surface (section 3.6), held for its mount: the first value it gets, except that while the
 * native screen-reader answer is still pending (`useReaderPending`) the surface keeps taking the live resolver, and holds
 * the first one once it is known. So the surface never folds for a reader that has not been heard from yet, and a learner
 * with no reader gets the fade for the whole step once the answer is in, a moment after it opened.
 */
export function useMountResolver(): RomanizationResolver {
  const live = useRomanizationResolver();
  const pending = useReaderPending();
  const held = useRef(live);
  const settled = useRef(!pending);
  if (!settled.current && !pending) {
    held.current = live;
    settled.current = true;
  }
  return held.current;
}

/** True while a profile on As I learn waits for the platform's screen-reader answer (native only; never on the web). */
function useReaderPending(): boolean {
  const activeId = useProfileStore((s) => activeProfileSelector(s)?.id ?? null);
  const choice = useLocaleStore((s) => romanizationChoiceOf(activeId === null ? undefined : s.byProfile[activeId]));
  return !useNativeReaderKnown(choice === 'auto') && choice === 'auto';
}

/** Whether the platform has told the holder yet whether a screen reader is on (always true on the web: the device flag is the signal). */
function useNativeReaderKnown(needed: boolean): boolean {
  const known = useSyncExternalStore(needed ? subscribeNativeReader : subscribeNothing, needed ? () => nativeReaderKnown : never, never);
  return Platform.OS === 'web' || known;
}

/**
 * Whether Hoya's one-time reading line is on for this quest run, and the call that marks it shown (AMENDMENTS-ROMANIZATION-FADE section 3.9, OD-RF-2): the
 * pure rule `readingNoticeDue` over the profile's choice, the fade phase, the screen reader and `romanizationNoticeAt`. It
 * is **decided once for the run**: it latches when it is due while the run is on its first step, and then holds for the
 * run, so marking the line shown (which makes it no longer due) never takes it off the screen, and Previous back to the
 * Hello step shows it again. A run that is not due on its first step never gets it. `profileId` is the learner's, or null
 * (a guest, the All lessons preview): no line. On the native app the platform's screen-reader answer is a promise, so the
 * decision waits for it (a few milliseconds); the web reads the device flag at once.
 */
export function useReadingNotice(profileId: string | null, questId: string, onFirstStep: boolean): { show: boolean; markShown: () => void } {
  const settings = useLocaleStore((s) => (profileId === null ? undefined : s.byProfile[profileId]));
  const choice = romanizationChoiceOf(settings);
  const noticeAt = settings?.romanizationNoticeAt;
  // Only a profile on As I learn that has not seen the line reads the phase and the screen reader.
  const candidate = profileId !== null && choice === 'auto' && noticeAt === undefined;
  const webFlag = useLocaleStore((s) => s.screenReader);
  const native = useNativeScreenReader(candidate);
  const known = useNativeReaderKnown(candidate);
  const phase = useProgressStore((s) => {
    if (!candidate) return null;
    const snapshot = s.byProfile[profileId];
    return snapshot === undefined ? null : fadeOfSnapshot(snapshot).phase;
  });
  const screenReader = readerPath({ platform: Platform.OS, nativeReader: native, webFlag }) === 'reader';
  const due =
    candidate && phase !== null && known && readingNoticeDue({ choice, phase, screenReader, noticeAt, stage1Quest: isStage1Quest(questId) });
  const held = useRef(false);
  if (due && onFirstStep) held.current = true;
  const markShown = useCallback((): void => {
    if (profileId !== null) useLocaleStore.getState().markRomanizationNotice(profileId, new Date().toISOString());
  }, [profileId]);
  return { show: held.current, markShown };
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
