import { describe, expect, it, vi } from 'vitest';

vi.mock('../../store/grown-up-session', () => ({ closeGrownUpSession: vi.fn() }));

import { closeGrownUpSession } from '../../store/grown-up-session';
import { watchGrownUpAreaExit, type FocusedRouteSource } from '../grown-up-area-exit';

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
