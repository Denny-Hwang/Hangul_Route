import type { Tier, TierSource } from '@hangul-route/content-schema';

/**
 * Paywall state — F-ENT-001 §3.5 (wireframe paywall/upgrade). Stage 1 is
 * always free; the screen only decides which of three calm states to show.
 */
export type PaywallState = 'covered' | 'premium' | 'free';

export function paywallState(tier: Tier, source: TierSource | null): PaywallState {
  if (tier !== 'premium') return 'free';
  return source && source.kind !== 'family' ? 'covered' : 'premium';
}

/** What Premium adds — the same bullets for both plan lengths. */
export const PREMIUM_BULLETS: readonly string[] = ['Stages 2–7, the full journey', 'Cloud save on every device', 'Grown-up dashboard and plans', 'Up to 4 learners'];

export const PLAN_LENGTHS = [
  { key: 'monthly', label: 'Monthly', price: 'price coming soon' },
  { key: 'yearly', label: 'Yearly', price: 'price coming soon' },
] as const;
export type PlanLength = (typeof PLAN_LENGTHS)[number]['key'];

const DEFAULT_CONSOLE = 'https://hangulroute.com';

/** Where a grown-up buys on the web (checkout lives in the console, never in the child app). */
export function consoleBillingUrl(env: { EXPO_PUBLIC_CONSOLE_URL?: string } = process.env as { EXPO_PUBLIC_CONSOLE_URL?: string }): string {
  const base = (env.EXPO_PUBLIC_CONSOLE_URL?.trim() || DEFAULT_CONSOLE).replace(/\/$/, '');
  return `${base}/teach/billing`;
}
