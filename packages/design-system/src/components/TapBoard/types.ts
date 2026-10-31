import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { TapLockScope, TapMultiTouch, TapScroll } from '../../tap-model';

/** How a target looks right now: `pressed` while a finger that will commit it is down and inside (KT-D11). */
export interface TapLook {
  pressed: boolean;
}

export interface TapBoardProps {
  /**
   * Required (docs/specs/AMENDMENTS-TOUCH.md KT-D5). `board`: after a commit every target is locked for `TAP_LOCK_MS`
   * (a commit moves, removes, reveals or advances something). `target`: only the committed target (pairing games).
   */
  lock: TapLockScope;
  /**
   * The web `touch-action` (KT-D3). `auto` (default) reads the `Screen` fit: `pinch-zoom` when it fits, else
   * `pan-y pinch-zoom`. `x`: a board in its own horizontal ScrollView. `none`: a board outside any ScrollView.
   */
  scroll?: TapScroll;
  /** `first` (default): the first finger owns the board (KT-D4). `each`: only the keyboard (KT-D7). */
  multiTouch?: TapMultiTouch;
  /** No target commits; touches are still claimed, so nothing under them fires. */
  disabled?: boolean;
  testID?: string;
  children: ReactNode;
}

export interface TapTargetProps {
  /** Called once per tap, after the board's rules (AMENDMENTS-TOUCH section 3.2). */
  onCommit: () => void;
  /** Claimed, never pressed, never committed (a locked wrong tile). */
  disabled?: boolean;
  accessibilityLabel: string;
  /** `disabled` is merged from the prop. */
  accessibilityState?: { selected?: boolean; disabled?: boolean; checked?: boolean };
  /** The target lock after a commit on a `target` board (default `TAP_LOCK_MS`; the keyboard's letters: `KEY_BOUNCE_MS`). */
  lockMs?: number;
  /** The hit area's own style (its size is what the board hit-tests); a function gets the board's look. */
  style?: StyleProp<ViewStyle> | ((look: TapLook) => StyleProp<ViewStyle>);
  testID?: string;
  /** The caller paints its own states, and the press look when `pressed`. */
  children: (look: TapLook) => ReactNode;
}

/** `useTapLock()`: the nearest board's lock, for a control outside the board that must wait, or to extend it. */
export interface TapLock {
  locked: boolean;
  lock(ms: number): void;
}

/** `usePressGuard()`: wraps an `onPress` so a second call within `TAP_LOCK_MS` of the last one is dropped. */
export type PressGuard = <A extends unknown[]>(fn: ((...args: A) => void) | undefined) => (...args: A) => void;
