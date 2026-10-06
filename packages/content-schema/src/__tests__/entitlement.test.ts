import { describe, expect, it } from 'vitest';
import { CheckoutCreateSchema, EntitlementApplySchema, EntitlementSchema, FAMILY_LIFETIME_LEARNERS, MemberAddSchema, PLAN_PRICING, ReceiptVerifySchema, SCHOOL_LICENSE_STUDENTS, SCHOOL_LICENSE_TEACHERS, SyncInboxSchema, TIER_GRACE_MS } from '../index';

describe('entitlement schemas (F-ENT-001 §3.1)', () => {
  const row = { id: 'ent:abc', subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime', status: 'active', provider: 'stripe', providerRef: 'sub_1', customerRef: 'cus_1', seats: null, expiresAt: null, updatedAt: 't' };

  it('validates rows, apply inputs, checkout and receipt bodies', () => {
    expect(EntitlementSchema.parse(row).planKey).toBe('family_lifetime');
    expect(EntitlementSchema.safeParse({ ...row, status: 'paused' }).success).toBe(false);
    expect(EntitlementSchema.safeParse({ ...row, seats: 0 }).success).toBe(false);
    expect(EntitlementApplySchema.parse({ subjectKind: 'space', subjectId: 'space:cls', planKey: 'group_license', status: 'trial', provider: 'stripe' })).toMatchObject({ status: 'trial' });
    expect(EntitlementApplySchema.safeParse({ subjectKind: 'account', subjectId: 't', planKey: 'teacher_pro', status: 'active', provider: 'stripe' }).success).toBe(false);
    expect(CheckoutCreateSchema.parse({ planKey: 'group_license', subjectKind: 'space', subjectId: 'space:cls' })).toEqual({ planKey: 'group_license', subjectKind: 'space', subjectId: 'space:cls' });
    expect(CheckoutCreateSchema.safeParse({ planKey: 'family_lifetime', subjectKind: 'account', subjectId: 'me' }).success).toBe(false);
    expect(CheckoutCreateSchema.safeParse({ planKey: 'school_seat', subjectKind: 'space', subjectId: 'space:s' }).success).toBe(false);
    expect(PLAN_PRICING.family_lifetime).toEqual({ amountUsd: 15.3, per: 'once', label: '$15.30 once' });
    expect(PLAN_PRICING.group_license).toEqual({ amountUsd: 153, per: 'year', label: '$153 / year' });
    expect(FAMILY_LIFETIME_LEARNERS).toBe(5);
    expect(ReceiptVerifySchema.safeParse({ spaceId: 'nope', store: 'apple', receipt: 'x' }).success).toBe(false);
    expect(ReceiptVerifySchema.parse({ spaceId: 'space:fam', store: 'google', receipt: '{}' }).store).toBe('google');
  });

  it('inbox tier fields default to null for older servers', () => {
    const inbox = SyncInboxSchema.parse({ rev: 1, plans: [], memberships: [], tier: 'premium', serverTime: 't' });
    expect(inbox.tierSource).toBeNull();
    expect(inbox.tierValidUntil).toBeNull();
    const rich = SyncInboxSchema.parse({ rev: 1, plans: [], memberships: [], tier: 'premium', tierSource: { kind: 'class', spaceId: 'space:c', name: 'A' }, tierValidUntil: 'u', serverTime: 't' });
    expect(rich.tierSource?.name).toBe('A');
    expect(TIER_GRACE_MS).toBe(604_800_000);
    expect([SCHOOL_LICENSE_STUDENTS, SCHOOL_LICENSE_TEACHERS]).toEqual([300, 10]);
    expect(MemberAddSchema.parse({ accountId: 't2', role: 'teacher' }).role).toBe('teacher');
    expect(MemberAddSchema.safeParse({ accountId: 't2', role: 'admin' }).success).toBe(false);
  });
});
