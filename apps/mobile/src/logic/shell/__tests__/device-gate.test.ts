import { DeviceGateMarkerSchema, type ProfileRole } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  NO_PIN_SEEN,
  deviceGateMarker,
  isLearnerEntry,
  pinEpochOf,
  pinHashFingerprint,
  reconcilePinEpoch,
  sameMarker,
  storedListHasLearner,
} from '../device-gate';

/**
 * F-APP-001 section 3.9: the device gate marker `hr:device:gate` that the console's grown-up
 * lock reads (A-4a `lib/console/device-marker.ts`), and the PIN epoch behind it.
 */
type ProfileLike = { role?: ProfileRole; learnerType?: 'child' | 'self' };
const child: ProfileLike = { role: 'learner', learnerType: 'child' };
const legacyChild: ProfileLike = { role: 'learner' };
const self: ProfileLike = { role: 'learner', learnerType: 'self' };
const parent: ProfileLike = { role: 'parent' };
const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90:0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';

describe('deviceGateMarker', () => {
  it('no learner profile: none (whatever the PIN)', () => {
    expect(deviceGateMarker({ profiles: [], parentPinHash: null, pinSetAt: null })).toEqual({ v: 1, gate: 'none' });
    expect(deviceGateMarker({ profiles: [], parentPinHash: HASH, pinSetAt: 5 })).toEqual({ v: 1, gate: 'none' });
    expect(deviceGateMarker({ profiles: [parent], parentPinHash: HASH, pinSetAt: 5 })).toEqual({ v: 1, gate: 'none' });
  });

  it('child profiles with a PIN: pin with the epoch from account:pinSetAt', () => {
    expect(deviceGateMarker({ profiles: [child, self], parentPinHash: HASH, pinSetAt: 1_760_000_000_000 })).toEqual({
      v: 1,
      gate: 'pin',
      pinEpoch: 1_760_000_000_000,
    });
  });

  it('a PIN set before A-6 (no pinSetAt) reads as epoch 0', () => {
    expect(deviceGateMarker({ profiles: [legacyChild], parentPinHash: HASH, pinSetAt: null })).toEqual({ v: 1, gate: 'pin', pinEpoch: 0 });
  });

  it('child profiles without a PIN: nopin (a family device whose children predate the PIN rule)', () => {
    expect(deviceGateMarker({ profiles: [child], parentPinHash: null, pinSetAt: null })).toEqual({ v: 1, gate: 'nopin' });
    expect(deviceGateMarker({ profiles: [legacyChild, self], parentPinHash: null, pinSetAt: 7 })).toEqual({ v: 1, gate: 'nopin' });
  });

  it('a self-only device: pin with a PIN, none without one', () => {
    expect(deviceGateMarker({ profiles: [self], parentPinHash: HASH, pinSetAt: 42 })).toEqual({ v: 1, gate: 'pin', pinEpoch: 42 });
    expect(deviceGateMarker({ profiles: [self, self], parentPinHash: null, pinSetAt: null })).toEqual({ v: 1, gate: 'none' });
    expect(deviceGateMarker({ profiles: [self, parent], parentPinHash: null, pinSetAt: null })).toEqual({ v: 1, gate: 'none' });
  });

  it('a profile saved before roles existed counts as a learner (the schema default), so it is gated', () => {
    const roleless: ProfileLike = {};
    expect(deviceGateMarker({ profiles: [roleless], parentPinHash: null, pinSetAt: null })).toEqual({ v: 1, gate: 'nopin' });
    expect(deviceGateMarker({ profiles: [roleless], parentPinHash: HASH, pinSetAt: 9 })).toEqual({ v: 1, gate: 'pin', pinEpoch: 9 });
  });

  it('every marker it writes is one the console accepts, and holds no name, count or profile data', () => {
    const cases = [
      deviceGateMarker({ profiles: [], parentPinHash: null, pinSetAt: null }),
      deviceGateMarker({ profiles: [child, child, child], parentPinHash: HASH, pinSetAt: 3 }),
      deviceGateMarker({ profiles: [child, child], parentPinHash: null, pinSetAt: null }),
    ];
    for (const marker of cases) {
      expect(DeviceGateMarkerSchema.safeParse(marker).success).toBe(true);
      expect(Object.keys(marker).sort()).toEqual(marker.gate === 'pin' ? ['gate', 'pinEpoch', 'v'] : ['gate', 'v']);
    }
  });
});

describe('pinEpochOf', () => {
  it('a finite, non-negative number is the epoch', () => {
    expect(pinEpochOf(1_760_000_000_000)).toBe(1_760_000_000_000);
    expect(pinEpochOf(0)).toBe(0);
  });

  it('anything else reads as 0 (absent, corrupt or foreign)', () => {
    for (const raw of [null, undefined, -1, Number.NaN, Number.POSITIVE_INFINITY, '1760000000000', {}, true]) {
      expect(pinEpochOf(raw), String(raw)).toBe(0);
    }
  });
});

