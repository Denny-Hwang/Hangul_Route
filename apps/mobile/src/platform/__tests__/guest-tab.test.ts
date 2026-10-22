import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GUEST_LEFT_SESSION_KEY,
  GUEST_LETTER_SESSION_KEY,
  clearFirstLetterDue,
  clearGuestLeft,
  firstLetterDueFor,
  guestLeftHere,
  markFirstLetterDue,
  markGuestLeft,
} from '../guest-tab';

/** [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 6.4 and 12 (row GU-3 fix stage): the guest run's per-tab marks. */
function area(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  } as unknown as Storage & { data: Map<string, string> };
}

afterEach(() => {
  clearGuestLeft();
  clearFirstLetterDue();
  vi.unstubAllGlobals();
});

describe('guest-tab', () => {
  it('keeps the marks in this tab\'s sessionStorage, keyed by the record they belong to', () => {
    const a = area();
    vi.stubGlobal('sessionStorage', a);
    markGuestLeft('profile:guest001');
    expect(a.data.get(GUEST_LEFT_SESSION_KEY)).toBe('profile:guest001');
    expect(guestLeftHere('profile:guest001')).toBe(true);
    expect(guestLeftHere('profile:guest002')).toBe(false);
    clearGuestLeft();
    expect(guestLeftHere('profile:guest001')).toBe(false);

    markFirstLetterDue('profile:guest001', 1234);
    expect(JSON.parse(a.data.get(GUEST_LETTER_SESSION_KEY)!)).toEqual({ id: 'profile:guest001', startedAt: 1234 });
    expect(firstLetterDueFor('profile:guest001')).toBe(1234);
    expect(firstLetterDueFor('profile:guest002')).toBeNull();
    clearFirstLetterDue();
    expect(firstLetterDueFor('profile:guest001')).toBeNull();
  });

  it('a mark that does not parse, or has no start, is none', () => {
    const a = area();
    vi.stubGlobal('sessionStorage', a);
    a.data.set(GUEST_LETTER_SESSION_KEY, '{nope');
    expect(firstLetterDueFor('profile:guest001')).toBeNull();
    a.data.set(GUEST_LETTER_SESSION_KEY, JSON.stringify({ id: 'profile:guest001', startedAt: 'soon' }));
    expect(firstLetterDueFor('profile:guest001')).toBeNull();
  });

  it('no sessionStorage, a refusing one, or one whose getter throws: the marks live in memory', () => {
    markGuestLeft('profile:guest001');
    expect(guestLeftHere('profile:guest001')).toBe(true);
    const refusing = {
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
    vi.stubGlobal('sessionStorage', refusing);
    markFirstLetterDue('profile:guest001', 99);
    expect(firstLetterDueFor('profile:guest001')).toBe(99);
    clearFirstLetterDue();
    expect(firstLetterDueFor('profile:guest001')).toBeNull();
    vi.unstubAllGlobals();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(guestLeftHere('profile:guest001')).toBe(true);
    } finally {
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });
});
