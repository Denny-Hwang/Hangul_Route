/**
 * Subscription entitlement (F-SUB-001). Pure business logic mapping a family's
 * subscription to a content access tier. Stage 1 is always free; the rest of
 * the journey is premium.
 */

import { isFreeContent } from './content-access';

export interface SubscriptionState {
  status: 'none' | 'trial' | 'active' | 'expired' | 'cancelled';
  plan: 'monthly' | 'yearly' | null;
  expiresAt: string | null;
}

export type Tier = 'free' | 'premium';

export function entitlementTier(subscription: SubscriptionState | null, now: Date): Tier {
  if (!subscription) return 'free';
  // Ended outright — no access.
  if (subscription.status === 'none' || subscription.status === 'expired') return 'free';
  // Cancelled means auto-renew is off; access lasts until the paid period ends.
  if (subscription.status === 'cancelled' && !subscription.expiresAt) return 'free';
  // active / trial / cancelled: valid only while not past expiry.
  if (subscription.expiresAt && new Date(subscription.expiresAt).getTime() <= now.getTime()) {
    return 'free';
  }
  return 'premium';
}

/**
 * Coarse: the stage-level answer (placement start, card earn hints, the stages
 * a plan reads). Whether a quest may start is decided by `isQuestOpen`
 * (`logic/content-access.ts`, F-ENT-003 section 3.3).
 */
export function isStageEntitled(stageKey: string, tier: Tier): boolean {
  return tier === 'premium' || isFreeContent('stage', stageKey);
}

/**
 * The one route predicate (F-ROUTE-001 OD-4 default): every shipped stage is
 * playable, which is the rule Journey cells and Home already follow. My route
 * and `summary.journey` (`content/sync-context.ts` `journeyContent`) bind this
 * function, never a rule of their own, so R-4a changes every surface at once.
 */
export const isStagePlayable: (stageKey: string) => boolean = () => true;
