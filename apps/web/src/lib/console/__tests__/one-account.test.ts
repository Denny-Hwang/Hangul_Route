import { APP_ORIGIN, GROWN_UP_BACKGROUND_MS, GROWN_UP_FRESH_PIN_MS, SITE_ORIGIN, safeNextPath, type GrownUpUnlock, type PinOwner } from '@hangul-route/content-schema';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { lockPasskeyEnabled } from '../config';
import type { DeviceGateRead } from '../grown-up-lock';
import {
  PIN_OWNER_FACTORS,
  PIN_RESET_PATH,
  RESET_LEG_FACTORS,
  deviceUsesOf,
  freshPinUnlock,
  hiddenTooLong,
  isGrownUpLockMessage,
  isResetLeg,
  ownsPin,
  passkeyButtonShown,
  passkeySnapshot,
  passkeyUsedDuring,
  pinOwnerAtSignIn,
  pinOwnerFingerprint,
  pinOwnerOffer,
  pinOwnerRecord,
  pinOwnerRefresh,
  pinPromptShown,
  pinPromptTarget,
  platformAuthenticatorAvailable,
  realPinEpoch,
} from '../one-account';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-3 (sections 7.1 to 7.4 and 7.6; CS-10, CS-14, CS-17; section 20):
 * the console's pure decisions for `deviceUses`, `pinOwner`, Use a passkey, the 5-minute hidden rule and the
 * `hr-grownup` message.
 */
const NOW = 1_800_000_000_000;
const EPOCH = 1_790_000_000_000;
const PIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: EPOCH }, hasProfiles: true };
const PIN_ZERO: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: 0 }, hasProfiles: true };
const NOPIN: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true };
const NONE: DeviceGateRead = { readable: true, marker: { v: 1, gate: 'none' }, hasProfiles: true };
const ABSENT: DeviceGateRead = { readable: true, marker: null, hasProfiles: true };
const FAILED: DeviceGateRead = { readable: false, reason: 'failed' };
const NO_IDB: DeviceGateRead = { readable: false, reason: 'unavailable' };

const pinUnlock = (at: number, pinEpoch = EPOCH): GrownUpUnlock => ({ v: 1, at, seen: at, src: 'pin', pinEpoch });
const signinUnlock = (at: number): GrownUpUnlock => ({ v: 1, at, seen: at, src: 'signin' });
const OWNER = 'a1b2c3d4e5f60718';
const OTHER = '0011223344556677';
const owned = (owner: string, epoch: number): PinOwner => ({ v: 1, owner, epoch });

const space = (kind: string, role: string) => ({ space: { id: `space:${kind}`, name: 'Sunflower', kind }, role }) as unknown as { space: { kind: 'family' }; role: 'owner' };

describe('deviceUsesOf: the record the adult frame writes (section 7.1)', () => {
  it('holds the uses of the spaces, in the fixed order, and the time', () => {
    expect(deviceUsesOf([space('school', 'admin'), space('class', 'teacher'), space('family', 'caregiver')], NOW)).toEqual({ v: 1, uses: ['family', 'teacher', 'school'], at: NOW });
  });

  it('holds no name, email, account id or space id: only v, uses and at', () => {
    const record = deviceUsesOf([space('family', 'owner')], NOW);
    expect(Object.keys(record).sort()).toEqual(['at', 'uses', 'v']);
    expect(JSON.stringify(record)).not.toMatch(/Sunflower|space:/);
  });

  it('skips students and kinds this bundle does not know', () => {
    expect(deviceUsesOf([space('class', 'student'), space('club', 'owner')], NOW)).toEqual({ v: 1, uses: [], at: NOW });
    expect(deviceUsesOf([], NOW).uses).toEqual([]);
  });
});

describe('the factor sets (sections 7.2 and 7.4, OQ-21)', () => {
  it('a PIN owner is named only by a password or a code, never a passkey or OAuth', () => {
    expect([...PIN_OWNER_FACTORS].sort()).toEqual(['email_code', 'password', 'phone_code']);
  });

  it('the reset leg also takes the password-reset codes, never a passkey', () => {
    expect([...RESET_LEG_FACTORS].sort()).toEqual(['email_code', 'password', 'phone_code', 'reset_password_email_code', 'reset_password_phone_code']);
    expect(RESET_LEG_FACTORS.has('passkey')).toBe(false);
  });
});

