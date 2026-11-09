import type { GrownUpUse } from '@hangul-route/content-schema';
import type { NativeAccountRowsInput, WhoMarker } from '../../logic/profiles/who';
import type { RootStackParamList } from '../../navigation/types';

/**
 * F-AUTH-004 section 7.1 (row NS-4): the native account entries exist on iOS and Android only
 * (`account-entries.native.ts`, which takes its types from here). This twin is what the web build's import walk and the
 * type checker resolve: the chooser reaches the native module only through an `EXPO_OS` test the web build folds away,
 * so the web bundle carries neither file. It imports types only, and none from a native-only module (the web
 * bundle guard walks type imports too).
 */

/** The navigation an entry needs (the root stack's, or its parent's from Welcome). */
export interface EntryNavigation {
  navigate: <K extends 'PinEntry' | 'ParentDashboard'>(name: K, params: RootStackParamList[K]) => void;
}

/** What the native chooser's rows read (`grownUpRows`'s `native` input) and the network the account rows need. */
export interface NativeAccountEntries extends NativeAccountRowsInput {
  /** `expo-network` (section 12): the account rows are disabled offline; the Grown-up area row is not. */
  online: boolean;
}

/** The part of the navigation object that tells when the screen comes back to the front. */
export interface FocusEvents {
  addListener: (event: 'focus', callback: () => void) => () => void;
}

export function openAccountEntry(_navigation: EntryNavigation, _use: GrownUpUse | 'signin' | 'account', _marker: WhoMarker): void {
  // No native account on the web (its grown-up account is the console, F-APP-001).
}

/** None on the web: the native account is iOS and Android only (none either while it is off there). */
export function useNativeAccountEntries(_navigation: FocusEvents, _opening: unknown): NativeAccountEntries | undefined {
  return undefined;
}