describe('pinHashFingerprint', () => {
  it('is short, stable and never the hash itself', () => {
    const fp = pinHashFingerprint(HASH);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(pinHashFingerprint(HASH)).toBe(fp);
    expect(HASH.includes(fp)).toBe(false);
  });

  it('changes with the hash (a new PIN always has a new salt)', () => {
    const other = HASH.replace(/^a1/, 'a2');
    expect(pinHashFingerprint(other)).not.toBe(pinHashFingerprint(HASH));
    expect(pinHashFingerprint('x')).not.toBe(pinHashFingerprint('y'));
  });

  it('no PIN has its own fingerprint, distinct from any hash', () => {
    expect(pinHashFingerprint(null)).toBe(NO_PIN_SEEN);
    expect(pinHashFingerprint('')).not.toBe(NO_PIN_SEEN);
  });
});

describe('reconcilePinEpoch (any PIN change moves the epoch, whichever bundle made it)', () => {
  const NOW = 1_760_100_000_000;

  it('nothing to do when the stored hash is the one last seen', () => {
    expect(reconcilePinEpoch({ parentPinHash: HASH, pinSetAt: 5, pinHashSeen: pinHashFingerprint(HASH) }, NOW)).toBeNull();
    expect(reconcilePinEpoch({ parentPinHash: null, pinSetAt: null, pinHashSeen: NO_PIN_SEEN }, NOW)).toBeNull();
  });

  it('first boot of A-6: records the fingerprint and keeps the epoch (a PIN set before A-6 stays epoch 0)', () => {
    expect(reconcilePinEpoch({ parentPinHash: HASH, pinSetAt: null, pinHashSeen: null }, NOW)).toEqual({
      pinSetAt: null,
      pinHashSeen: pinHashFingerprint(HASH),
    });
    expect(reconcilePinEpoch({ parentPinHash: null, pinSetAt: null, pinHashSeen: null }, NOW)).toEqual({
      pinSetAt: null,
      pinHashSeen: NO_PIN_SEEN,
    });
  });

  it('a different hash than the one seen (a PIN changed by an older bundle): the epoch becomes now', () => {
    const changed = HASH.replace(/^a1/, 'ff');
    expect(reconcilePinEpoch({ parentPinHash: changed, pinSetAt: 5, pinHashSeen: pinHashFingerprint(HASH) }, NOW)).toEqual({
      pinSetAt: NOW,
      pinHashSeen: pinHashFingerprint(changed),
    });
    // A legacy PIN (epoch 0) that an older bundle then reset gets a real epoch, which a sign-in can confirm.
    expect(reconcilePinEpoch({ parentPinHash: changed, pinSetAt: null, pinHashSeen: pinHashFingerprint(HASH) }, NOW)).toEqual({
      pinSetAt: NOW,
      pinHashSeen: pinHashFingerprint(changed),
    });
  });

  it('a PIN added where none was seen moves the epoch too', () => {
    expect(reconcilePinEpoch({ parentPinHash: HASH, pinSetAt: 5, pinHashSeen: NO_PIN_SEEN }, NOW)).toEqual({
      pinSetAt: NOW,
      pinHashSeen: pinHashFingerprint(HASH),
    });
  });

  it('a PIN removed keeps the epoch (no pin marker carries it) and records no PIN', () => {
    expect(reconcilePinEpoch({ parentPinHash: null, pinSetAt: 5, pinHashSeen: pinHashFingerprint(HASH) }, NOW)).toEqual({
      pinSetAt: 5,
      pinHashSeen: NO_PIN_SEEN,
    });
  });
});

describe('sameMarker', () => {
  it('compares gate and epoch', () => {
    expect(sameMarker(null, { v: 1, gate: 'none' })).toBe(false);
    expect(sameMarker({ v: 1, gate: 'none' }, { v: 1, gate: 'none' })).toBe(true);
    expect(sameMarker({ v: 1, gate: 'nopin' }, { v: 1, gate: 'none' })).toBe(false);
    expect(sameMarker({ v: 1, gate: 'pin', pinEpoch: 1 }, { v: 1, gate: 'pin', pinEpoch: 1 })).toBe(true);
    expect(sameMarker({ v: 1, gate: 'pin', pinEpoch: 1 }, { v: 1, gate: 'pin', pinEpoch: 2 })).toBe(false);
    expect(sameMarker({ v: 1, gate: 'pin', pinEpoch: 1 }, { v: 1, gate: 'nopin' })).toBe(false);
  });
});

describe('isLearnerEntry and storedListHasLearner (the raw hr:profiles list)', () => {
  it('a learner, or an entry without a role, is a learner; the other roles are not', () => {
    expect(isLearnerEntry({ role: 'learner' })).toBe(true);
    expect(isLearnerEntry({ displayName: 'x' })).toBe(true);
    for (const role of ['parent', 'teacher', 'admin']) expect(isLearnerEntry({ role }), role).toBe(false);
  });

  it('an entry that is not an object counts as a learner (an unreadable entry never makes the marker none)', () => {
    for (const entry of [null, 'x', 7, true]) expect(isLearnerEntry(entry), String(entry)).toBe(true);
  });

  it('only a list with a learner holds one', () => {
    expect(storedListHasLearner([{ role: 'parent' }, { role: 'learner' }])).toBe(true);
    expect(storedListHasLearner([{ role: 'parent' }])).toBe(false);
    expect(storedListHasLearner([])).toBe(false);
    for (const raw of [null, undefined, '[]', {}, 3]) expect(storedListHasLearner(raw), String(raw)).toBe(false);
  });
});
