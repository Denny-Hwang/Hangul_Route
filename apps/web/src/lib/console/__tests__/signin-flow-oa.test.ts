import { GROWN_UP_FRESH_PIN_MS, type GrownUpUnlock } from '@hangul-route/content-schema';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

const idb = vi.hoisted(() => ({ data: new Map<string, unknown>() }));
vi.mock('idb-keyval', () => ({
  createStore: () => () => undefined,
  get: async (key: string) => idb.data.get(key),
  set: async (key: string, value: unknown) => {
    idb.data.set(key, value);
  },
  del: async (key: string) => {
    idb.data.delete(key);
  },
}));

import type { DeviceGateRead } from '../grown-up-lock';
import { PIN_RESET_PATH } from '../one-account';
import { finishReverify, grantSignInUnlock, isSecretProvingSignIn, planAfterSignIn, proofAtSignIn, proofFromSignUp, recordPinOwner, secretFactorVerifiedHere, settleSignIn, type SignInIo, type UnlockWriters } from '../signin-flow';
import type { SignInRecord } from '../signin-record';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-3 (sections 7.2 and 7.4; CS-10, CS-17): the sign-in side of the PIN
 * owner and the passkey rule. `grantSignInUnlock` reads the earlier unlock before it writes its own, names an owner
 * only after a fresh PIN plus a password or a code in the same tab, and the reset leg writes no trusted epoch and no
 * owner. On a `pin` browser a passkey signs in but unlocks nothing.
 */
const NOW = 1_800_000_000_000;
const EPOCH = 1_790_000_000_000;
const PIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: EPOCH }, hasProfiles: true };
const NOPIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true };
const NONE: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'none' }, hasProfiles: true };
const FAILED: DeviceGateRead = { readable: false, reason: 'failed' };
const NO_IDB: DeviceGateRead = { readable: false, reason: 'unavailable' };

const pinUnlock = (at: number): GrownUpUnlock => ({ v: 1, at, seen: at, src: 'pin', pinEpoch: EPOCH });

function writers(earlier: GrownUpUnlock | null): UnlockWriters & { log: string[] } {
  const log: string[] = [];
  let unlock = earlier;
  return {
    log,
    readUnlock: () => {
      log.push(`read:${unlock?.src ?? 'none'}`);
      return unlock;
    },
    writeUnlock: (now) => {
      log.push('writeUnlock');
      unlock = { v: 1, at: now, seen: now, src: 'signin' };
      return true;
    },
    writeEpoch: async (epoch) => {
      log.push(`writeEpoch:${epoch}`);
      return true;
    },
    writePinOwner: async (accountId, epoch) => {
      log.push(`owner:${accountId}:${epoch}`);
      return true;
    },
  };
}

describe('isSecretProvingSignIn: the passkey rule (section 7.4, CS-17)', () => {
  it('a passkey does not count on a pin browser, nor where the read failed', () => {
    expect(isSecretProvingSignIn({ factor: 'passkey', device: PIN, resetLeg: false })).toBe(false);
    expect(isSecretProvingSignIn({ factor: 'passkey', device: FAILED, resetLeg: false })).toBe(false);
  });

  it('a passkey counts on every other browser', () => {
    for (const device of [NOPIN, NONE, NO_IDB, { readable: true, marker: null, hasProfiles: true } as DeviceGateRead]) expect(isSecretProvingSignIn({ factor: 'passkey', device, resetLeg: false })).toBe(true);
  });

  it('a password or a code counts everywhere off the reset leg', () => {
    for (const factor of ['password', 'email_code', 'phone_code', undefined]) expect(isSecretProvingSignIn({ factor, device: PIN, resetLeg: false })).toBe(true);
  });

  it('on the reset leg only a password, a code or a password-reset code counts, on every browser', () => {
    for (const factor of ['password', 'email_code', 'phone_code', 'reset_password_email_code', 'reset_password_phone_code']) expect(isSecretProvingSignIn({ factor, device: NONE, resetLeg: true })).toBe(true);
    for (const factor of ['passkey', undefined, null]) {
      expect(isSecretProvingSignIn({ factor, device: NONE, resetLeg: true })).toBe(false);
      expect(isSecretProvingSignIn({ factor, device: PIN, resetLeg: true })).toBe(false);
    }
  });
});

