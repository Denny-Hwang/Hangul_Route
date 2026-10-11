import { afterEach, describe, expect, it, vi } from 'vitest';
import * as native from '../orientation';
import {
  coarsePointer,
  currentPath,
  deviceOrientation,
  deviceScreen,
  editingText,
  subscribeDeviceOrientation,
  tryLockPortrait,
  unlock,
} from '../orientation.web';

/** Stubs the window bits the wrapper reads: matchMedia (standalone + pointer), screen.orientation, location. */
function stubWindow(o: { coarse?: boolean; standalone?: boolean; lock?: () => Promise<void>; unlock?: () => void; path?: string }): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(pointer: coarse)' ? (o.coarse ?? false) : query === '(display-mode: standalone)' ? (o.standalone ?? false) : false,
    })),
  );
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('screen', { orientation: { lock: o.lock, unlock: o.unlock } });
  vi.stubGlobal('location', { pathname: o.path ?? '/' });
}

describe('platform/orientation (native stub)', () => {
  it('reports touch, never locks, has no path', async () => {
    expect(native.coarsePointer()).toBe(true);
    await expect(native.tryLockPortrait('phone')).resolves.toBeUndefined();
    expect(() => native.unlock()).not.toThrow();
    expect(native.currentPath()).toBeNull();
  });

  it('knows nothing about the device (the app is portrait-locked by app.json) and never sees typing', () => {
    expect(native.deviceOrientation()).toBeNull();
    expect(native.deviceScreen()).toBeNull();
    expect(native.editingText()).toBe(false);
    const off = native.subscribeDeviceOrientation(() => undefined);
    expect(() => off()).not.toThrow();
  });
});

describe('platform/orientation.web', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('coarsePointer follows (pointer: coarse)', () => {
    stubWindow({ coarse: true });
    expect(coarsePointer()).toBe(true);
    stubWindow({ coarse: false });
    expect(coarsePointer()).toBe(false);
  });

  it('coarsePointer is false when matchMedia is missing or throws', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(coarsePointer()).toBe(false);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => {
        throw new Error('no');
      }),
    );
    expect(coarsePointer()).toBe(false);
  });

  it('locks portrait-primary only for an installed phone app', async () => {
    const lock = vi.fn(async () => undefined);
    stubWindow({ standalone: true, lock });
    await tryLockPortrait('phone');
    expect(lock).toHaveBeenCalledWith('portrait-primary');
  });

  it('never locks in a browser tab or on a tablet', async () => {
    const lock = vi.fn(async () => undefined);
    stubWindow({ standalone: false, lock });
    await tryLockPortrait('phone');
    stubWindow({ standalone: true, lock });
    await tryLockPortrait('tablet');
    expect(lock).not.toHaveBeenCalled();
  });

  it('swallows a refused lock and a missing API', async () => {
    stubWindow({ standalone: true, lock: vi.fn(async () => Promise.reject(new Error('NotSupportedError'))) });
    await expect(tryLockPortrait('phone')).resolves.toBeUndefined();
    stubWindow({ standalone: true });
    await expect(tryLockPortrait('phone')).resolves.toBeUndefined();
    vi.stubGlobal('screen', undefined);
    await expect(tryLockPortrait('phone')).resolves.toBeUndefined();
  });

  it('unlock calls screen.orientation.unlock and swallows failures', () => {
    const release = vi.fn();
    stubWindow({ unlock: release });
    unlock();
    expect(release).toHaveBeenCalledTimes(1);
    stubWindow({
      unlock: () => {
        throw new Error('InvalidStateError');
      },
    });
    expect(() => unlock()).not.toThrow();
    vi.stubGlobal('screen', undefined);
    expect(() => unlock()).not.toThrow();
  });

  it('currentPath reads location.pathname', () => {
    stubWindow({ path: '/present/abc' });
    expect(currentPath()).toBe('/present/abc');
    vi.stubGlobal('location', undefined);
    expect(currentPath()).toBeNull();
  });

  it('deviceOrientation reads screen.orientation.type first', () => {
    vi.stubGlobal('screen', { orientation: { type: 'landscape-primary' } });
    expect(deviceOrientation()).toBe('landscape');
    vi.stubGlobal('screen', { orientation: { type: 'portrait-secondary' } });
    expect(deviceOrientation()).toBe('portrait');
  });

  it('deviceOrientation falls back to window.orientation, then the orientation media query, then null', () => {
    vi.stubGlobal('screen', {});
    vi.stubGlobal('orientation', -90);
    expect(deviceOrientation()).toBe('landscape');
    vi.stubGlobal('orientation', 180);
    expect(deviceOrientation()).toBe('portrait');
    vi.stubGlobal('orientation', undefined);
    vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches: q === '(orientation: landscape)' })));
    expect(deviceOrientation()).toBe('landscape');
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    expect(deviceOrientation()).toBe('portrait');
    vi.stubGlobal('screen', { orientation: { type: 'weird' } });
    vi.stubGlobal('matchMedia', undefined);
    expect(deviceOrientation()).toBeNull();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => {
        throw new Error('no');
      }),
    );
    expect(deviceOrientation()).toBeNull();
  });

  it('deviceScreen reads screen.width / height, null when missing or zero', () => {
    vi.stubGlobal('screen', { width: 820, height: 1180 });
    expect(deviceScreen()).toEqual({ width: 820, height: 1180 });
    vi.stubGlobal('screen', { width: 0, height: 0 });
    expect(deviceScreen()).toBeNull();
    vi.stubGlobal('screen', {});
    expect(deviceScreen()).toBeNull();
    vi.stubGlobal('screen', undefined);
    expect(deviceScreen()).toBeNull();
  });

  it('editingText is true only for a focused text field', () => {
    const doc = (el: unknown) => vi.stubGlobal('document', { activeElement: el });
    doc({ tagName: 'INPUT', type: 'text' });
    expect(editingText()).toBe(true);
    doc({ tagName: 'INPUT', type: 'email' });
    expect(editingText()).toBe(true);
    doc({ tagName: 'TEXTAREA' });
    expect(editingText()).toBe(true);
    doc({ tagName: 'DIV', isContentEditable: true });
    expect(editingText()).toBe(true);
    doc({ tagName: 'INPUT', type: 'checkbox' });
    expect(editingText()).toBe(false);
    doc({ tagName: 'BUTTON' });
    expect(editingText()).toBe(false);
    doc(null);
    expect(editingText()).toBe(false);
    vi.stubGlobal('document', undefined);
    expect(editingText()).toBe(false);
  });

  it('subscribeDeviceOrientation listens to screen.orientation change and unsubscribes', () => {
    const add = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal('screen', { orientation: { addEventListener: add, removeEventListener: remove } });
    const cb = vi.fn();
    const off = subscribeDeviceOrientation(cb);
    expect(add).toHaveBeenCalledWith('change', cb);
    off();
    expect(remove).toHaveBeenCalledWith('change', cb);
  });

  it('subscribeDeviceOrientation falls back to orientationchange, and is a no-op without either', () => {
    const add = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal('screen', {});
    vi.stubGlobal('addEventListener', add);
    vi.stubGlobal('removeEventListener', remove);
    const cb = vi.fn();
    const off = subscribeDeviceOrientation(cb);
    expect(add).toHaveBeenCalledWith('orientationchange', cb);
    off();
    expect(remove).toHaveBeenCalledWith('orientationchange', cb);
    vi.stubGlobal('screen', undefined);
    vi.stubGlobal('addEventListener', undefined);
    expect(() => subscribeDeviceOrientation(cb)()).not.toThrow();
  });
});
