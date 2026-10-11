import { afterEach, describe, expect, it, vi } from 'vitest';
import * as native from '../orientation';
import { coarsePointer, currentPath, tryLockPortrait, unlock } from '../orientation.web';

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
});
