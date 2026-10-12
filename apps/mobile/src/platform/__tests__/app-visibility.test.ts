import { beforeEach, describe, expect, it, vi } from 'vitest';

const rn = vi.hoisted(() => ({
  listeners: [] as Array<(state: string) => void>,
  removed: 0,
}));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_type: string, fn: (state: string) => void) => {
      rn.listeners.push(fn);
      return {
        remove: () => {
          rn.removed += 1;
        },
      };
    },
  },
}));

import { subscribeAppVisibility } from '../app-visibility';

beforeEach(() => {
  rn.listeners.length = 0;
  rn.removed = 0;
});

/**
 * F-REPORT-001 section 3.3.2 (RP-3b): on native, `AppState` `background`
 * ends the open session and `active` lets a mounted screen begin a new one.
 * `inactive` (a system sheet over the app on iOS) is neither.
 */
describe('platform/app-visibility (native)', () => {
  it('reads background as hidden, active as visible and ignores the rest', () => {
    const seen: boolean[] = [];
    const off = subscribeAppVisibility((visible) => seen.push(visible));
    const emit = (state: string): void => rn.listeners.forEach((l) => l(state));
    emit('background');
    emit('inactive');
    emit('unknown');
    emit('active');
    expect(seen).toEqual([false, true]);
    off();
    expect(rn.removed).toBe(1);
  });
});
