import { NavigationContext } from '@react-navigation/native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

/** A guard that sits inside a scope: what it answers and whether it would hold, read when a back arrives. */
interface NestedGuard {
  onBack: () => boolean;
  holds: boolean | undefined;
}

/** What a scope's owner hands to the guards drawn inside it. */
export interface BackGuardScope {
  register(guard: NestedGuard): () => void;
  /** A nested guard's `holds` changed: the owner works out the gesture again. */
  refresh(): void;
}

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME LR-1 (section 3.1): nested guards on one route. Two `beforeRemove` listeners on a
 * route depend on the order they were added, and two `setOptions({ gestureEnabled })` writers overwrite each other, so a
 * route with more than one guard names one owner (`useBackGuardScope`), and a `useRouteBackGuard` drawn inside its
 * scope registers with the owner instead of adding a listener of its own. Outside a scope nothing changes.
 */
export const BackGuardScopeContext = createContext<BackGuardScope | null>(null);

/**
 * The owner of a route's guards: one listener, one writer of the gesture. A back asks the nested guards first (the latest
 * registered first) and the owner's own `onBack` only when none took it; the swipe is off when the owner or any nested
 * guard holds. Provide the returned scope with `BackGuardScopeContext.Provider` around the guards that may nest.
 */
export function useBackGuardScope(onBack: () => boolean, holds: boolean): BackGuardScope {
  const navigation = useContext(NavigationContext) as BackGuardNavigation | undefined;
  const nested = useRef<NestedGuard[]>([]);
  const [nestedHolds, setNestedHolds] = useState(false);
  const refresh = useCallback((): void => setNestedHolds(nested.current.some((guard) => guard.holds === true)), []);
  const scope = useMemo<BackGuardScope>(
    () => ({
      register: (guard) => {
        nested.current.push(guard);
        refresh();
        return () => {
          nested.current = nested.current.filter((one) => one !== guard);
          refresh();
        };
      },
      refresh,
    }),
    [refresh],
  );
  useBackGuard(
    navigation,
    () => {
      for (let i = nested.current.length - 1; i >= 0; i -= 1) {
        if (nested.current[i]!.onBack()) return true;
      }
      return onBack();
    },
    holds || nestedHolds,
  );
  return scope;
}

/**
 * `useBackGuard` on the route the component is drawn in, for a part that gets no navigation of its
 * own (a game, a quest body): outside a route (a render test, a fixture host) it does nothing. [LR] Inside a
 * `BackGuardScopeContext` it answers through the scope's owner (one listener, one gesture writer, section 3.1).
 */
export function useRouteBackGuard(onBack: () => boolean, holds?: boolean): void {
  const navigation = useContext(NavigationContext) as BackGuardNavigation | undefined;
  const scope = useContext(BackGuardScopeContext);
  const guard = useRef<NestedGuard>({ onBack, holds });
  guard.current.onBack = onBack;
  guard.current.holds = holds;
  useEffect(() => scope?.register(guard.current), [scope]);
  useEffect(() => scope?.refresh(), [scope, holds]);
  useBackGuard(scope ? undefined : navigation, onBack, holds);
}
