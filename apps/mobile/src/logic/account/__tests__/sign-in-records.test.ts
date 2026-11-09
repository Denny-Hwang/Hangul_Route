import { AccountTrustSchema, DeviceUsesSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import type { NativeGateState } from '../gate-state';
import {
  DEVICE_USES_RECORD_KEY,
  RETRUST_NOTICE_KEY,
  TRUST_RECORD_KEY,
  afterSignInPlan,
  deviceUsesRecord,
  keepsRecords,
  nativeHomeFor,
  proofRetrusts,
  recordsToDelete,
  retrustRequiredOf,
  retrustPendingFor,
  trustOfRead,
  trustReadOf,
  trustRecord,
  usesOfSpaces,
  type TrustRead,
} from '../sign-in-records';
import type { SignInProof } from '../sign-in-step';

/**
 * F-AUTH-004 sections 6.5, 6.6, 7.3 and 13.1 (row NS-3; ND-9, CS-N3, R-1): what a completed sign-in writes, the
 * re-trust rule, and what Sign out deletes.
 */

const PIN: NativeGateState = { state: 'pin', epoch: 7 };
const NONE: TrustRead = { kind: 'none' };
const SAME: TrustRead = { kind: 'trust', trust: { v: 1, epoch: 7 } };
const OTHER: TrustRead = { kind: 'trust', trust: { v: 1, epoch: 3 } };
const DAMAGED: TrustRead = { kind: 'damaged' };

const code: SignInProof = { method: 'email_code', second: null, hasPassword: true };
const password: SignInProof = { method: 'password', second: null, hasPassword: true };

describe('the trust record as read', () => {
  it('none, a valid record, or damaged (a failed read, a value that does not parse, epoch 0)', () => {
    expect(trustReadOf(null, false)).toEqual(NONE);
    expect(trustReadOf(undefined, false)).toEqual(NONE);
    expect(trustReadOf({ v: 1, epoch: 7 }, false)).toEqual(SAME);
    expect(trustReadOf({ v: 1, epoch: 7, accountId: 'u_1' }, false)).toEqual(SAME);
    expect(trustReadOf({ v: 1, epoch: 0 }, false)).toEqual(DAMAGED);
    expect(trustReadOf('junk', false)).toEqual(DAMAGED);
    expect(trustReadOf({ v: 1, epoch: 7 }, true)).toEqual(DAMAGED);
  });

  it('only a valid record is trust for the lock (CS-N3)', () => {
    expect(trustOfRead(SAME)).toEqual({ v: 1, epoch: 7 });
    expect(trustOfRead(NONE)).toBeNull();
    expect(trustOfRead(DAMAGED)).toBeNull();
  });
});

describe('ND-9: records only on a pin device with a real epoch', () => {
  it.each([
    [{ state: 'pin', epoch: 7 }, true],
    [{ state: 'pin', epoch: 0 }, false],
    [{ state: 'open' }, false],
    [{ state: 'nopin' }, false],
    [{ state: 'unknown' }, false],
  ] as [NativeGateState, boolean][])('%j keeps records: %s', (gate, keeps) => {
    expect(keepsRecords(gate)).toBe(keeps);
    expect(afterSignInPlan(gate, NONE, false, password).writeTrust).toBe(keeps);
  });

  it('elsewhere nothing is written and no re-trust is pending', () => {
    for (const gate of [{ state: 'open' }, { state: 'pin', epoch: 0 }] as NativeGateState[]) {
      expect(afterSignInPlan(gate, OTHER, true, code)).toEqual({ writeTrust: false, retrustPending: false, retrustNotice: false });
      expect(retrustPendingFor(gate, OTHER, true)).toBe(false);
    }
  });
});

describe('section 7.3: the re-trust rule (R-1)', () => {
  it('a re-trust is pending with a trust of another epoch, a damaged one, or the 24-hour wait record', () => {
    expect(retrustPendingFor(PIN, NONE, false)).toBe(false);
    expect(retrustPendingFor(PIN, SAME, false)).toBe(false);
    expect(retrustPendingFor(PIN, OTHER, false)).toBe(true);
    expect(retrustPendingFor(PIN, DAMAGED, false)).toBe(true);
    expect(retrustPendingFor(PIN, NONE, true)).toBe(true);
  });

  it('the account’s copy of the 24-hour wait’s record: absent no; present, odd or unreadable yes (fail closed)', () => {
    expect(retrustRequiredOf(null, false)).toBe(false);
    expect(retrustRequiredOf(undefined, false)).toBe(false);
    expect(retrustRequiredOf({ v: 1, at: 5 }, false)).toBe(true);
    expect(retrustRequiredOf('junk', false)).toBe(true);
    expect(retrustRequiredOf(null, true)).toBe(true);
  });

  it('a first sign-in (no record) trusts with the email code alone', () => {
    expect(afterSignInPlan(PIN, NONE, false, code)).toEqual({ writeTrust: true, retrustPending: false, retrustNotice: false });
  });

  it('after a PIN change an email code alone signs in but leaves the lock; the password re-trusts and shows the notice', () => {
    expect(afterSignInPlan(PIN, OTHER, false, code)).toEqual({ writeTrust: false, retrustPending: true, retrustNotice: false });
    expect(afterSignInPlan(PIN, NONE, true, code)).toEqual({ writeTrust: false, retrustPending: true, retrustNotice: false });
    expect(afterSignInPlan(PIN, DAMAGED, false, code)).toEqual({ writeTrust: false, retrustPending: true, retrustNotice: false });
    expect(afterSignInPlan(PIN, OTHER, false, password)).toEqual({ writeTrust: true, retrustPending: false, retrustNotice: true });
  });

  it('a second factor re-trusts, unless it is an emailed code (the same inbox); the device check never does', () => {
    expect(proofRetrusts({ ...code, second: 'totp' })).toBe(true);
    expect(proofRetrusts({ ...code, second: 'phone_code' })).toBe(true);
    expect(proofRetrusts({ ...code, second: 'backup_code' })).toBe(true);
    expect(proofRetrusts({ ...code, second: 'email_code' })).toBe(false);
    expect(proofRetrusts(code)).toBe(false);
    expect(afterSignInPlan(PIN, OTHER, false, { ...code, second: 'totp' }).writeTrust).toBe(true);
  });

  it('an account with the email code only re-trusts with it (R-1)', () => {
    expect(proofRetrusts({ method: 'email_code', second: null, hasPassword: false })).toBe(true);
    expect(afterSignInPlan(PIN, OTHER, true, { method: 'email_code', second: null, hasPassword: false })).toEqual({ writeTrust: true, retrustPending: false, retrustNotice: true });
  });

  it('a password sign-in on the same epoch writes the trust with no notice', () => {
    expect(afterSignInPlan(PIN, SAME, false, password)).toEqual({ writeTrust: true, retrustPending: false, retrustNotice: false });
  });

  it('the trust record is the gate’s epoch, in the shared schema', () => {
    expect(AccountTrustSchema.parse(trustRecord(7))).toEqual({ v: 1, epoch: 7 });
  });
});

describe('the uses record (section 6.5): no names, no ids', () => {
  const answer = (spaces: unknown): unknown => ({ spaces });

  it('reads the uses from GET /api/spaces in the fixed order', () => {
    const data = answer([
      { space: { id: 's1', kind: 'school', name: 'Maple' }, role: 'admin' },
      { space: { id: 's2', kind: 'family', name: 'Kim' }, role: 'owner' },
      { space: { id: 's3', kind: 'class', name: '3B' }, role: 'teacher' },
    ]);
    expect(usesOfSpaces(data)).toEqual(['family', 'teacher', 'school']);
  });

  it('a student membership is no use; an unknown kind or role is skipped; no space is no use', () => {
    expect(usesOfSpaces(answer([{ space: { kind: 'class' }, role: 'student' }]))).toEqual([]);
    expect(usesOfSpaces(answer([{ space: { kind: 'guild' }, role: 'owner' }, { space: { kind: 'family' }, role: 'boss' }]))).toEqual([]);
    expect(usesOfSpaces(answer([]))).toEqual([]);
  });

  it('an answer of another shape is null (nothing is written)', () => {
    for (const bad of [null, 'x', {}, { spaces: 'x' }, answer([null]), answer([{ space: {}, role: 'owner' }]), answer([{ space: { kind: 'family' } }])]) {
      expect(usesOfSpaces(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('the record holds the uses and the time only, in the console’s schema', () => {
    const record = deviceUsesRecord(['school', 'family'], 1_700_000_000_000);
    expect(record).toEqual({ v: 1, uses: ['family', 'school'], at: 1_700_000_000_000 });
    expect(DeviceUsesSchema.parse(record)).toEqual(record);
  });

  it('section 6.5 step 5: Family, then Teacher, then School; no space opens Family', () => {
    expect(nativeHomeFor(['teacher', 'school'])).toBe('teacher');
    expect(nativeHomeFor(['school', 'family'])).toBe('family');
    expect(nativeHomeFor(['school'])).toBe('school');
    expect(nativeHomeFor([])).toBe('family');
  });
});

describe('section 6.6: what Sign out deletes', () => {
  it('Sign out deletes the uses record, the trust and the notice; the keys are device-level', () => {
    expect(recordsToDelete('user', PIN, OTHER)).toEqual([DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY, RETRUST_NOTICE_KEY]);
    expect([DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY, RETRUST_NOTICE_KEY]).toEqual(['grownup:deviceUses', 'grownup:trust', 'grownup:retrustNotice']);
  });

  it('Sign in again on the lock keeps a trust of another epoch, a damaged one, or any while the gate is unknown (CS-N3)', () => {
    expect(recordsToDelete('lock', PIN, OTHER)).toEqual([DEVICE_USES_RECORD_KEY, RETRUST_NOTICE_KEY]);
    expect(recordsToDelete('lock', PIN, DAMAGED)).toEqual([DEVICE_USES_RECORD_KEY, RETRUST_NOTICE_KEY]);
    expect(recordsToDelete('lock', { state: 'unknown' }, SAME)).toEqual([DEVICE_USES_RECORD_KEY, RETRUST_NOTICE_KEY]);
    expect(recordsToDelete('lock', PIN, NONE)).toEqual([DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY, RETRUST_NOTICE_KEY]);
    expect(recordsToDelete('lock', PIN, SAME)).toEqual([DEVICE_USES_RECORD_KEY, TRUST_RECORD_KEY, RETRUST_NOTICE_KEY]);
  });
});
