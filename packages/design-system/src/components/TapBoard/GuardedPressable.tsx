import { forwardRef } from 'react';
import type { ElementRef } from 'react';
import { Pressable } from 'react-native';
import type { PressableProps } from 'react-native';
import { NO_PRESS_DELAY } from './press-delay';
import { usePressGuard } from './use-press-guard';

export interface GuardedPressableProps extends PressableProps {
  /** Default true: a press that runs sets the app-level tap lock. False for a control that moves nothing (a speaker). */
  setsLock?: boolean;
}

/**
 * A learner non-game `Pressable` (docs/specs/AMENDMENTS-TOUCH.md section 6.9, row KT-9): `usePressGuard()` on its
 * `onPress` and no press delay (`delayPressIn` 0). A bounce on it runs once, a press during the app-level tap lock is
 * dropped, and a press that runs sets that lock unless `setsLock` is false. One component, so each call site costs the
 * start bundle nothing beyond the tag (the guard and the delay props are not repeated at every site).
 */
export const GuardedPressable = forwardRef<ElementRef<typeof Pressable>, GuardedPressableProps>(function GuardedPressable(
  { onPress, setsLock, ...rest },
  ref,
) {
  const guard = usePressGuard({ setsLock });
  return <Pressable ref={ref} {...rest} {...NO_PRESS_DELAY} onPress={onPress == null ? undefined : guard(onPress)} />;
});
