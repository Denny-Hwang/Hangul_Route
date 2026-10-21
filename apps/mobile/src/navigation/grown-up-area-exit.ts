import { areaExitTracker, areaLeaveRoutes, routeZone, type LeaveRoute } from '../logic/profiles/session';
import { gateOpensDirectlyNow } from '../store/gate-now';
import { closeGrownUpSession, onGrownUpSessionClosed, type SessionClosed } from '../store/grown-up-session';
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

/** The PIN screens: a close while one is in front asks the PIN for the Grown-up area again (it was asking anyway). */
const PIN_ROUTES: ReadonlySet<string> = new Set(['PinEntry', 'PinReset']);

/** Runs `task` once the navigation the current call may still make has applied (`setTimeout` 0). */
export type Defer = (task: () => void) => void;

const nextTurn: Defer = (task) => {
  setTimeout(task, 0);
};

/**
 * [OA] OA-D16, CS-1, CS-14, CS-15, OA-D5b (1): a grown-up session that ends never leaves a Grown-up area page usable,
 * in front or underneath.
 *
 * - A Grown-up area page (or a PIN screen) in front: every Grown-up area route is taken off the stack and the PIN
 *   screen opens for the Grown-up area, so whoever picks the device up sees the PIN, and Cancel goes back to the
 *   learner screen underneath.
 * - A learner screen (or onboarding) in front: the Grown-up area routes under it are taken off the stack and the
 *   front route stays as it is, so Back or Leave from it never lands on a Grown-up area page without the PIN (a
 *   level check started from the Placement report, Add a learner).
 *
 * Only a close that ended an open session acts (a learner chosen by a restore or a claim on a device with no session
 * changes nothing). A close for a change of learner (`switch`) acts once the surface that made the change has
 * navigated (`defer`): a retake from the Placement report or Add a learner leaves the area by itself, and what stays
 * is checked after. A device whose gate opens with no PIN at all (a self-only device that never set one) has nothing
 * to ask. Returns the unsubscribe.
 */
export function leaveGrownUpAreaOnClose(
  nav: AreaLeaveTarget,
  opensWithoutPin: () => boolean = gateOpensDirectlyNow,
  subscribe: (listener: (closed: SessionClosed) => void) => () => void = onGrownUpSessionClosed,
  defer: Defer = nextTurn,
): () => void {
  const leave = (): void => {
    if (opensWithoutPin()) return;
    const route = nav.getCurrentRoute();
    if (route === undefined) return;
    const routes = nav.getRootState()?.routes ?? [];
    const frontInArea = routeZone(route.name, route.params) === 'area' || PIN_ROUTES.has(route.name);
    if (!frontInArea) {
      const kept = routes.filter((r) => routeZone(r.name, r.params) !== 'area');
      if (kept.length === routes.length || kept.length === 0) return;
      nav.dispatch({ type: 'RESET', payload: { index: kept.length - 1, routes: kept } });
      return;
    }
    // A PIN screen over learner screens only (Open billing, a source link) is left as it is.
    const kept = areaLeaveRoutes(routes);
    if (kept === null) return;
    const pinRoutes = [...kept, { name: 'PinEntry', params: { next: 'ParentDashboard' } }];
    nav.dispatch({ type: 'RESET', payload: { index: pinRoutes.length - 1, routes: pinRoutes } });
  };
  return subscribe(({ reason, wasOpen }) => {
    if (!wasOpen) return;
    if (reason === 'switch') defer(leave);
    else leave();
  });
}