describe('isResetLeg: next = /account/pin-reset', () => {
  it.each([PIN_RESET_PATH, `${PIN_RESET_PATH}/`, `${PIN_RESET_PATH}.html`, `${PIN_RESET_PATH}?x=1`, `${PIN_RESET_PATH}#top`])('%s is the reset leg', (next) => {
    expect(isResetLeg(next)).toBe(true);
  });

  it.each(['/account/pin-resetx', '/account/billing', '/parent', '', null, undefined])('%s is not', (next) => {
    expect(isResetLeg(next)).toBe(false);
  });
});

describe('realPinEpoch and freshPinUnlock', () => {
  it('only a readable pin marker with an epoch above 0 has a real epoch', () => {
    expect(realPinEpoch(PIN)).toBe(EPOCH);
    for (const device of [PIN_ZERO, NOPIN, NONE, ABSENT, FAILED, NO_IDB]) expect(realPinEpoch(device)).toBeNull();
  });

  it('a pin unlock for the epoch, under 2 minutes old, is fresh', () => {
    expect(freshPinUnlock(pinUnlock(NOW), EPOCH, NOW)).toBe(true);
    expect(freshPinUnlock(pinUnlock(NOW - GROWN_UP_FRESH_PIN_MS + 1), EPOCH, NOW)).toBe(true);
  });

  it('an older one, one from the future, another epoch, a sign-in unlock or none is not', () => {
    expect(freshPinUnlock(pinUnlock(NOW - GROWN_UP_FRESH_PIN_MS), EPOCH, NOW)).toBe(false);
    expect(freshPinUnlock(pinUnlock(NOW + 1), EPOCH, NOW)).toBe(false);
    expect(freshPinUnlock(pinUnlock(NOW, EPOCH + 1), EPOCH, NOW)).toBe(false);
    expect(freshPinUnlock(signinUnlock(NOW), EPOCH, NOW)).toBe(false);
    expect(freshPinUnlock(null, EPOCH, NOW)).toBe(false);
  });
});

describe('pinOwnerAtSignIn: moment 1, a fresh PIN then the account’s own password or code in the same tab (CS-10)', () => {
  const base = { earlier: pinUnlock(NOW - 30_000), device: PIN, factor: 'password', resetLeg: false, now: NOW };

  it.each(['password', 'email_code', 'phone_code'])('%s after a fresh PIN names the owner for the marker epoch', (factor) => {
    expect(pinOwnerAtSignIn({ ...base, factor })).toBe(EPOCH);
  });

  it('a sign-in alone, with no PIN unlock before it, writes nothing', () => {
    expect(pinOwnerAtSignIn({ ...base, earlier: null })).toBeNull();
    expect(pinOwnerAtSignIn({ ...base, earlier: signinUnlock(NOW - 1000) })).toBeNull();
  });

  it('a passkey, an OAuth sign-in, a password-reset code or an unknown factor writes nothing', () => {
    for (const factor of ['passkey', 'oauth_google', 'reset_password_email_code', '', null, undefined]) expect(pinOwnerAtSignIn({ ...base, factor })).toBeNull();
  });

  it('the reset leg writes nothing, whatever the factor', () => {
    expect(pinOwnerAtSignIn({ ...base, resetLeg: true })).toBeNull();
  });

  it('a stale PIN, a PIN for another epoch, epoch 0 and a marker that is not pin write nothing', () => {
    expect(pinOwnerAtSignIn({ ...base, earlier: pinUnlock(NOW - GROWN_UP_FRESH_PIN_MS) })).toBeNull();
    expect(pinOwnerAtSignIn({ ...base, earlier: pinUnlock(NOW - 1000, EPOCH - 1) })).toBeNull();
    expect(pinOwnerAtSignIn({ ...base, device: PIN_ZERO, earlier: pinUnlock(NOW - 1000, 0) })).toBeNull();
    for (const device of [NOPIN, NONE, ABSENT, FAILED, NO_IDB]) expect(pinOwnerAtSignIn({ ...base, device })).toBeNull();
  });
});

describe('pinOwnerRefresh: moment 2 refreshes the same owner only', () => {
  it('moves the epoch of the same owner', () => {
    expect(pinOwnerRefresh({ stored: owned(OWNER, EPOCH - 5), owner: OWNER, epoch: EPOCH })).toEqual(owned(OWNER, EPOCH));
  });

  it('writes nothing for another account, with no record, with no fingerprint or when the epoch is already current', () => {
    expect(pinOwnerRefresh({ stored: owned(OTHER, EPOCH - 5), owner: OWNER, epoch: EPOCH })).toBeNull();
    expect(pinOwnerRefresh({ stored: null, owner: OWNER, epoch: EPOCH })).toBeNull();
    expect(pinOwnerRefresh({ stored: owned(OWNER, EPOCH - 5), owner: null, epoch: EPOCH })).toBeNull();
    expect(pinOwnerRefresh({ stored: owned(OWNER, EPOCH), owner: OWNER, epoch: EPOCH })).toBeNull();
  });

  it('never writes a record for epoch 0', () => {
    expect(pinOwnerRefresh({ stored: owned(OWNER, EPOCH), owner: OWNER, epoch: 0 })).toBeNull();
  });
});

