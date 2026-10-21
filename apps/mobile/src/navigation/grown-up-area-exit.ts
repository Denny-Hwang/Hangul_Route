import { areaExitTracker, areaLeaveRoutes, routeZone, type LeaveRoute } from '../logic/profiles/session';
import { gateOpensDirectlyNow } from '../store/gate-now';
import { closeGrownUpSession, onGrownUpSessionClosed } from '../store/grown-up-session';
import { useUiStore } from '../store/ui-store';

/** The focused route as the navigation container reports it (`key` is absent in tests). */
interface FocusedRoute {
  name: string;
  params?: unknown;
  key?: string;
}

/** The part of the navigation container this needs (`createNavigationContainerRef`). */
export interface FocusedRouteSource {
  getCurrentRoute: () => FocusedRoute | undefined;
  addListener: (type: 'state', callback: () => void) => () => void;
}

/** [OA] The grown-up session as the exit watcher reads it: open or not, and the PIN screen's one-time return. */
export interface SessionProbe {
  open: () => boolean;
  takeReturn: () => boolean;
}

const storeProbe: SessionProbe = {
  open: () => {
    const { parentGateOpenedAt, lastPinVerifiedAt } = useUiStore.getState();
    return parentGateOpenedAt !== null || lastPinVerifiedAt !== null;
  },
  takeReturn: () => useUiStore.getState().takeGateReturn(),
};

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D5b (2), CS-1, CS-15: when focus leaves the Grown-up area stack for a
 * learner screen (Back, Close or the tab bar, whatever the area was opened from), and when it lands on any learner
 * screen while a grown-up session is open, the session closes, so the next way into a grown-up surface asks the PIN
 * again. The one exception is the PIN screen going back to the action that asked for it (`markGateReturn`): that
 * landing keeps the session for the waiting action, and the next learner screen closes it. The routes are sorted by
 * `routeZone`; the PIN screens and onboarding in between do not count, and a state change that keeps focus on the
 * same route (a tab's own state, new params) is no landing. Installed with the navigator (App.tsx, after it is
 * ready). Always on. Returns the unsubscribe.
 */
export function watchGrownUpAreaExit(
  nav: FocusedRouteSource,
  close: () => void = closeGrownUpSession,
  session: SessionProbe = storeProbe,
): () => void {
  const left = areaExitTracker();
  let lastKey: string | undefined;
  const check = (): void => {
    const route = nav.getCurrentRoute();
    if (route === undefined) return;
    const key = route.key ?? `${route.name}:${JSON.stringify(route.params ?? null)}`;
    if (key === lastKey) return;
    lastKey = key;
    const zone = routeZone(route.name, route.params);
    if (zone === 'gate') return;
    if (left(zone, { sessionOpen: session.open(), returning: session.takeReturn() })) close();
  };
  check();
  return nav.addListener('state', check);
}

/** `CommonActions.reset(state)`, written out so this module loads without the navigation package (unit tests). */
export interface ResetAction {
  type: 'RESET';
  payload: { index: number; routes: LeaveRoute[] };
}

/** The part of the navigation container that leaves the area (`createNavigationContainerRef`). */
export interface AreaLeaveTarget {
  getCurrentRoute: () => FocusedRoute | undefined;
  getRootState: () => { routes: ReadonlyArray<LeaveRoute> } | undefined;
  dispatch: (action: ResetAction) => void;
}

/**
 * [OA] OA-D16, CS-14, OA-D5b (1): a session that ends while a Grown-up area page is in front (5 minutes in the
 * background, a change of learner) does not leave that page usable: every Grown-up area route is taken off the
 * stack and the PIN screen opens for the Grown-up area, so whoever picks the device up sees the PIN, and Cancel goes
 * back to the learner screen underneath. A close with a learner screen in front (the exit watcher) changes no
 * route; a device whose gate opens with no PIN at all (a self-only device that never set one) has nothing to ask.
 * Returns the unsubscribe.
 */
export function leaveGrownUpAreaOnClose(
  nav: AreaLeaveTarget,
  opensWithoutPin: () => boolean = gateOpensDirectlyNow,
  subscribe: (listener: () => void) => () => void = onGrownUpSessionClosed,
): () => void {
  return subscribe(() => {
    const route = nav.getCurrentRoute();
    if (route === undefined || routeZone(route.name, route.params) === 'learner') return;
    if (opensWithoutPin()) return;
    const kept = areaLeaveRoutes(nav.getRootState()?.routes ?? []);
    if (kept === null) return;
    const routes = [...kept, { name: 'PinEntry', params: { next: 'ParentDashboard' } }];
    nav.dispatch({ type: 'RESET', payload: { index: routes.length - 1, routes } });
  });
}
