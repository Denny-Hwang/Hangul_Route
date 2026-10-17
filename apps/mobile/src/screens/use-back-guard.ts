import { NavigationContext } from '@react-navigation/native';
import { useContext, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { isBackAction } from '../logic/navigation/back-action';

/** The part of a screen's navigation a back guard needs. */
export interface BackGuardNavigation {
  addListener(type: 'beforeRemove', listener: (event: { data: { action: { type: string } }; preventDefault(): void }) => void): () => void;
  setOptions?: (options: { gestureEnabled?: boolean }) => void;
}

/**
 * A screen's answer to a back (AMENDMENTS-DISPLAY-NAV section 7.1): the visible Back of its
 * `ScreenHeader`, the browser or phone back (the history bridge) and the Android back all reach the
 * screen's `beforeRemove`, so they run this one code. `onBack` returns true when it took the back
 * itself (it stepped back inside the screen, or asked first with a ConfirmSheet), and the screen
 * stays; false lets the screen go. A screen's own ways on (a replace, a reset, a navigate) are never
 * held.
 *
 * `holds` says, ahead of any back, whether `onBack` would take it now. The native iOS swipe back (and
 * a modal's swipe down) is a native gesture that `beforeRemove` cannot cancel in native-stack (the
 * screen would leave natively while the navigator still holds it), so while the guard holds, the
 * gesture is turned off (`gestureEnabled`, as CreateProfile does) and the screen leaves only through
 * its Back or Close, which the guard answers. The web has no such gesture, so nothing changes there.
 */
export function useBackGuard(navigation: BackGuardNavigation | undefined, onBack: () => boolean, holds?: boolean): void {
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (typeof navigation?.addListener !== 'function') return undefined;
    return navigation.addListener('beforeRemove', (event) => {
      if (!isBackAction(event.data.action.type)) return;
      if (latest.current()) event.preventDefault();
    });
  }, [navigation]);
  useEffect(() => {
    if (holds === undefined || Platform.OS === 'web' || typeof navigation?.setOptions !== 'function') return;
    navigation.setOptions({ gestureEnabled: !holds });
  }, [navigation, holds]);
}

/**
 * `useBackGuard` on the route the component is drawn in, for a part that gets no navigation of its
 * own (a game, a quest body): outside a route (a render test, a fixture host) it does nothing.
 */
export function useRouteBackGuard(onBack: () => boolean, holds?: boolean): void {
  const navigation = useContext(NavigationContext) as BackGuardNavigation | undefined;
  useBackGuard(navigation, onBack, holds);
}
