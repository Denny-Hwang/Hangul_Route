import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, isStandalone, subscribePwa } from '../pwa';
import * as web from '../pwa.web';

describe('platform/pwa (native no-op)', () => {
  it('never fires and reports standalone', () => {
    const l = vi.fn();
    const off = subscribePwa(l);
    off();
    applyUpdate();
    expect(l).not.toHaveBeenCalled();
    expect(isStandalone()).toBe(true);
  });
});

describe('platform/pwa.web', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forwards shell and connectivity events to one listener and unsubscribes', () => {
    const handlers = new Map<string, () => void>();
    const win = {
      addEventListener: vi.fn((name: string, h: () => void) => handlers.set(name, h)),
      removeEventListener: vi.fn((name: string) => handlers.delete(name)),
      matchMedia: vi.fn(() => ({ matches: true })),
      navigator: {},
      __hrApplyUpdate: vi.fn(),
    };
    vi.stubGlobal('addEventListener', win.addEventListener);
    vi.stubGlobal('removeEventListener', win.removeEventListener);
    vi.stubGlobal('matchMedia', win.matchMedia);
    vi.stubGlobal('navigator', win.navigator);
    vi.stubGlobal('__hrApplyUpdate', win.__hrApplyUpdate);

    const l = vi.fn();
    const off = web.subscribePwa(l);
    handlers.get('hr:offline-ready')?.();
    handlers.get('hr:update-ready')?.();
    handlers.get('offline')?.();
    handlers.get('online')?.();
    expect(l.mock.calls.map((c) => c[0])).toEqual(['offline-ready', 'update-ready', 'went-offline', 'back-online']);
    expect(web.isStandalone()).toBe(true);
    web.applyUpdate();
    expect(win.__hrApplyUpdate).toHaveBeenCalled();
    off();
    expect(handlers.size).toBe(0);
  });

  it('is inert without a window', () => {
    vi.stubGlobal('addEventListener', undefined);
    vi.stubGlobal('matchMedia', undefined);
    expect(() => web.subscribePwa(vi.fn())()).not.toThrow();
    expect(web.isStandalone()).toBe(false);
    expect(() => web.applyUpdate()).not.toThrow();
  });
});
