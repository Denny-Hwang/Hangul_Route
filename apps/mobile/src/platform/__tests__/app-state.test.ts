import { describe, expect, it, vi } from 'vitest';

const rn = vi.hoisted(() => ({ listeners: [] as Array<(state: string) => void>, removed: 0 }));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_type: string, fn: (state: string) => void) => {
      rn.listeners.push(fn);
      return { remove: () => (rn.removed += 1) };
    },
  },
}));

import { subscribeAppActive, type AppStateSource } from '../app-state';

/** A fake `AppState`: the test fires the states the platform would. */
function fakeSource(): AppStateSource & { emit(state: string): void; count(): number } {
  const listeners = new Set<(state: string) => void>();
  return {
    addEventListener: (_type, fn) => {
      listeners.add(fn);
      return { remove: () => listeners.delete(fn) };
    },
    emit: (state) => listeners.forEach((fn) => fn(state)),
    count: () => listeners.size,
  };
}

/**
 * F-VOC-004 §3.8 (S-5): the app going to the background pauses a Challenge
 * round. Native reads `AppState`: `background` and `inactive` (iOS: Control
 * Center, Notification Center or a call banner over the app, while JS still
 * runs) are not active, `active` is active again. A pause is always safe:
 * Resume is the learner's own tap.
 */
describe('platform/app-state (native)', () => {
  it('reports background and inactive as not active, active as active, and ignores the rest', () => {
    const source = fakeSource();
    const seen: boolean[] = [];
    const off = subscribeAppActive((active) => seen.push(active), source);
    source.emit('background');
    source.emit('unknown');
    source.emit('active');
    // iOS: a system sheet over the app leaves it `inactive`; the clock must not run behind it.
    source.emit('inactive');
    source.emit('active');
    expect(seen).toEqual([false, true, false, true]);
    off();
    expect(source.count()).toBe(0);
    source.emit('background');
    expect(seen).toEqual([false, true, false, true]);
  });

  it('listens to react-native AppState by default', () => {
    const seen: boolean[] = [];
    const off = subscribeAppActive((active) => seen.push(active));
    rn.listeners.forEach((fn) => fn('background'));
    expect(seen).toEqual([false]);
    off();
    expect(rn.removed).toBe(1);
  });
});
