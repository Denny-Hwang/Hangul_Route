import type { Context } from 'hono';
import { fail } from '../envelope';
import { billingLiveAllowed, stripeMode, type StripeEnv } from './stripe';

/**
 * Live guard (F-BILL-002 section 4.9): with a live key bound (or any key without a
 * test prefix), money calls answer 503 `live_not_enabled` until the owner sets
 * `BILLING_LIVE_ALLOWED=true` (OD-12). Call it before any Stripe call. Shared by the
 * checkout, portal and promo routes (B-5) and the receipt link (B-4). The webhook is
 * never guarded, so nothing paid is lost.
 */
export function liveRefusal(c: Context, env: Pick<StripeEnv, 'STRIPE_SECRET_KEY' | 'BILLING_LIVE_ALLOWED'>): Response | null {
  if (stripeMode(env) !== 'live' || billingLiveAllowed(env)) return null;
  return fail(c, 'live_not_enabled', 'Live payments are not open on this deployment', 503);
}