describe('ownsPin and pinOwnerOffer: moment 3, the persona home card (design D13)', () => {
  it('ownsPin needs the same owner and the same epoch', () => {
    expect(ownsPin(owned(OWNER, EPOCH), OWNER, EPOCH)).toBe(true);
    expect(ownsPin(owned(OWNER, EPOCH - 1), OWNER, EPOCH)).toBe(false);
    expect(ownsPin(owned(OTHER, EPOCH), OWNER, EPOCH)).toBe(false);
    expect(ownsPin(null, OWNER, EPOCH)).toBe(false);
    expect(ownsPin(owned(OWNER, EPOCH), null, EPOCH)).toBe(false);
  });

  const base = { unlock: pinUnlock(NOW - 10_000), device: PIN, stored: null, owner: OWNER, now: NOW };

  it('is offered while the PIN hand-off is under 2 minutes old and this account does not own the PIN', () => {
    expect(pinOwnerOffer(base)).toBe(EPOCH);
    expect(pinOwnerOffer({ ...base, stored: owned(OTHER, EPOCH) })).toBe(EPOCH);
    expect(pinOwnerOffer({ ...base, stored: owned(OWNER, EPOCH - 1) })).toBe(EPOCH);
  });

  it('is not offered to the owner, without a fresh PIN, without a fingerprint, or off a real pin marker', () => {
    expect(pinOwnerOffer({ ...base, stored: owned(OWNER, EPOCH) })).toBeNull();
    expect(pinOwnerOffer({ ...base, unlock: pinUnlock(NOW - GROWN_UP_FRESH_PIN_MS) })).toBeNull();
    expect(pinOwnerOffer({ ...base, unlock: signinUnlock(NOW) })).toBeNull();
    expect(pinOwnerOffer({ ...base, unlock: null })).toBeNull();
    expect(pinOwnerOffer({ ...base, owner: null })).toBeNull();
    for (const device of [PIN_ZERO, NOPIN, NONE, ABSENT, FAILED]) expect(pinOwnerOffer({ ...base, device })).toBeNull();
  });

  it('pinOwnerRecord builds only a valid record', () => {
    expect(pinOwnerRecord(OWNER, EPOCH)).toEqual(owned(OWNER, EPOCH));
    expect(pinOwnerRecord(null, EPOCH)).toBeNull();
    expect(pinOwnerRecord('not-hex', EPOCH)).toBeNull();
    expect(pinOwnerRecord(OWNER, 0)).toBeNull();
  });
});

describe('pinOwnerFingerprint: the first 16 hex digits of SHA-256 of the user id', () => {
  it('matches node’s SHA-256', async () => {
    const expected = createHash('sha256').update('user_2abc').digest('hex').slice(0, 16);
    expect(await pinOwnerFingerprint('user_2abc')).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{16}$/);
  });

  it('without Web Crypto in the page it gives null', async () => {
    const crypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(await pinOwnerFingerprint('user_2abc')).toBeNull();
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: crypto, configurable: true });
    }
  });

  it('no id, no Web Crypto or a failing digest gives null', async () => {
    expect(await pinOwnerFingerprint(null)).toBeNull();
    expect(await pinOwnerFingerprint('')).toBeNull();
    expect(await pinOwnerFingerprint('user_2abc', null)).toBeNull();
    expect(await pinOwnerFingerprint('user_2abc', { digest: async () => Promise.reject(new Error('no')) })).toBeNull();
  });
});

