import type { GuestRecord, Profile } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { gateOpensDirectly } from '../../profiles/gate-route';
import { isSharedDevice } from '../../profiles/who';
import { deviceGateMarker } from '../../shell/device-gate';
import { moveRule, requestAction, type DeviceFacts } from '../../transfers/consent-gate';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON GU-D14, CS-G6, section 9.2 (row GU-2, section 19): `gateProfiles` feeds every
 * `gateRequired` caller. A live guest counts as a learner whose `learnerType` is unset (a child): the grown-up entries
 * ask a PIN on a self-only device without one while the guest lives (and open directly again once it is swept), the
 * device gate marker is never `none`, the transfer consent gate goes through the PIN, and one profile plus a live
 * guest is a shared device.
 */
const guest: GuestRecord = { v: 1, id: 'profile:guest001', startedAt: '2026-10-22T10:00:00.000Z', lastAt: '2026-10-22T10:00:00.000Z', via: 'site', questDone: false };
const self: Profile = { id: 'profile:self0001', displayName: 'Sam', ageGroup: '10-11', avatar: 'hoya-blue', role: 'learner', learnerType: 'self', createdAt: '2026-10-01T00:00:00.000Z' };
const HASH = 'salt:hash';

describe('gate-route: the grown-up entries (GU-D14)', () => {
  it('a self-only device without a PIN asks the PIN while the guest lives, and opens directly after the sweep', () => {
    expect(gateOpensDirectly({ profiles: [self], parentPinHash: null, sessionOpen: false, guest })).toBe(false);
    // The sweep took the record: as before the guest.
    expect(gateOpensDirectly({ profiles: [self], parentPinHash: null, sessionOpen: false, guest: null })).toBe(true);
    expect(gateOpensDirectly({ profiles: [self], parentPinHash: null, sessionOpen: false })).toBe(true);
  });

  it('a saved guest is that profile only; an open grown-up session still opens the grown-up entries', () => {
    expect(gateOpensDirectly({ profiles: [{ ...self, id: guest.id }], parentPinHash: null, sessionOpen: false, guest })).toBe(true);
    expect(gateOpensDirectly({ profiles: [self], parentPinHash: null, sessionOpen: true, guest })).toBe(true);
  });
});

describe('device gate marker with a live guest (CS-G6: never none)', () => {
  it('no profile: nopin, or pin with a PIN', () => {
    expect(deviceGateMarker({ profiles: [], parentPinHash: null, pinSetAt: null, guest })).toEqual({ v: 1, gate: 'nopin' });
    expect(deviceGateMarker({ profiles: [], parentPinHash: HASH, pinSetAt: 5, guest })).toEqual({ v: 1, gate: 'pin', pinEpoch: 5 });
  });

  it('a self-only device without a PIN: nopin while the guest lives, none without it', () => {
    expect(deviceGateMarker({ profiles: [self], parentPinHash: null, pinSetAt: null, guest })).toEqual({ v: 1, gate: 'nopin' });
    expect(deviceGateMarker({ profiles: [self], parentPinHash: null, pinSetAt: null, guest: null })).toEqual({ v: 1, gate: 'none' });
  });

  it('grown-up profiles only, with a guest: nopin (the guest is the learner)', () => {
    expect(deviceGateMarker({ profiles: [{ role: 'parent' }], parentPinHash: null, pinSetAt: null, guest })).toEqual({ v: 1, gate: 'nopin' });
  });
});

describe('transfer consent gate (GU-D14)', () => {
  const device = (patch: Partial<DeviceFacts> = {}): DeviceFacts => ({ profile: self, profiles: [self], selfConsentAcceptedAt: '2026-10-01T00:00:00.000Z', parentPinHash: null, pinCreatedAt: null, now: 0, ...patch });
  const facts = (d: DeviceFacts) => ({ scope: 'full' as const, transfersEnabled: true, transferDeviceConsent: true, hasFamily: false, selfManaged: true, transfers: [], device: d });

  it('a self learner moves directly on a self-only device, and through the gate while a guest lives', () => {
    expect(moveRule(facts(device()))).toEqual({ variant: 'move', attest: 'self', gated: false });
    expect(moveRule(facts(device({ guest })))).toEqual({ variant: 'move', attest: 'self', gated: true });
  });

  it('an open request is reviewed through the gate while a guest lives (PIN setup first: there is no PIN)', () => {
    const request = { id: 't1', status: 'requested', learnerRoute: 'device', initiator: 'learner_side', learnerState: 'pending', blockReason: null } as unknown as Parameters<typeof requestAction>[0];
    expect(requestAction(request, device())).toMatchObject({ gated: false, pinSetupFirst: false });
    expect(requestAction(request, device({ guest }))).toMatchObject({ gated: true, pinSetupFirst: true });
  });
});

describe('isSharedDevice with a live guest (section 9.2)', () => {
  const none = { locks: [], uses: [], marker: 'none' as const };

  it('one profile plus a live guest is shared; one profile alone is not', () => {
    expect(isSharedDevice({ profiles: [self], ...none, guest })).toBe(true);
    expect(isSharedDevice({ profiles: [self], ...none })).toBe(false);
  });

  it('a guest alone is no profile: not shared; a saved guest is one profile', () => {
    expect(isSharedDevice({ profiles: [], ...none, guest })).toBe(false);
    expect(isSharedDevice({ profiles: [{ id: guest.id }], ...none, guest })).toBe(false);
  });
});
