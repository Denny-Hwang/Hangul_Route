/**
 * Subscription entitlement (F-SUB-001). Pure business logic mapping a family's
 * subscription to a content access tier. Stage 1 is always free; the rest of
 * the journey is premium.
 */

export interface SubscriptionState {
  status: 'none' | 'trial' | 'active' | 'expired' | 'cancelled';
  plan: 'monthly' | 'yearly' | null;
  expiresAt: string | null;
}

export type Tier = 'free' | 'premium';

/** Stages that never require a subscription. */
const FREE_STAGES: ReadonlySet<string> = new Set(['stage1']);

export function entitlementTier(subscription: SubscriptionState | null, now: Date): Tier {
  if (!subscription) return 'free';
  if (subscription.status !== 'active' && subscription.status !== 'trial') return 'free';
  if (subscription.expiresAt && new Date(subscription.expiresAt).getTime() <= now.getTime()) {
    return 'free';
  }
  return 'premium';
}

export function isStageEntitled(stageKey: string, tier: Tier): boolean {
  return tier === 'premium' || FREE_STAGES.has(stageKey);
}
