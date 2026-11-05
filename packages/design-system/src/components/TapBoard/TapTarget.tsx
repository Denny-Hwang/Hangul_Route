import { useContext, useEffect, useId, useRef } from 'react';
import type { MutableRefObject, ReactElement } from 'react';
import { Platform, Pressable } from 'react-native';
import type { StyleProp, View, ViewStyle } from 'react-native';
import { targetTouchAction } from '../../tap-model';
import { TapBoardContext } from './context';
import { supportsPinchZoom } from './host';
import { NO_PRESS_DELAY } from './press-delay';
import type { TapLook, TapTargetProps } from './types';
import { usePressGuard } from './use-press-guard';

/**
 * One answer inside a `TapBoard` (docs/specs/AMENDMENTS-TOUCH.md section 4.2): a focusable `button` whose touches the
 * board decides. Its `onPress` is the click path of rule 9 (keyboard Enter or Space, a screen reader, switch access, a
 * mouse the board did not see), which goes through the same rules and lock. On the web it is `touch-action: pinch-zoom`,
 * so a touch that starts on it never becomes a browser pan (KT-D3). Outside a board it is a plain `Pressable` with the
 * press guard, so a design-system component can use it everywhere: it keeps the browser's own `touch-action`, because
 * no board is there to scroll the page for a drag that starts on it (KT-2: a ChoiceCard or Tile outside a board).
 */

function resolveStyle(style: TapTargetProps['style'], look: TapLook, inBoard: boolean): StyleProp<ViewStyle> {
  const own = typeof style === 'function' ? style(look) : style;
  if (Platform.OS !== 'web' || !inBoard) return own;
  return [own, { touchAction: targetTouchAction(supportsPinchZoom()) } as unknown as ViewStyle];
}

export function TapTarget({
  onCommit,
  disabled = false,
  inactive = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  ariaSelected,
  lockMs,
  gapFill = true,
  style,
  testID,
  pressableRef,
  children,
}: TapTargetProps): ReactElement {
  const board = useContext(TapBoardContext);
  const id = useId();
  const node = useRef<unknown>(null);
  // Read when the board commits, so a re-render never has to register again. An inactive target is disabled for the
  // board (claimed, never pressed or committed) but not for the Pressable, so it keeps its focus and accessible state.
  const latest = useRef({ onCommit, disabled: disabled || inactive });
  latest.current = { onCommit, disabled: disabled || inactive };
  const forward = useRef(pressableRef);
  forward.current = pressableRef;
  const guard = usePressGuard();
  const register = board?.register;
  useEffect(() => {
    if (register === undefined) return undefined;
    return register(id, { node: () => node.current, disabled: () => latest.current.disabled, lockMs, gapFill, commit: () => latest.current.onCommit() });
  }, [register, id, lockMs, gapFill]);

  const shared = {
    ref: (v: unknown) => {
      node.current = v;
      const out = forward.current;
      if (typeof out === 'function') out(v as View | null);
      else if (out) (out as MutableRefObject<unknown>).current = v;
    },
    accessibilityRole,
    accessibilityLabel,
    // An explicit `accessibilityState.disabled` (an inactive card drawn as disabled) is kept: the prop only adds to it.
    accessibilityState: { ...accessibilityState, disabled: disabled || accessibilityState?.disabled === true },
    // react-native-web reads the ARIA prop, not `accessibilityState`, for a chip's on or off (AMENDMENTS-ROUTE-CLASS-BLEND BL-8).
    ...(accessibilityState?.checked === undefined ? {} : { 'aria-checked': accessibilityState.checked }),
    // Opt-in only (Card Match's Korean cards, KT-4b): never derived from `accessibilityState`, so other buttons carry none.
    ...(ariaSelected === undefined ? {} : { 'aria-selected': ariaSelected }),
    // Only a disabled target disables the Pressable: on native a `disabled={false}` would override the state above.
    disabled: disabled ? true : undefined,
    testID,
    ...NO_PRESS_DELAY,
  } as const;

  if (board === null) {
    return (
      <Pressable
        {...shared}
        onPress={inactive ? undefined : guard(() => latest.current.onCommit())}
        // A style function follows the Pressable's own pressed state; a plain style stays a plain style.
        style={typeof style === 'function' ? ({ pressed }) => resolveStyle(style, { pressed: pressed && !latest.current.disabled }, false) : style}
      >
        {({ pressed }) => children({ pressed: pressed && !latest.current.disabled })}
      </Pressable>
    );
  }
  const look: TapLook = { pressed: board.pressed.has(id) && !inactive };
  return (
    <Pressable
      {...shared}
      onPress={(event) => board.click(id, (event as { timeStamp?: unknown } | undefined)?.timeStamp)}
      onLayout={Platform.OS === 'web' ? undefined : () => board.remeasure()}
      style={resolveStyle(style, look, true)}
    >
      {children(look)}
    </Pressable>
  );
}