describe('planAfterSignIn with the factor and the reset leg', () => {
  const proof = (factor?: string): SignInRecord => ({ v: 1, kind: 'proof', sessionId: 's1', secret: true, ...(factor ? { factor } : {}), at: NOW - 1 });

  it('a passkey on a pin browser signs in but unlocks nothing and asks for no reverification: the lock decides', () => {
    expect(planAfterSignIn({ record: proof('passkey'), sessionId: 's1', device: PIN, now: NOW })).toBe('none');
    expect(planAfterSignIn({ record: proof('passkey'), sessionId: 's1', device: NOPIN, now: NOW })).toBe('unlock');
  });

  it('on the reset leg a passkey unlocks nothing; a code does', () => {
    expect(planAfterSignIn({ record: proof('passkey'), sessionId: 's1', device: NONE, now: NOW, next: PIN_RESET_PATH })).toBe('none');
    expect(planAfterSignIn({ record: proof('email_code'), sessionId: 's1', device: PIN, now: NOW, next: PIN_RESET_PATH })).toBe('unlock');
  });
});

describe('the factor travels with the proof', () => {
  it('a passkey verified before the session appeared stays a passkey', () => {
    expect(secretFactorVerifiedHere({ firstFactorVerification: { strategy: 'passkey', status: 'verified' } }, null)).toBe('passkey');
    expect(proofAtSignIn({ sessionId: 's1', record: { v: 1, kind: 'secret', at: NOW - 1, factor: 'passkey' }, now: NOW })).toEqual({ sessionId: 's1', secret: true, factor: 'passkey' });
  });

  it('a sign-up names the code it verified with; nothing verified names nothing', () => {
    expect(secretFactorVerifiedHere(null, { verifications: { phoneNumber: { strategy: 'phone_code', status: 'verified' } } })).toBe('phone_code');
    expect(secretFactorVerifiedHere(null, null)).toBeNull();
    expect(secretFactorVerifiedHere({ firstFactorVerification: { strategy: 'oauth_google', status: 'verified' } }, null)).toBeNull();
    expect(proofFromSignUp({ status: 'complete', createdSessionId: 's', verifications: { emailAddress: { strategy: 'email_code', status: 'verified' } } })?.factor).toBe('email_code');
  });
});

describe('grantSignInUnlock: the PIN owner (section 7.2, CS-10)', () => {
  it('moment 1: a fresh PIN, then a password in the same tab, names this account for the marker epoch; the earlier unlock is read first', async () => {
    const w = writers(pinUnlock(NOW - 30_000));
    await grantSignInUnlock(PIN, NOW, w, { factor: 'password', accountId: 'user_grown_up' });
    expect(w.log).toEqual(['read:pin', 'writeUnlock', `writeEpoch:${EPOCH}`, `owner:user_grown_up:${EPOCH}`]);
  });

  it('a sign-in alone (no PIN unlock before it) never names an owner', async () => {
    const w = writers(null);
    await grantSignInUnlock(PIN, NOW, w, { factor: 'email_code', accountId: 'user_child' });
    expect(w.log).toEqual(['read:none', 'writeUnlock', `writeEpoch:${EPOCH}`]);
  });

  it('a passkey, a reverification (no factor) or a stale PIN never names an owner', async () => {
    for (const [earlier, factor] of [
      [pinUnlock(NOW - 1000), 'passkey'],
      [pinUnlock(NOW - 1000), null],
      [pinUnlock(NOW - GROWN_UP_FRESH_PIN_MS), 'password'],
    ] as const) {
      const w = writers(earlier);
      await grantSignInUnlock(PIN, NOW, w, { factor, accountId: 'user_grown_up' });
      expect(w.log.some((entry) => entry.startsWith('owner:'))).toBe(false);
    }
  });

  it('no account id writes no owner', async () => {
    const w = writers(pinUnlock(NOW - 1000));
    await grantSignInUnlock(PIN, NOW, w, { factor: 'password' });
    expect(w.log.some((entry) => entry.startsWith('owner:'))).toBe(false);
  });

  it('the reset leg writes the sign-in unlock only: no trusted epoch and no owner', async () => {
    const w = writers(pinUnlock(NOW - 1000));
    await grantSignInUnlock(PIN, NOW, w, { factor: 'password', resetLeg: true, accountId: 'user_grown_up' });
    expect(w.log).toEqual(['read:pin', 'writeUnlock']);
  });

  it('writers without the OA hooks keep the earlier behaviour', async () => {
    const log: string[] = [];
    await grantSignInUnlock(PIN, NOW, { writeUnlock: () => (log.push('u'), true), writeEpoch: async (e) => (log.push(`e${e}`), true) }, { factor: 'password', accountId: 'a' });
    expect(log).toEqual(['u', `e${EPOCH}`]);
  });
});

