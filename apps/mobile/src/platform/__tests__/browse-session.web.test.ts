import { BROWSE_PASS_SESSION_KEY, type BrowsePass } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as nativeSession from '../browse';
import { readSessionPass, removeSessionPass, writeSessionPass } from '../browse.web';

/**
 * F-BROWSE-001 §4.3 (BR-3): the browse root reads its pass from
 * `sessionStorage['hr:browse:pass']` on the app origin, synchronously and
 * leniently: unreadable storage means no pass; anything that is not a valid
 * `BrowsePass` is ignored and removed; a valid pass stays for reloads.
 */
class FakeSessionStorage {
  readonly items = new Map<string, string>();
  getItem = vi.fn((key: string): string | null => this.items.get(key) ?? null);
  setItem = vi.fn((key: string, value: string): void => {
    this.items.set(key, value);
  });
  removeItem = vi.fn((key: string): void => {
    this.items.delete(key);
  });
}

const pass: BrowsePass = { v: 1, scope: 'full', source: 'account', issuedAt: 1_700_000_000_000, seen: 1_700_000_060_000, uiLocale: 'es' };

let storage: FakeSessionStorage;
beforeEach(() => {
  storage = new FakeSessionStorage();
  vi.stubGlobal('sessionStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

describe('readSessionPass (web)', () => {
  it('reads a valid pass and keeps it for reloads', () => {
    storage.items.set(BROWSE_PASS_SESSION_KEY, JSON.stringify(pass));
    expect(readSessionPass()).toEqual(pass);
    expect(readSessionPass()).toEqual(pass);
    expect(storage.items.has(BROWSE_PASS_SESSION_KEY)).toBe(true);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('reads a gate pass and a fallback pass', () => {
    const gate: BrowsePass = { v: 1, scope: 'sampler', source: 'gate', issuedAt: 5, seen: 5 };
    storage.items.set(BROWSE_PASS_SESSION_KEY, JSON.stringify(gate));
    expect(readSessionPass()).toEqual(gate);
    const fallback: BrowsePass = { v: 1, scope: 'sampler', source: 'account', issuedAt: 5, seen: 9, fallback: true };
    storage.items.set(BROWSE_PASS_SESSION_KEY, JSON.stringify(fallback));
    expect(readSessionPass()).toEqual(fallback);
  });

  it('no pass is no pass, and nothing is removed', () => {
    expect(readSessionPass()).toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('removes corrupt JSON and reads it as absent', () => {
    storage.items.set(BROWSE_PASS_SESSION_KEY, '{not json');
    expect(readSessionPass()).toBeNull();
    expect(storage.items.has(BROWSE_PASS_SESSION_KEY)).toBe(false);
  });

  it('removes anything that is not a pass, including a pass carrying person data', () => {
    const bad: unknown[] = [
      { ...pass, accountId: 'user_1' },
      { ...pass, email: 'a@b.c' },
      { ...pass, learnerId: 'profile:suni' },
      { ...pass, scope: 'none' },
      { ...pass, source: 'kept' },
      { ...pass, v: 2 },
      { ...pass, issuedAt: -1 },
      { ...pass, seen: pass.issuedAt - 1 },
      { ...pass, fallback: false },
      'full',
      42,
      null,
      [],
    ];
    for (const value of bad) {
      storage.items.set(BROWSE_PASS_SESSION_KEY, JSON.stringify(value));
      expect(readSessionPass(), JSON.stringify(value)).toBeNull();
      expect(storage.items.has(BROWSE_PASS_SESSION_KEY), JSON.stringify(value)).toBe(false);
    }
  });

  it('reads only its own key', () => {
    storage.items.set('hr:grownup:unlock', JSON.stringify({ v: 1 }));
    storage.items.set(BROWSE_PASS_SESSION_KEY, JSON.stringify(pass));
    readSessionPass();
    expect(storage.getItem.mock.calls.map((c) => c[0])).toEqual([BROWSE_PASS_SESSION_KEY]);
  });

  it('a sessionStorage that throws on read means no pass, and never throws', () => {
    storage.getItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readSessionPass()).toBeNull();
  });

  it('a corrupt value that cannot be removed still reads as absent', () => {
    storage.items.set(BROWSE_PASS_SESSION_KEY, '{not json');
    storage.removeItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readSessionPass()).toBeNull();
  });

  it('blocked site data (the sessionStorage getter throws) means no pass', () => {
    vi.unstubAllGlobals();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(readSessionPass()).toBeNull();
      expect(writeSessionPass(pass)).toBe(false);
      expect(() => removeSessionPass()).not.toThrow();
    } finally {
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });

  it('no sessionStorage at all means no pass', () => {
    // Explicitly absent: newer Node versions define Web Storage globals by default.
    vi.stubGlobal('sessionStorage', undefined);
    expect(readSessionPass()).toBeNull();
    expect(writeSessionPass(pass)).toBe(false);
  });
});

describe('writeSessionPass / removeSessionPass (web)', () => {
  it('writes a valid pass as JSON under its key', () => {
    expect(writeSessionPass({ ...pass, seen: pass.seen + 60_000 })).toBe(true);
    expect(JSON.parse(storage.items.get(BROWSE_PASS_SESSION_KEY) as string)).toEqual({ ...pass, seen: pass.seen + 60_000 });
    expect(readSessionPass()).toEqual({ ...pass, seen: pass.seen + 60_000 });
  });

  it('refuses to write anything that is not a pass', () => {
    expect(writeSessionPass({ ...pass, accountId: 'user_1' } as unknown as BrowsePass)).toBe(false);
    expect(writeSessionPass({ ...pass, seen: 0 })).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('reports false when the browser refuses the write', () => {
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(writeSessionPass(pass)).toBe(false);
  });

  it('removes the pass, and never throws', () => {
    storage.items.set(BROWSE_PASS_SESSION_KEY, JSON.stringify(pass));
    removeSessionPass();
    expect(storage.items.has(BROWSE_PASS_SESSION_KEY)).toBe(false);
    storage.removeItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => removeSessionPass()).not.toThrow();
  });
});

describe('native stub (OD-10: web only)', () => {
  it('has no session pass and writes nothing', () => {
    storage.items.set(BROWSE_PASS_SESSION_KEY, JSON.stringify(pass));
    expect(nativeSession.readSessionPass()).toBeNull();
    expect(nativeSession.writeSessionPass(pass)).toBe(false);
    nativeSession.removeSessionPass();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});