describe('Use a passkey: the availability check and the pin marker rule (section 7.4, CS-17)', () => {
  it('shows only with the flag, a platform authenticator and a read nopin marker (the one locked row that is not pin)', () => {
    expect(passkeyButtonShown({ flag: true, available: true, device: NOPIN })).toBe(true);
  });

  it('never on a pin browser, nor where it may be one: a failed read or a missing marker with profiles (fail closed)', () => {
    expect(passkeyButtonShown({ flag: true, available: true, device: PIN })).toBe(false);
    expect(passkeyButtonShown({ flag: true, available: true, device: PIN_ZERO })).toBe(false);
    expect(passkeyButtonShown({ flag: true, available: true, device: FAILED })).toBe(false);
    expect(passkeyButtonShown({ flag: true, available: true, device: { readable: true, marker: null, hasProfiles: true } })).toBe(false);
  });

  it('never where the lock never closes either (none, no learner data, no IndexedDB)', () => {
    for (const device of [NONE, NO_IDB, { readable: true, marker: null, hasProfiles: false } as DeviceGateRead]) {
      expect(passkeyButtonShown({ flag: true, available: true, device })).toBe(false);
    }
  });

  it('never with the flag off, no authenticator or no read yet', () => {
    expect(passkeyButtonShown({ flag: false, available: true, device: NOPIN })).toBe(false);
    expect(passkeyButtonShown({ flag: true, available: false, device: NOPIN })).toBe(false);
    expect(passkeyButtonShown({ flag: true, available: true, device: null })).toBe(false);
  });

  it('platformAuthenticatorAvailable is true only when the API resolves exactly true', async () => {
    const api = (result: () => Promise<unknown>) => ({ PublicKeyCredential: { isUserVerifyingPlatformAuthenticatorAvailable: result as () => Promise<boolean> } });
    expect(await platformAuthenticatorAvailable(api(async () => true))).toBe(true);
    expect(await platformAuthenticatorAvailable(api(async () => false))).toBe(false);
    expect(await platformAuthenticatorAvailable(api(async () => 'yes'))).toBe(false);
    expect(await platformAuthenticatorAvailable(api(() => Promise.reject(new Error('blocked'))))).toBe(false);
    expect(await platformAuthenticatorAvailable(api(() => { throw new Error('sync'); }))).toBe(false);
    expect(await platformAuthenticatorAvailable({ PublicKeyCredential: {} })).toBe(false);
    expect(await platformAuthenticatorAvailable({})).toBe(false);
    expect(await platformAuthenticatorAvailable(null)).toBe(false);
  });
});

describe('passkeyUsedDuring: the passkey check after a Clerk reverification (server stamps only)', () => {
  const before = passkeySnapshot([
    { id: 'pk_1', lastUsedAt: new Date(NOW - 86_400_000) },
    { id: 'pk_2', lastUsedAt: null },
  ]);

  it('a passkey whose lastUsedAt moved, or that was used for the first time, counts as used', () => {
    expect(passkeyUsedDuring(before, [{ id: 'pk_1', lastUsedAt: new Date(NOW - 86_400_000 + 1) }, { id: 'pk_2', lastUsedAt: null }])).toBe(true);
    expect(passkeyUsedDuring(before, [{ id: 'pk_1', lastUsedAt: new Date(NOW - 86_400_000) }, { id: 'pk_2', lastUsedAt: NOW }])).toBe(true);
  });

  it('a new passkey already used counts as used; a new one never used does not', () => {
    expect(passkeyUsedDuring(passkeySnapshot([]), [{ id: 'pk_9', lastUsedAt: NOW }])).toBe(true);
    expect(passkeyUsedDuring(passkeySnapshot([]), [{ id: 'pk_9', lastUsedAt: null }])).toBe(false);
  });

  it('unchanged stamps, no passkeys and unreadable stamps do not', () => {
    expect(passkeyUsedDuring(before, [{ id: 'pk_1', lastUsedAt: new Date(NOW - 86_400_000) }, { id: 'pk_2', lastUsedAt: null }])).toBe(false);
    expect(passkeyUsedDuring(passkeySnapshot([]), [])).toBe(false);
    expect(passkeyUsedDuring(passkeySnapshot([{ id: 'pk_1', lastUsedAt: Number.NaN }]), [{ id: 'pk_1', lastUsedAt: Number.NaN }])).toBe(false);
  });

  it('does not depend on this device’s clock: a client 5 minutes fast still sees a stamp that moved', () => {
    // The old check compared lastUsedAt with Date.now() minus a skew; the snapshot compares server stamps only.
    const stamp = NOW - 10 * 60_000;
    expect(passkeyUsedDuring(passkeySnapshot([{ id: 'pk_1', lastUsedAt: stamp - 3_600_000 }]), [{ id: 'pk_1', lastUsedAt: stamp }])).toBe(true);
  });

  it('keys passkeys without an id by position', () => {
    expect(passkeyUsedDuring(passkeySnapshot([{ lastUsedAt: 1 }]), [{ lastUsedAt: 2 }])).toBe(true);
    expect(passkeyUsedDuring(passkeySnapshot([{ lastUsedAt: 1 }]), [{ lastUsedAt: 1 }])).toBe(false);
  });

  it('fails closed: no snapshot (the account was not loaded), or an account with passkeys that could not be read again', () => {
    expect(passkeySnapshot(undefined)).toBeNull();
    expect(passkeySnapshot(null)).toBeNull();
    expect(passkeyUsedDuring(null, [])).toBe(true);
    expect(passkeyUsedDuring(before, null)).toBe(true);
    expect(passkeyUsedDuring(passkeySnapshot([]), null)).toBe(false);
  });
});

