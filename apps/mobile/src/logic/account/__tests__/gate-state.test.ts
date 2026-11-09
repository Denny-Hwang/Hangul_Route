import type { GuestRecord } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { NO_PIN_SEEN, PIN_HASH_UNREAD, pinHashFingerprint } from '../../shell/device-gate';
import { nativeGateStateOf, type NativeGateInput } from '../gate-state';

/**
 * F-AUTH-004 section 7.2 (row NS-2; CS-N14): the native gate state over every input, and every way it reads `unknown`.
 * Never the in-memory marker: the stores and the exact reads the marker writer makes.
 */

const HASH = 'salt:hash-of-1234';
const CHILD = { id: 'p:mina', role: 'learner' as const, learnerType: 'child' as const };
const SELF = { id: 'p:ana', role: 'learner' as const, learnerType: 'self' as const };
const PARENT = { id: 'p:mom', role: 'parent' as const };
const GUEST: GuestRecord = { v: 1, id: 'guest:abc', startedAt: '2026-11-08T10:00:00.000Z' } as unknown as GuestRecord;

type Memory = NativeGateInput['memory'];

/** A consistent device: memory and storage agree, every store is in, the epoch reconciled. */
function input(memory: Partial<Memory> = {}, over: Partial<Omit<NativeGateInput, 'memory'>> = {}): NativeGateInput {
  const mem: Memory = { profiles: [CHILD], parentPinHash: HASH, pinSetAt: 1_700_000_000_000, pinHashSeen: null, guest: null, ...memory };
  const full: Memory = { ...mem, pinHashSeen: memory.pinHashSeen === undefined ? pinHashFingerprint(mem.parentPinHash) : memory.pinHashSeen };
  return {
    hydrated: { profiles: true, account: true, guest: true },
    pinHashReadFailed: false,
    memory: full,
    stored: { ok: true, profiles: full.profiles, pinHash: full.parentPinHash, guest: null },
    ...over,
  };
}

describe('pin: a PIN hash is stored, on any device', () => {
  it('a family device with a PIN, with the epoch from account:pinSetAt', () => {
    expect(nativeGateStateOf(input())).toEqual({ state: 'pin', epoch: 1_700_000_000_000 });
  });

  it('a self-only device with a PIN is `pin` too (the marker would say `none`)', () => {
    expect(nativeGateStateOf(input({ profiles: [SELF] }))).toEqual({ state: 'pin', epoch: 1_700_000_000_000 });
  });

  it('a device with no learner profile but a PIN is `pin`', () => {
    expect(nativeGateStateOf(input({ profiles: [] }))).toEqual({ state: 'pin', epoch: 1_700_000_000_000 });
  });

  it('a PIN set before F-APP-001 A-6 has epoch 0', () => {
    expect(nativeGateStateOf(input({ pinSetAt: null }))).toEqual({ state: 'pin', epoch: 0 });
  });
});

describe('nopin and open: no PIN', () => {
  it('a child learner and no PIN is `nopin`', () => {
    expect(nativeGateStateOf(input({ parentPinHash: null }))).toEqual({ state: 'nopin' });
  });

  it('no learner profile, or self-only learners, with the stored list agreeing, is `open`', () => {
    expect(nativeGateStateOf(input({ parentPinHash: null, profiles: [] }))).toEqual({ state: 'open' });
    expect(nativeGateStateOf(input({ parentPinHash: null, profiles: [SELF] }))).toEqual({ state: 'open' });
    expect(nativeGateStateOf(input({ parentPinHash: null, profiles: [PARENT] }))).toEqual({ state: 'open' });
  });

  it('a live guest counts as a child learner (GU-D14): `nopin`, in memory or as stored', () => {
    expect(nativeGateStateOf(input({ parentPinHash: null, profiles: [], guest: GUEST }))).toEqual({ state: 'nopin' });
    const stored = input({ parentPinHash: null, profiles: [] });
    expect(nativeGateStateOf({ ...stored, stored: { ok: true, profiles: [], pinHash: null, guest: GUEST } })).toEqual({ state: 'nopin' });
  });

  it('a stored guest record that does not parse may hold a live guest: `nopin`', () => {
    const base = input({ parentPinHash: null, profiles: [] });
    expect(nativeGateStateOf({ ...base, stored: { ok: true, profiles: [], pinHash: null, guest: { v: 9 } } })).toEqual({ state: 'nopin' });
  });

  it('a stored list holding a child the memory lacks (a boot read that looked empty) is `nopin`, never `open`', () => {
    const base = input({ parentPinHash: null, profiles: [] });
    expect(nativeGateStateOf({ ...base, stored: { ok: true, profiles: [{ id: 'p:x' }], pinHash: null, guest: null } })).toEqual({ state: 'nopin' });
    expect(nativeGateStateOf({ ...base, stored: { ok: true, profiles: ['damaged entry'], pinHash: null, guest: null } })).toEqual({ state: 'nopin' });
  });
});

