import { areaExitTracker, routeZone } from '../logic/profiles/session';
import { closeGrownUpSession } from '../store/grown-up-session';

/** The part of the navigation container this needs (`createNavigationContainerRef`). */
export interface FocusedRouteSource {
  getCurrentRoute: () => { name: string; params?: unknown } | undefined;
  addListener: (type: 'state', callback: () => void) => () => void;
}

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D5b (2), CS-15: when focus leaves the Grown-up area stack for a learner
 * screen (Back, Close or the tab bar, whatever the area was opened from), the grown-up session closes, so the
 * next way in asks the PIN again. The routes are sorted by `routeZone`; the PIN screens in between do not count.
 * Installed with the navigator (App.tsx, after it is ready). Always on. Returns the unsubscribe.
 */
export function watchGrownUpAreaExit(nav: FocusedRouteSource, close: () => void = closeGrownUpSession): () => void {
  const left = areaExitTracker();
  const check = (): void => {
    const route = nav.getCurrentRoute();
    if (route !== undefined && left(routeZone(route.name, route.params))) close();
  };
  check();
  return nav.addListener('state', check);
}
