import type { ReactNode, Ref } from 'react';
import type { StyleProp, View, ViewStyle } from 'react-native';
import type { TapLockScope, TapMultiTouch, TapScroll } from '../../tap-model';
import type { TapScrollerLike } from './controller';

/** How a target looks right now: `pressed` while a finger that will commit it is down and inside (KT-D11). */
export interface TapLook {
  pressed: boolean;
}

export interface TapBoardProps {
  /**
   * Required (docs/specs/AMENDMENTS-TOUCH.md KT-D5). `board`: after a commit the app-level lock is on for `TAP_LOCK_MS`
   * and every board and guarded press waits (a commit moves, removes, reveals or advances something). `target`: only
   * the committed target (pairing games).
   */
  lock: TapLockScope;
  /** `auto` (default): the board drives the nearest `TapScroller` when it can scroll (rule 5). `none`: never scrolls (the keyboard). */
  scroll?: TapScroll;
  /** `latest` (default): the latest finger on a target owns the board (KT-D4). `each`: only the keyboard (KT-D7). */
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
  /**
   * Claimed, never pressed, never committed, like `disabled`, while the button stays enabled and focusable (KT-2: an
   * answered ChoiceCard, `correct` or a locked miss, keeps today's accessible state and can still take focus).
   */
  inactive?: boolean;
  accessibilityLabel: string;
  /** `disabled` is merged from the prop. */
  accessibilityState?: { selected?: boolean; disabled?: boolean; checked?: boolean };
  /** A toggle's `aria-pressed` on the web (the keyboard's Shift); left off when undefined. */
  ariaPressed?: boolean;
  /** The target lock after a commit on a `target` board (default `TAP_LOCK_MS`; the keyboard's keys: `KEY_BOUNCE_MS`). */
  lockMs?: number;
  /** `false` for a take-back target (a filled slot or zone): only a touch inside its own rectangle reaches it (rule 2). */
  gapFill?: boolean;
  /** The hit area's own style (its size is what the board hit-tests); a function gets the board's look. */
  style?: StyleProp<ViewStyle> | ((look: TapLook) => StyleProp<ViewStyle>);
  testID?: string;
  /** The Pressable's node, for a screen that moves focus to this target (as Button's `pressableRef`). */
  pressableRef?: Ref<View>;
  /** The caller paints its own states, and the press look when `pressed`. */
  children: (look: TapLook) => ReactNode;
}

export interface TapControlProps {
  children: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export interface TapScrollerProps {
  /** `{ axis, canScroll, scrollBy(delta) => offset, onScroll(listener) => stop }`. */
  scroller: TapScrollerLike;
  children: ReactNode;
}

/** `useTapLock()`: the app-level `board` lock (or a board's own without a provider), to wait on or to extend. */
export interface TapLock {
  locked: boolean;
  lock(ms: number): void;
}

export interface PressGuardOptions {
  /** Default true: a press that runs sets the app-level lock. False for a control that moves nothing (a speaker). */
  setsLock?: boolean;
}

/** `usePressGuard()`: wraps an `onPress` so a repeat within `TAP_LOCK_MS`, or a press during the app lock, is dropped. */
export type PressGuard = <A extends unknown[]>(fn: ((...args: A) => void) | undefined) => (...args: A) => void;
