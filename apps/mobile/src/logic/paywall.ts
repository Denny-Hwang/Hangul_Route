import { FAMILY_LIFETIME_LEARNERS, PLAN_PRICING, type Tier, type TierSource } from '@hangul-route/content-schema';

/**
 * Paywall state — F-ENT-001 §3.5 (wireframe paywall/upgrade). Stage 1 is
 * always free; the screen only decides which of three calm states to show.
 */
export type PaywallState = 'covered' | 'premium' | 'free';

export function paywallState(tier: Tier, source: TierSource | null): PaywallState {
  if (tier !== 'premium') return 'free';
  return source && source.kind !== 'family' ? 'covered' : 'premium';
}

/** What the family plan adds (decision #30: one payment, every Stage, one family). */
export const PREMIUM_BULLETS: readonly string[] = ['Every Stage, now and later', 'Cloud save on every device', 'Grown-up dashboard and plans', `Up to ${FAMILY_LIFETIME_LEARNERS} learners in your family`];

/** The single offer the child-side paywall shows; checkout itself lives on the web console. */
export const LIFETIME_OFFER = {
  key: 'family_lifetime',
  label: 'Family Lifetime',
  price: PLAN_PRICING.family_lifetime.label,
  line: 'One payment. No subscription, nothing to cancel.',
} as const;

/** Codes are typed on the console, never in the child app (F-ENT-002 §3.4). */
export const PROMO_HINT = 'Have a promo or referral code? A grown-up enters it on the web console.';

const DEFAULT_CONSOLE = 'https://hangulroute.com';

/** Where a grown-up buys on the web (checkout lives in the console, never in the child app). */
export function consoleBillingUrl(env: { EXPO_PUBLIC_CONSOLE_URL?: string } = process.env as { EXPO_PUBLIC_CONSOLE_URL?: string }): string {
  const base = (env.EXPO_PUBLIC_CONSOLE_URL?.trim() || DEFAULT_CONSOLE).replace(/\/$/, '');
  return `${base}/teach/billing`;
}
