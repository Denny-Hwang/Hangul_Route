import { useContext, useEffect, useId, useRef } from 'react';
import type { ReactElement } from 'react';
import { Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { TapBoardContext } from './context';
import type { TapLook, TapTargetProps } from './types';
import { usePressGuard } from './use-press-guard';

/**
 * One answer inside a `TapBoard` (docs/specs/AMENDMENTS-TOUCH.md section 4.2): a focusable `button` whose touches the
 * board decides. Its `onPress` is the click path of rule 8 (keyboard Enter or Space, a screen reader, switch access, a
 * mouse the board did not see), which goes through the same rules and lock. Outside a board it is a plain `Pressable`
 * with the press guard, so a design-system component can use it everywhere.
 */

/** No press delay: the press look shows on the first touch frame (react-native-web `delayPressIn`, native `unstable_pressDelay`). */
const NO_PRESS_DELAY = { delayPressIn: 0, unstable_pressDelay: 0 } as unknown as Partial<PressableProps>;

function resolveStyle(style: TapTargetProps['style'], look: TapLook): StyleProp<ViewStyle> {
  return typeof style === 'function' ? style(look) : style;
}

export function TapTarget({ onCommit, disabled = false, accessibilityLabel, accessibilityState, lockMs, style, testID, children }: TapTargetProps): ReactElement {
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
    return register(id, { node: () => node.current, disabled: () => latest.current.disabled, lockMs, commit: () => latest.current.onCommit() });
  }, [register, id, lockMs]);

  const shared = {
    ref: (v: unknown) => {
      node.current = v;
    },
    accessibilityRole: 'button',
    accessibilityLabel,
    accessibilityState: { ...accessibilityState, disabled },
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
    <Pressable {...shared} onPress={(event) => board.click(id, (event as { timeStamp?: unknown } | undefined)?.timeStamp)} style={resolveStyle(style, look)}>
      {children(look)}
    </Pressable>
  );
}
