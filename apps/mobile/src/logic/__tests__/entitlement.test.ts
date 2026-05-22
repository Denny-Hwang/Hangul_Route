import { describe, expect, it } from 'vitest';
import { entitlementTier, isStageEntitled, type SubscriptionState } from '../entitlement';

const now = new Date('2026-05-22T00:00:00.000Z');
const future = '2026-12-31T00:00:00.000Z';
const past = '2026-01-01T00:00:00.000Z';

function sub(partial: Partial<SubscriptionState>): SubscriptionState {
  return { status: 'none', plan: null, expiresAt: null, ...partial };
}

describe('entitlementTier', () => {
  it('is free for a null subscription', () => {
    expect(entitlementTier(null, now)).toBe('free');
  });

  it('is premium for an active subscription with future expiry', () => {
    expect(entitlementTier(sub({ status: 'active', plan: 'yearly', expiresAt: future }), now)).toBe('premium');
  });

  it('is premium during a trial with future expiry', () => {
    expect(entitlementTier(sub({ status: 'trial', expiresAt: future }), now)).toBe('premium');
  });

  it('is free when an active subscription has already expired', () => {
    expect(entitlementTier(sub({ status: 'active', plan: 'monthly', expiresAt: past }), now)).toBe('free');
  });

  it('is premium for active with no expiry recorded', () => {
    expect(entitlementTier(sub({ status: 'active', plan: 'yearly', expiresAt: null }), now)).toBe('premium');
  });

  it('is free for none and expired', () => {
    expect(entitlementTier(sub({ status: 'none' }), now)).toBe('free');
    expect(entitlementTier(sub({ status: 'expired', expiresAt: past }), now)).toBe('free');
  });

  it('keeps a cancelled subscription valid until its paid period ends', () => {
    expect(entitlementTier(sub({ status: 'cancelled', expiresAt: future }), now)).toBe('premium');
    expect(entitlementTier(sub({ status: 'cancelled', expiresAt: past }), now)).toBe('free');
    expect(entitlementTier(sub({ status: 'cancelled', expiresAt: null }), now)).toBe('free');
  });
});

describe('isStageEntitled', () => {
  it('always allows stage 1, free or premium', () => {
    expect(isStageEntitled('stage1', 'free')).toBe(true);
    expect(isStageEntitled('stage1', 'premium')).toBe(true);
  });

  it('gates stages 2+ for free, opens them for premium', () => {
    expect(isStageEntitled('stage2', 'free')).toBe(false);
    expect(isStageEntitled('stage7', 'free')).toBe(false);
    expect(isStageEntitled('stage2', 'premium')).toBe(true);
    expect(isStageEntitled('stage7', 'premium')).toBe(true);
  });
});
