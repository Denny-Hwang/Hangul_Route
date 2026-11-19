import { useIsFocused } from '@react-navigation/native';
import { Suspense, useLayoutEffect, useMemo, useState } from 'react';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { Platform } from 'react-native';

/**
 * A screen that is not focused does not re-render ([FN] AMENDMENTS-FINISH-2026-11 row FN-5, finding F10). The tab
 * screens stay mounted under the root stack's screens (Home under a quest and its Results) and each subscribes to the
 * stores that a quest writes on every step, so each write redrew them, unseen. The native stack's `freezeOnBlur` does
 * not apply here: the web stack ignores it, and a tab whose parent stack screen is covered is still its navigator's
 * focused tab, so the tab navigator's own freeze never starts.
 *
 * `Freeze` is the technique of react-freeze (which react-native-screens uses for `freezeOnBlur`): while `frozen`, a
 * child throws a thenable that never settles, so React keeps the subtree's last committed output inside a Suspense
 * boundary and renders none of it, whatever its stores do. Its state and its store subscriptions are kept; when it
 * thaws it renders once with the stores as they are then, so the screen is up to date as soon as it is focused again.
 * React hides the kept output while it is suspended (`display: none`), and layout effects run again when it shows. A
 * screen first mounted while not focused draws nothing until it is focused (the fallback is empty).
 *
 * Web only (the PWA, where the finding was measured): the web stack already hides a covered screen with `display:
 * none` and has no back swipe, so hiding it changes nothing on screen. On iOS and Android a screen that is not focused
 * can still be seen (under a sheet modal, during the back swipe), so they keep drawing it as before.
 */

const NEVER = { then: (): void => undefined };

function Suspender({ frozen, children }: { frozen: boolean; children: ReactNode }): ReactElement {
  if (frozen) throw NEVER;
  return <>{children}</>;
}

export function Freeze({ frozen, children }: { frozen: boolean; children: ReactNode }): ReactElement {
  return (
    <Suspense fallback={null}>
      <Suspender frozen={frozen}>{children}</Suspender>
    </Suspense>
  );
}

/**
 * The screen, frozen while it is not focused (it, or a navigator above it, is covered or another tab is chosen).
 *
 * The freeze is set from a layout effect, so it renders in React's sync lane. Set during the render that saw the blur
 * (a default-lane update from the navigator's blur event), a boundary that hides content it already shows would have
 * its commit held back by up to a second (React's "just noticeable difference" delay for a fallback that replaces
 * visible content), and every other update of that render with it: the quest's first effects, its back guard among
 * them. The screen's element is kept across the wrapper's own renders, so the blur itself redraws nothing of it.
 */
export function frozenWhenBlurred<P extends object>(Screen: ComponentType<P>): ComponentType<P> {
  function FrozenWhenBlurred(props: P): ReactElement {
    const focused = useIsFocused();
    const [frozen, setFrozen] = useState(() => !focused && Platform.OS === 'web');
    useLayoutEffect(() => {
      setFrozen(!focused && Platform.OS === 'web');
    }, [focused]);
    const screen = useMemo(() => <Screen {...props} />, [props]);
    return <Freeze frozen={frozen}>{screen}</Freeze>;
  }
  FrozenWhenBlurred.displayName = `FrozenWhenBlurred(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return FrozenWhenBlurred;
}
