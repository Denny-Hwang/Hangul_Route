import { describe, expect, it, vi } from 'vitest';

const closedListeners = vi.hoisted(() => new Set<() => void>());
vi.mock('../../store/grown-up-session', () => ({
  closeGrownUpSession: vi.fn(),
  onGrownUpSessionClosed: (listener: () => void) => {
    closedListeners.add(listener);
    return () => closedListeners.delete(listener);
  },
}));
const opensWithoutPin = vi.hoisted(() => ({ value: false }));
vi.mock('../../store/gate-now', () => ({ gateOpensDirectlyNow: () => opensWithoutPin.value }));

import { closeGrownUpSession } from '../../store/grown-up-session';
import { useUiStore } from '../../store/ui-store';
import { leaveGrownUpAreaOnClose, watchGrownUpAreaExit, type AreaLeaveTarget, type FocusedRouteSource, type ResetAction, type SessionProbe } from '../grown-up-area-exit';

/** A session probe for the tests: `open` as set, and one PIN-screen return when `returning` is set. */
function probe(state: { open: boolean; returning?: boolean }): SessionProbe {
  return {
    open: () => state.open,
    takeReturn: () => {
      const r = state.returning === true;
      state.returning = false;
      return r;
    },
  };
}

function fakeNav(): FocusedRouteSource & { go: (name: string, params?: unknown) => void; listeners: number } {
  let current: { name: string; params?: unknown } | undefined;
  const callbacks = new Set<() => void>();
  return {
    get listeners() {
      return callbacks.size;
    },
    getCurrentRoute: () => current,
    addListener: (_type, cb) => {
      callbacks.add(cb);
      return () => callbacks.delete(cb);
    },
    go: (name, params) => {
      current = { name, params };
      for (const cb of callbacks) cb();
    },
  };
}

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D5b (2), CS-15: leaving the Grown-up area for a learner screen closes
// the grown-up session; moving inside the area, or through the PIN screens, does not.
describe('watchGrownUpAreaExit', () => {
  it('closes on Profile, PIN, Grown-up area, then Back to Profile', () => {
    const nav = fakeNav();
    const close = vi.fn();
    const stop = watchGrownUpAreaExit(nav, close);
    nav.go('Profile');
    nav.go('PinEntry', { next: 'ParentDashboard' });
    nav.go('ParentDashboard');
    nav.go('LearnerReport', { profileId: 'p' });
    nav.go('MyRoute', { profileId: 'p', viewer: 'grownup' });
    nav.go('ParentDashboard');
    expect(close).not.toHaveBeenCalled();
    nav.go('Profile');
    expect(close).toHaveBeenCalledTimes(1);
    nav.go('Home');
    expect(close).toHaveBeenCalledTimes(1);
    stop();
    expect(nav.listeners).toBe(0);
  });

  it('closes on the tab bar or a learner page reached through a PIN screen from the area', () => {
    const nav = fakeNav();
    const close = vi.fn();
    watchGrownUpAreaExit(nav, close);
    nav.go('ParentDashboard');
    nav.go('PinEntry', { next: 'LectureMode' });
    nav.go('Home');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reads the route it starts on, ignores an empty container, and uses closeGrownUpSession by default', () => {
    const nav = fakeNav();
    watchGrownUpAreaExit(nav);
    nav.go('ParentDashboard');
    nav.go('Home');
    expect(closeGrownUpSession).toHaveBeenCalledTimes(1);
    const empty: FocusedRouteSource = { getCurrentRoute: () => undefined, addListener: () => () => undefined };
    expect(() => watchGrownUpAreaExit(empty, vi.fn())).not.toThrow();
  });
});