describe('hiddenTooLong: the 5-minute hidden rule (OA-D16, CS-14)', () => {
  it('drops the unlock after 5 minutes hidden, by the wall clock', () => {
    expect(hiddenTooLong(NOW - GROWN_UP_BACKGROUND_MS, NOW)).toBe(true);
    expect(hiddenTooLong(NOW - GROWN_UP_BACKGROUND_MS - 60_000, NOW)).toBe(true);
  });

  it('keeps it when hidden less, or never hidden', () => {
    expect(hiddenTooLong(NOW - GROWN_UP_BACKGROUND_MS + 1, NOW)).toBe(false);
    expect(hiddenTooLong(NOW, NOW)).toBe(false);
    expect(hiddenTooLong(null, NOW)).toBe(false);
  });

  it('a clock that ran backwards drops it (fail closed)', () => {
    expect(hiddenTooLong(NOW + 1, NOW)).toBe(true);
  });
});

describe('isGrownUpLockMessage: the hr-grownup message (section 7.6)', () => {
  it('accepts { v: 1, kind: "lock" }, the message the learner app posts', () => {
    expect(isGrownUpLockMessage({ v: 1, kind: 'lock' })).toBe(true);
  });

  it.each([{ v: 1, kind: 'lock', at: 1 }, { v: 1, kind: 'lock', reason: 'chooser' }, { v: 2, kind: 'lock' }])('locks in the safe direction on a later shape %j (CS-2)', (data) => {
    expect(isGrownUpLockMessage(data)).toBe(true);
  });

  it.each([{ v: 1, kind: 'open' }, { kind: 'lock' }, { v: 0, kind: 'lock' }, { v: 1.5, kind: 'lock' }, { v: '1', kind: 'lock' }, ['lock'], 'lock', null, undefined, 1])('ignores %j', (data) => {
    expect(isGrownUpLockMessage(data)).toBe(false);
  });
});

describe('pinPromptShown: the set-a-PIN card (section 7.6)', () => {
  it('shows once, only on a nopin browser not yet marked seen', () => {
    expect(pinPromptShown(NOPIN, false)).toBe(true);
    expect(pinPromptShown(NOPIN, true)).toBe(false);
    expect(pinPromptShown(NOPIN, null)).toBe(false);
    for (const device of [PIN, NONE, ABSENT, FAILED, NO_IDB]) expect(pinPromptShown(device, false)).toBe(false);
    expect(pinPromptShown(null, false)).toBe(false);
  });

  it('opens the learner app’s PIN gate with this home as next (the app drops a grown-up gate without one)', () => {
    expect(pinPromptTarget('https://app.hangulroute.com', '/parent')).toBe('/?gate=grown-up&next=%2Fparent');
    expect(pinPromptTarget('http://localhost:3000', '/teach')).toBe('/?gate=grown-up&next=%2Fteach');
    // The learner app's boot intent (apps/mobile logic/shell/boot-intent.ts) keeps the gate only with a next that
    // safeNextPath accepts.
    const query = new URLSearchParams(pinPromptTarget('http://localhost:3000', '/parent').split('?')[1]);
    expect(query.get('gate')).toBe('grown-up');
    expect(safeNextPath(query.get('next'))).toBe('/parent');
  });

  it('on a site origin it is the app host’s address', () => {
    expect(pinPromptTarget(SITE_ORIGIN, '/parent')).toBe(`${APP_ORIGIN}/?gate=grown-up&next=%2Fparent`);
  });
});

describe('NEXT_PUBLIC_LOCK_PASSKEY (section 16): on unless switched off', () => {
  it('is on by default and for any other value', () => {
    expect(lockPasskeyEnabled({})).toBe(true);
    for (const on of ['enabled', 'true', '1', '', ' ON ']) expect(lockPasskeyEnabled({ NEXT_PUBLIC_LOCK_PASSKEY: on }), on).toBe(true);
  });

  it('false, 0, off and disabled switch the button off, case and spaces ignored', () => {
    for (const off of ['false', '0', 'off', 'disabled', ' FALSE ', 'Off']) expect(lockPasskeyEnabled({ NEXT_PUBLIC_LOCK_PASSKEY: off }), off).toBe(false);
  });
});
