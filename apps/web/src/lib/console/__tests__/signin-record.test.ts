import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../../i18n/safe-storage';
import { SIGNIN_RECORD_KEY, clearSignInRecord, readSignInRecord, writeOAuthStarted, writeSignInProof } from '../signin-record';

/**
 * F-APP-001 A-4b, section 3.9: a sign-in completed in this tab, kept in `sessionStorage` across
 * Clerk's redirect back to the router, so the router knows whether it proved a secret. Per tab,
 * guarded like every other web storage access (lib/i18n/safe-storage).
 */
function fakeStorage(initial: Record<string, string> = {}): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
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

const blocked: KeyValueStorage = {
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

describe('the sign-in record (hr:grownup:signin)', () => {
  it('lives in the grown-up session namespace, never under the learner keys', () => {
    expect(SIGNIN_RECORD_KEY).toBe('hr:grownup:signin');
  });

  it('round-trips a proof: the session it created and whether its first factor was a secret', () => {
    const storage = fakeStorage();
    expect(writeSignInProof({ sessionId: 'sess_1', secret: true }, 1_000, storage)).toBe(true);
    expect(JSON.parse(storage.map.get(SIGNIN_RECORD_KEY) ?? '')).toEqual({ v: 1, kind: 'proof', sessionId: 'sess_1', secret: true, at: 1_000 });
    expect(readSignInRecord(storage)).toEqual({ v: 1, kind: 'proof', sessionId: 'sess_1', secret: true, at: 1_000 });
    writeSignInProof({ sessionId: 'sess_2', secret: false }, 2_000, storage);
    expect(readSignInRecord(storage)).toEqual({ v: 1, kind: 'proof', sessionId: 'sess_2', secret: false, at: 2_000 });
  });

  it('round-trips an OAuth redirect that started in this tab', () => {
    const storage = fakeStorage();
    expect(writeOAuthStarted(5_000, storage)).toBe(true);
    expect(readSignInRecord(storage)).toEqual({ v: 1, kind: 'oauth', at: 5_000 });
  });

  it('clears', () => {
    const storage = fakeStorage();
    writeOAuthStarted(5_000, storage);
    clearSignInRecord(storage);
    expect(storage.map.has(SIGNIN_RECORD_KEY)).toBe(false);
    expect(readSignInRecord(storage)).toBeNull();
  });

  it.each([
    ['not JSON', '{'],
    ['another version', JSON.stringify({ v: 2, kind: 'oauth', at: 1 })],
    ['an unknown kind', JSON.stringify({ v: 1, kind: 'pin', at: 1 })],
    ['a proof without a session', JSON.stringify({ v: 1, kind: 'proof', secret: true, at: 1 })],
    ['a proof with an empty session', JSON.stringify({ v: 1, kind: 'proof', sessionId: '', secret: true, at: 1 })],
    ['a proof whose secret is not a boolean', JSON.stringify({ v: 1, kind: 'proof', sessionId: 's', secret: 'yes', at: 1 })],
    ['a negative time', JSON.stringify({ v: 1, kind: 'oauth', at: -1 })],
    ['a time that is not a number', JSON.stringify({ v: 1, kind: 'oauth', at: '1' })],
    ['an array', '[]'],
    ['null', 'null'],
  ])('reads %s as absent', (_, raw) => {
    expect(readSignInRecord(fakeStorage({ [SIGNIN_RECORD_KEY]: raw }))).toBeNull();
  });

  it('blocked or missing storage reads null and writes nothing, without throwing', () => {
    expect(readSignInRecord(blocked)).toBeNull();
    expect(writeSignInProof({ sessionId: 's', secret: true }, 1, blocked)).toBe(false);
    expect(writeOAuthStarted(1, blocked)).toBe(false);
    expect(() => clearSignInRecord(blocked)).not.toThrow();
    expect(readSignInRecord(null)).toBeNull();
    expect(writeOAuthStarted(1, null)).toBe(false);
  });

  it('reads the browser session storage by default (none in node: absent)', () => {
    expect(readSignInRecord()).toBeNull();
    expect(writeOAuthStarted(1)).toBe(false);
    expect(() => clearSignInRecord()).not.toThrow();
  });
});
