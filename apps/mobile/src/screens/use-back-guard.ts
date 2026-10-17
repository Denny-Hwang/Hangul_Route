import { NavigationContext } from '@react-navigation/native';
import { useContext, useEffect, useRef } from 'react';
import { isBackAction } from '../logic/navigation/back-action';

/** The part of a screen's navigation a back guard needs. */
export interface BackGuardNavigation {
  addListener(type: 'beforeRemove', listener: (event: { data: { action: { type: string } }; preventDefault(): void }) => void): () => void;
}

/**
 * A screen's answer to a back (AMENDMENTS-DISPLAY-NAV section 7.1): the visible Back of its
 * `ScreenHeader`, the browser or phone back (the history bridge) and a swipe all reach the screen's
 * `beforeRemove`, so they run this one code. `onBack` returns true when it took the back itself (it
 * stepped back inside the screen, or asked first with a ConfirmSheet), and the screen stays; false
 * lets the screen go. A screen's own ways on (a replace, a reset, a navigate) are never held.
 */
export function useBackGuard(navigation: BackGuardNavigation | undefined, onBack: () => boolean): void {
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (navigation === undefined) return undefined;
    return navigation.addListener('beforeRemove', (event) => {
      if (!isBackAction(event.data.action.type)) return;
      if (latest.current()) event.preventDefault();
    });
  }, [navigation]);
}

/**
 * `useBackGuard` on the route the component is drawn in, for a part that gets no navigation of its
 * own (a game, a quest body): outside a route (a render test, a fixture host) it does nothing.
 */
export function useRouteBackGuard(onBack: () => boolean): void {
  const navigation = useContext(NavigationContext) as BackGuardNavigation | undefined;
  useBackGuard(navigation, onBack);
}
