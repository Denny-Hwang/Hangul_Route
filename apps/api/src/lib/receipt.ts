import type { Subscription } from '../store';

export interface VerificationResult {
  valid: boolean;
  plan: Subscription['plan'];
  store: Subscription['store'];
  expiresAt: string | null;
}

const INVALID: VerificationResult = { valid: false, plan: null, store: null, expiresAt: null };

/**
 * DEV STUB. Treats the receipt as a JSON blob describing the purchase:
 *   { "plan": "monthly" | "yearly", "expiresAt": "<ISO>" }
 *
 * Production MUST replace this with real App Store Server API / Google Play
 * Developer API verification, gated behind store credentials (F-IAP-002).
 * Never ship this stub as the real verification path.
 */
export function verifyReceiptStub(store: 'apple' | 'google', receipt: string): VerificationResult {
  try {
    const parsed = JSON.parse(receipt) as { plan?: unknown; expiresAt?: unknown };
    const plan = parsed.plan === 'monthly' || parsed.plan === 'yearly' ? parsed.plan : null;
    const expiresAt = typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null;
    if (!plan || !expiresAt) return INVALID;
    return { valid: true, plan, store, expiresAt };
  } catch {
    return INVALID;
  }
}

/**
 * Pure: derive subscription status from a verification result + current time.
 * Active only when the receipt is valid and its expiry is still in the future.
 */
export function statusFromVerification(result: VerificationResult, now: Date): Subscription['status'] {
  if (!result.valid || !result.expiresAt) return 'expired';
  return new Date(result.expiresAt).getTime() > now.getTime() ? 'active' : 'expired';
}
