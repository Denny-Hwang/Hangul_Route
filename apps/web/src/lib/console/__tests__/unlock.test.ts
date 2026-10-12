import { CONSOLE_SESSION_KEY, GROWN_UP_IDLE_MS, UNLOCK_SESSION_KEY } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../../i18n/safe-storage';
import { UNLOCK_TOUCH_MS, clearGrownUpTab, clearUnlock, readUnlock, touchUnlock, writeSignInUnlock } from '../unlock';

/**
 * F-APP-001 section 3.9: `sessionStorage` `hr:grownup:unlock` of this tab. The learner app
 * writes a PIN unlock (with the marker epoch); a secret-proving sign-in writes a sign-in
 * unlock; the frame refreshes `seen` at most once a minute. Every access is guarded.
 */
function fakeStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const NOW = 1_800_000_000_000;

describe('readUnlock', () => {
  it('reads a sign-in unlock and a PIN unlock with its epoch', () => {
    const s = fakeStorage();
    s.map.set(UNLOCK_SESSION_KEY, JSON.stringify({ v: 1, at: NOW, seen: NOW, src: 'signin' }));
    expect(readUnlock(s)).toEqual({ v: 1, at: NOW, seen: NOW, src: 'signin' });
    s.map.set(UNLOCK_SESSION_KEY, JSON.stringify({ v: 1, at: NOW, seen: NOW, src: 'pin', pinEpoch: 5 }));
    expect(readUnlock(s)).toEqual({ v: 1, at: NOW, seen: NOW, src: 'pin', pinEpoch: 5 });
  });

  it('a PIN unlock without pinEpoch reads as absent (the lock then falls to the none-or-expired row)', () => {
    const s = fakeStorage();
    s.map.set(UNLOCK_SESSION_KEY, JSON.stringify({ v: 1, at: NOW, seen: NOW, src: 'pin' }));
    expect(readUnlock(s)).toBeNull();
  });

  it('corrupt, foreign or negative records read as absent', () => {
    const s = fakeStorage();
    for (const raw of ['{not json', '"x"', JSON.stringify({ v: 2, at: NOW, seen: NOW, src: 'signin' }), JSON.stringify({ v: 1, at: -1, seen: NOW, src: 'signin' }), JSON.stringify({ v: 1, at: NOW, seen: NOW, src: 'oauth' })]) {
      s.map.set(UNLOCK_SESSION_KEY, raw);
      expect(readUnlock(s), raw).toBeNull();
    }
  });

  it('missing or throwing storage reads as absent; the default storage in node is none', () => {
    expect(readUnlock(fakeStorage())).toBeNull();
    expect(readUnlock(throwing)).toBeNull();
    expect(readUnlock(null)).toBeNull();
    expect(readUnlock()).toBeNull();
  });
});

describe('writeSignInUnlock', () => {
  it('writes { v: 1, at, seen, src: signin } with no epoch', () => {
    const s = fakeStorage();
    expect(writeSignInUnlock(NOW, s)).toBe(true);
    expect(JSON.parse(s.map.get(UNLOCK_SESSION_KEY) ?? 'null')).toEqual({ v: 1, at: NOW, seen: NOW, src: 'signin' });
    expect(readUnlock(s)).toEqual({ v: 1, at: NOW, seen: NOW, src: 'signin' });
  });

  it('reports false when storage refuses or is missing', () => {
    expect(writeSignInUnlock(NOW, throwing)).toBe(false);
    expect(writeSignInUnlock(NOW, null)).toBe(false);
    expect(writeSignInUnlock(NOW)).toBe(false);
  });
});

describe('touchUnlock: refresh seen at most once a minute, only while active', () => {
  it('refreshes an active unlock older than a minute and keeps its source and epoch', () => {
    const s = fakeStorage();
    s.map.set(UNLOCK_SESSION_KEY, JSON.stringify({ v: 1, at: NOW, seen: NOW, src: 'pin', pinEpoch: 7 }));
    expect(touchUnlock(NOW + UNLOCK_TOUCH_MS, s)).toBe(true);
    expect(readUnlock(s)).toEqual({ v: 1, at: NOW, seen: NOW + UNLOCK_TOUCH_MS, src: 'pin', pinEpoch: 7 });
  });

  it('does not write within the minute', () => {
    const s = fakeStorage();
    writeSignInUnlock(NOW, s);
    expect(touchUnlock(NOW + UNLOCK_TOUCH_MS - 1, s)).toBe(false);
    expect(readUnlock(s)?.seen).toBe(NOW);
  });

  it('never revives an expired unlock, a clock that ran backwards, or an absent one', () => {
    const s = fakeStorage();
    writeSignInUnlock(NOW, s);
    expect(touchUnlock(NOW + GROWN_UP_IDLE_MS, s)).toBe(false);
    expect(readUnlock(s)?.seen).toBe(NOW);
    expect(touchUnlock(NOW - 1, s)).toBe(false);
    expect(touchUnlock(NOW, fakeStorage())).toBe(false);
    expect(touchUnlock(NOW, throwing)).toBe(false);
    expect(touchUnlock(NOW)).toBe(false);
  });

  it('is a one-minute step', () => {
    expect(UNLOCK_TOUCH_MS).toBe(60_000);
  });
});

describe('clearing', () => {
  it('clearUnlock removes the unlock only', () => {
    const s = fakeStorage();
    writeSignInUnlock(NOW, s);
    s.map.set(CONSOLE_SESSION_KEY, '{"token":"t"}');
    clearUnlock(s);
    expect(s.map.has(UNLOCK_SESSION_KEY)).toBe(false);
    expect(s.map.has(CONSOLE_SESSION_KEY)).toBe(true);
  });

  it('clearGrownUpTab removes the unlock and the console session (Back to learning, Sign out)', () => {
    const s = fakeStorage();
    writeSignInUnlock(NOW, s);
    s.map.set(CONSOLE_SESSION_KEY, '{"token":"t"}');
    s.map.set('hr:other', 'kept');
    clearGrownUpTab(s);
    expect([...s.map.keys()]).toEqual(['hr:other']);
  });

  it('never throws', () => {
    expect(() => clearUnlock(throwing)).not.toThrow();
    expect(() => clearGrownUpTab(throwing)).not.toThrow();
    expect(() => clearGrownUpTab(null)).not.toThrow();
    expect(() => clearGrownUpTab()).not.toThrow();
  });
});