describe('the CS-10 sequence', () => {
  it('a child signs in with their own code, a grown-up later opens a page with the PIN: no owner is ever named for the child', async () => {
    // 1. The child signs in in a tab with no PIN unlock.
    const child = writers(null);
    await grantSignInUnlock(PIN, NOW, child, { factor: 'email_code', accountId: 'user_child' });
    expect(child.log.some((entry) => entry.startsWith('owner:'))).toBe(false);
    // 2. The grown-up's PIN opens a page through the lock: moment 2 refreshes an existing owner only (one-account tests).
    // 3. The child tries the reset leg: it writes no owner and no trusted epoch either.
    const reset = writers(pinUnlock(NOW + 60_000));
    await grantSignInUnlock(PIN, NOW + 70_000, reset, { factor: 'email_code', resetLeg: true, accountId: 'user_child' });
    expect(reset.log).toEqual(['read:pin', 'writeUnlock']);
  });
});

describe('settleSignIn and finishReverify pass the context on', () => {
  function io(record: SignInRecord | null, device: DeviceGateRead): SignInIo & { grants: unknown[] } {
    const grants: unknown[] = [];
    return {
      grants,
      now: () => NOW,
      readRecord: () => record,
      clearRecord: () => undefined,
      readDevice: async () => device,
      grant: async (_device, _now, context) => {
        grants.push(context);
      },
    };
  }

  it('a secret proof grants with its factor, the reset leg and the account', async () => {
    const x = io({ v: 1, kind: 'proof', sessionId: 's1', secret: true, factor: 'password', at: NOW - 1 }, PIN);
    await settleSignIn(x, 's1', { next: '/parent', accountId: 'user_1' });
    expect(x.grants).toEqual([{ factor: 'password', resetLeg: false, accountId: 'user_1' }]);
    const y = io({ v: 1, kind: 'proof', sessionId: 's1', secret: true, factor: 'email_code', at: NOW - 1 }, PIN);
    await settleSignIn(y, 's1', { next: PIN_RESET_PATH });
    expect(y.grants).toEqual([{ factor: 'email_code', resetLeg: true, accountId: null }]);
  });

  it('a proof without a factor grants with none; no context means no account', async () => {
    const x = io({ v: 1, kind: 'proof', sessionId: 's1', secret: true, at: NOW - 1 }, NONE);
    await settleSignIn(x, 's1');
    expect(x.grants).toEqual([{ factor: null, resetLeg: false, accountId: null }]);
  });

  it('a reverification names no factor', async () => {
    const x = io(null, PIN);
    await finishReverify(x, PIN, true, { next: PIN_RESET_PATH, accountId: 'user_1' });
    await finishReverify(x, PIN, true);
    await finishReverify(x, PIN, false);
    expect(x.grants).toEqual([
      { factor: null, resetLeg: true, accountId: 'user_1' },
      { factor: null, resetLeg: false, accountId: null },
    ]);
  });
});

describe('recordPinOwner: the fingerprint, never the id, is stored', () => {
  it('writes the first 16 hex digits of SHA-256 of the id', async () => {
    vi.stubGlobal('indexedDB', {});
    idb.data.clear();
    expect(await recordPinOwner('user_2abc', EPOCH)).toBe(true);
    const stored = idb.data.get('pinOwner');
    expect(stored).toEqual({ v: 1, owner: createHash('sha256').update('user_2abc').digest('hex').slice(0, 16), epoch: EPOCH });
    expect(JSON.stringify(stored)).not.toContain('user_2abc');
    vi.unstubAllGlobals();
  });

  it('epoch 0 writes nothing', async () => {
    idb.data.clear();
    expect(await recordPinOwner('user_2abc', 0)).toBe(false);
    expect(idb.data.size).toBe(0);
  });
});
