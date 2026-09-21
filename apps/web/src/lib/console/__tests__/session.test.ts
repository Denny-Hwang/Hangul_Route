import { describe, expect, it } from 'vitest';
import { SESSION_KEY, clearSession, readSession, writeSession, type KeyValueStorage } from '../session';

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

describe('console session (F-CONSOLE-001 §3.2)', () => {
  it('round-trips a session and clears it', () => {
    const storage = fakeStorage();
    const session = { token: 't', accountId: 'teacher-kim', displayName: 'Ms Kim', email: 'kim@example.com' };
    expect(readSession(storage)).toBeNull();
    expect(writeSession(session, storage)).toBe(true);
    expect(readSession(storage)).toEqual(session);
    clearSession(storage);
    expect(readSession(storage)).toBeNull();
  });

  it('treats corrupt or partial data as signed out', () => {
    const storage = fakeStorage();
    storage.map.set(SESSION_KEY, '{not json');
    expect(readSession(storage)).toBeNull();
    storage.map.set(SESSION_KEY, JSON.stringify({ token: '', accountId: 'x', displayName: 'y' }));
    expect(readSession(storage)).toBeNull();
    storage.map.set(SESSION_KEY, JSON.stringify('nope'));
    expect(readSession(storage)).toBeNull();
  });

  it('survives storage that throws or is missing (SSR, private mode)', () => {
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
    expect(readSession(throwing)).toBeNull();
    expect(writeSession({ token: 't', accountId: 'a', displayName: 'n' }, throwing)).toBe(false);
    expect(() => clearSession(throwing)).not.toThrow();
    expect(readSession(null)).toBeNull();
    expect(writeSession({ token: 't', accountId: 'a', displayName: 'n' }, null)).toBe(false);
    expect(() => clearSession(null)).not.toThrow();
    // default storage in a node test environment is null (no window)
    expect(readSession()).toBeNull();
    expect(writeSession({ token: 't', accountId: 'a', displayName: 'n' })).toBe(false);
  });
});