// [OA] CS-1: an open session is honoured only inside the Grown-up area stack and for the one action that waited on
// the PIN screen; any other landing on a learner screen closes it.
describe('watchGrownUpAreaExit with the session (CS-1)', () => {
  it('closes a session a gate opened when focus lands back on a learner screen (Add a learner, then Cancel)', () => {
    const nav = fakeNav();
    const close = vi.fn();
    const session = { open: false };
    watchGrownUpAreaExit(nav, close, probe(session));
    nav.go('Profile');
    nav.go('PinEntry', { next: 'AddProfile' });
    session.open = true;
    nav.go('CreateProfile', { firstRun: false });
    expect(close).not.toHaveBeenCalled();
    nav.go('Profile');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps it for the PIN screen's return to the waiting action, and closes it on the next learner screen", () => {
    const nav = fakeNav();
    const close = vi.fn();
    const session = { open: false, returning: false };
    watchGrownUpAreaExit(nav, close, probe(session));
    nav.go('Profile');
    nav.go('PinEntry', { next: 'ExternalLink' });
    session.open = true;
    session.returning = true;
    nav.go('Profile');
    expect(close).not.toHaveBeenCalled();
    // Focus stays on Profile (its own state changes): no landing.
    nav.go('Profile');
    expect(close).not.toHaveBeenCalled();
    nav.go('Home');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('a landing that keeps the route key is no landing; a new key is', () => {
    let current: { name: string; key: string } = { name: 'Home', key: 'home-1' };
    const callbacks = new Set<() => void>();
    const nav: FocusedRouteSource = { getCurrentRoute: () => current, addListener: (_t, cb) => (callbacks.add(cb), () => callbacks.delete(cb)) };
    const close = vi.fn();
    watchGrownUpAreaExit(nav, close, probe({ open: true }));
    expect(close).toHaveBeenCalledTimes(1);
    for (const cb of callbacks) cb();
    expect(close).toHaveBeenCalledTimes(1);
    current = { name: 'Home', key: 'home-2' };
    for (const cb of callbacks) cb();
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('reads the ui-store by default: the session and the one-time return', () => {
    const nav = fakeNav();
    const close = vi.fn();
    useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, gateReturnPending: false });
    watchGrownUpAreaExit(nav, close);
    nav.go('Profile');
    nav.go('PinEntry', { next: 'Billing' });
    useUiStore.setState({ parentGateOpenedAt: Date.now() });
    useUiStore.getState().markGateReturn();
    nav.go('Paywall');
    nav.go('Profile');
    expect(close).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().gateReturnPending).toBe(false);
    useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: Date.now() });
    useUiStore.getState().markGateReturn();
    nav.go('PinEntry', { next: 'ExternalLink' });
    nav.go('StorySources', { storyId: 's' });
    expect(close).toHaveBeenCalledTimes(1);
    nav.go('Home');
    expect(close).toHaveBeenCalledTimes(2);
  });
});

function leaveNav(routes: { name: string; params?: unknown; key?: string }[]): AreaLeaveTarget & { dispatched: ResetAction[] } {
  const dispatched: ResetAction[] = [];
  return {
    dispatched,
    getCurrentRoute: () => routes[routes.length - 1],
    getRootState: () => ({ routes }),
    dispatch: (action) => {
      dispatched.push(action);
    },
  };
}

// [OA] OA-D16, CS-14: a session that ends with a Grown-up area page in front leaves it for the PIN screen.
describe('leaveGrownUpAreaOnClose', () => {
  it('takes every Grown-up area route off the stack and opens the PIN screen for the area', () => {
    const nav = leaveNav([{ name: 'Main', key: 'm' }, { name: 'Profile', key: 'p' }, { name: 'ParentDashboard', key: 'd' }, { name: 'LearnerReport', key: 'r' }]);
    opensWithoutPin.value = false;
    const stop = leaveGrownUpAreaOnClose(nav);
    for (const l of [...closedListeners]) l();
    expect(nav.dispatched).toEqual([
      {
        type: 'RESET',
        payload: { index: 2, routes: [{ name: 'Main', key: 'm' }, { name: 'Profile', key: 'p' }, { name: 'PinEntry', params: { next: 'ParentDashboard' } }] },
      },
    ]);
    stop();
    expect(closedListeners.size).toBe(0);
  });

  it('also from a PIN screen over the area; a stack that starts in the area keeps the learner home', () => {
    const nav = leaveNav([{ name: 'ParentDashboard' }, { name: 'PinEntry', params: { next: 'LectureMode' } }]);
    const stop = leaveGrownUpAreaOnClose(nav, () => false);
    for (const l of [...closedListeners]) l();
    expect(nav.dispatched[0]?.payload.routes).toEqual([{ name: 'Main' }, { name: 'PinEntry', params: { next: 'ParentDashboard' } }]);
    stop();
  });

  it('changes nothing with a learner screen in front, with no area route, or on a device whose gate needs no PIN', () => {
    const learner = leaveNav([{ name: 'Main' }, { name: 'ParentDashboard' }, { name: 'CardDetail' }]);
    const noArea = leaveNav([{ name: 'Main' }, { name: 'PinEntry', params: { next: 'Billing' } }]);
    const noPin = leaveNav([{ name: 'Main' }, { name: 'ParentDashboard' }]);
    const stops = [leaveGrownUpAreaOnClose(learner, () => false), leaveGrownUpAreaOnClose(noArea, () => false), leaveGrownUpAreaOnClose(noPin, () => true)];
    for (const l of [...closedListeners]) l();
    expect(learner.dispatched).toEqual([]);
    expect(noArea.dispatched).toEqual([]);
    expect(noPin.dispatched).toEqual([]);
    for (const stop of stops) stop();
    const empty: AreaLeaveTarget = { getCurrentRoute: () => undefined, getRootState: () => undefined, dispatch: vi.fn() };
    const stop = leaveGrownUpAreaOnClose(empty, () => false, (l) => {
      l();
      return () => undefined;
    });
    expect(empty.dispatch).not.toHaveBeenCalled();
    stop();
  });
});
