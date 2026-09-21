import { describe, expect, it } from 'vitest';
import { CheckoutCreateSchema, EntitlementApplySchema, EntitlementSchema, ReceiptVerifySchema, SyncInboxSchema, TIER_GRACE_MS } from '../index';

describe('entitlement schemas (F-ENT-001 §3.1)', () => {
  const row = { id: 'ent:abc', subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_premium', status: 'active', provider: 'stripe', providerRef: 'sub_1', customerRef: 'cus_1', seats: null, expiresAt: null, updatedAt: 't' };

  it('validates rows, apply inputs, checkout and receipt bodies', () => {
    expect(EntitlementSchema.parse(row).planKey).toBe('family_premium');
    expect(EntitlementSchema.safeParse({ ...row, status: 'paused' }).success).toBe(false);
    expect(EntitlementSchema.safeParse({ ...row, seats: 0 }).success).toBe(false);
    expect(EntitlementApplySchema.parse({ subjectKind: 'account', subjectId: 'teacher', planKey: 'teacher_pro', status: 'trial', provider: 'stripe' })).toMatchObject({ status: 'trial' });
    expect(CheckoutCreateSchema.parse({ planKey: 'teacher_pro', subjectKind: 'account', subjectId: 'teacher' }).interval).toBe('monthly');
    expect(CheckoutCreateSchema.safeParse({ planKey: 'school_seat', subjectKind: 'space', subjectId: 'space:s' }).success).toBe(false);
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
  });
});
