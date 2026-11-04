import { useContext, useEffect, useId, useRef } from 'react';
import type { ReactElement } from 'react';
import { Platform, Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { targetTouchAction } from '../../tap-model';
import { TapBoardContext } from './context';
import { supportsPinchZoom } from './host';
import type { TapLook, TapTargetProps } from './types';
import { usePressGuard } from './use-press-guard';

/**
 * One answer inside a `TapBoard` (docs/specs/AMENDMENTS-TOUCH.md section 4.2): a focusable `button` whose touches the
 * board decides. Its `onPress` is the click path of rule 9 (keyboard Enter or Space, a screen reader, switch access, a
 * mouse the board did not see), which goes through the same rules and lock. On the web it is `touch-action: pinch-zoom`,
 * so a touch that starts on it never becomes a browser pan (KT-D3). Outside a board it is a plain `Pressable` with the
 * press guard, so a design-system component can use it everywhere.
 */

/** No press delay: the press look shows on the first touch frame (react-native-web `delayPressIn`, native `unstable_pressDelay`). */
const NO_PRESS_DELAY = { delayPressIn: 0, unstable_pressDelay: 0 } as unknown as Partial<PressableProps>;

function resolveStyle(style: TapTargetProps['style'], look: TapLook): StyleProp<ViewStyle> {
  const own = typeof style === 'function' ? style(look) : style;
  if (Platform.OS !== 'web') return own;
  return [own, { touchAction: targetTouchAction(supportsPinchZoom()) } as unknown as ViewStyle];
}

export function TapTarget({ onCommit, disabled = false, accessibilityLabel, accessibilityRole = 'button', accessibilityState, lockMs, gapFill = true, style, testID, children }: TapTargetProps): ReactElement {
  const board = useContext(TapBoardContext);
  const id = useId();
  const node = useRef<unknown>(null);
  // Read when the board commits, so a re-render never has to register again.
  const latest = useRef({ onCommit, disabled });
  latest.current = { onCommit, disabled };
  const guard = usePressGuard();
  const register = board?.register;
  useEffect(() => {
    if (register === undefined) return undefined;
    return register(id, { node: () => node.current, disabled: () => latest.current.disabled, lockMs, gapFill, commit: () => latest.current.onCommit() });
  }, [register, id, lockMs, gapFill]);

  const shared = {
    ref: (v: unknown) => {
      node.current = v;
    },
    accessibilityRole,
    accessibilityLabel,
    accessibilityState: { ...accessibilityState, disabled },
    // react-native-web reads the ARIA prop, not `accessibilityState`, for a chip's on or off (AMENDMENTS-ROUTE-CLASS-BLEND BL-8).
    ...(accessibilityState?.checked === undefined ? {} : { 'aria-checked': accessibilityState.checked }),
    disabled,
    testID,
    ...NO_PRESS_DELAY,
  } as const;

  if (board === null) {
    return (
      <Pressable {...shared} onPress={guard(() => latest.current.onCommit())} style={({ pressed }) => resolveStyle(style, { pressed: pressed && !disabled })}>
        {({ pressed }) => children({ pressed: pressed && !disabled })}
      </Pressable>
    );
  }
  const look: TapLook = { pressed: board.pressed.has(id) };
  return (
    <Pressable
      {...shared}
      onPress={(event) => board.click(id, (event as { timeStamp?: unknown } | undefined)?.timeStamp)}
      onLayout={Platform.OS === 'web' ? undefined : () => board.remeasure()}
      style={resolveStyle(style, look)}
    >
      {children(look)}
    </Pressable>
  );
}