describe('unknown: every doubt (CS-N14)', () => {
  it('a store that has not hydrated', () => {
    for (const key of ['profiles', 'account', 'guest'] as const) {
      const hydrated = { profiles: true, account: true, guest: true, [key]: false };
      expect(nativeGateStateOf(input({}, { hydrated })), key).toEqual({ state: 'unknown' });
    }
  });

  it('the PIN hash could not be read at hydrate', () => {
    expect(nativeGateStateOf(input({}, { pinHashReadFailed: true }))).toEqual({ state: 'unknown' });
  });

  it('the epoch is not reconciled with the hash yet (no fingerprint seen, an unread one, another PIN)', () => {
    expect(nativeGateStateOf(input({ pinHashSeen: null }))).toEqual({ state: 'unknown' });
    expect(nativeGateStateOf(input({ pinHashSeen: PIN_HASH_UNREAD }))).toEqual({ state: 'unknown' });
    expect(nativeGateStateOf(input({ pinHashSeen: pinHashFingerprint('another') }))).toEqual({ state: 'unknown' });
    expect(nativeGateStateOf(input({ parentPinHash: null, pinHashSeen: pinHashFingerprint(HASH) }))).toEqual({ state: 'unknown' });
    expect(nativeGateStateOf(input({ parentPinHash: null, pinHashSeen: NO_PIN_SEEN, profiles: [] }))).toEqual({ state: 'open' });
  });

  it('an exact read that failed or a value that does not parse', () => {
    expect(nativeGateStateOf(input({}, { stored: { ok: false } }))).toEqual({ state: 'unknown' });
    expect(nativeGateStateOf(input({}, { stored: { ok: true, profiles: { not: 'a list' }, pinHash: HASH, guest: null } }))).toEqual({ state: 'unknown' });
    expect(nativeGateStateOf(input({}, { stored: { ok: true, profiles: [CHILD], pinHash: 42, guest: null } }))).toEqual({ state: 'unknown' });
  });

  it('memory and storage disagree about the PIN (a write on its way, another tab)', () => {
    expect(nativeGateStateOf(input({}, { stored: { ok: true, profiles: [CHILD], pinHash: null, guest: null } }))).toEqual({ state: 'unknown' });
    expect(nativeGateStateOf(input({}, { stored: { ok: true, profiles: [CHILD], pinHash: 'other', guest: null } }))).toEqual({ state: 'unknown' });
    const noPin = input({ parentPinHash: null, profiles: [] });
    expect(nativeGateStateOf({ ...noPin, stored: { ok: true, profiles: [], pinHash: HASH, guest: null } })).toEqual({ state: 'unknown' });
  });

  it('a profile-read failure at boot (the app looks empty, Welcome shows) opens nothing', () => {
    // The boot read failed: memory holds no profile and the PIN hash read failed too.
    const boot = input({ profiles: [], parentPinHash: null }, { pinHashReadFailed: true });
    expect(nativeGateStateOf(boot)).toEqual({ state: 'unknown' });
    // Or only the profile list failed: the exact read throws again.
    expect(nativeGateStateOf(input({ profiles: [], parentPinHash: null }, { stored: { ok: false } }))).toEqual({ state: 'unknown' });
  });
});
