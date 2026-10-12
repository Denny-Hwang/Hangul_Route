import { afterEach, describe, expect, it, vi } from 'vitest';
import * as native from '../online';
import { isOnline, subscribeOnline } from '../online.web';

/**
 * F-APP-001 sections 3.6 and 3.12 (A-7): the grown-up entries are disabled while
 * `navigator.onLine` is false and re-enable on the `online` event.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isOnline (web)', () => {
  it('follows navigator.onLine', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(isOnline()).toBe(false);
    vi.stubGlobal('navigator', { onLine: true });
    expect(isOnline()).toBe(true);
  });

  it('counts a browser that does not say as online (the page load decides)', () => {
    vi.stubGlobal('navigator', {});
    expect(isOnline()).toBe(true);
    vi.stubGlobal('navigator', undefined);
    expect(isOnline()).toBe(true);
  });
});

describe('subscribeOnline (web)', () => {
  it('reports offline and online from the window events, and stops after unsubscribe', () => {
    const target = new EventTarget();
    vi.stubGlobal('addEventListener', target.addEventListener.bind(target));
    vi.stubGlobal('removeEventListener', target.removeEventListener.bind(target));
    const seen: boolean[] = [];
    const stop = subscribeOnline((online) => seen.push(online));
    target.dispatchEvent(new Event('offline'));
    target.dispatchEvent(new Event('online'));
    stop();
    target.dispatchEvent(new Event('offline'));
    expect(seen).toEqual([false, true]);
  });

  it('is a no-op where the window has no events', () => {
    vi.stubGlobal('addEventListener', undefined);
    const stop = subscribeOnline(() => undefined);
    expect(() => stop()).not.toThrow();
  });
});

describe('native stub', () => {
  it('is always online and never subscribes (no grown-up entry on native, OD-6)', () => {
    expect(native.isOnline()).toBe(true);
    const listener = vi.fn();
    native.subscribeOnline(listener)();
    expect(listener).not.toHaveBeenCalled();
  });
});
