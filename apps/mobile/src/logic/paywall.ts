import {
  FAMILY_LIFETIME_LEARNERS,
  PLAN_PRICING,
  type PlanPricing,
  type Tier,
  type TierSource,
} from '@hangul-route/content-schema';
import { formatUsd, type Messages, type UiLocale } from '@hangul-route/i18n';

/**
 * Paywall state — F-ENT-001 §3.5 (wireframe paywall/upgrade). Stage 1 is
 * always free; the screen only decides which of three calm states to show.
 */
export type PaywallState = 'covered' | 'premium' | 'free';

export function paywallState(tier: Tier, source: TierSource | null): PaywallState {
  if (tier !== 'premium') return 'free';
  return source && source.kind !== 'family' ? 'covered' : 'premium';
}

type Paywall = Messages['caregiver']['paywall'];

/** What the family plan adds (decision #30: one payment, every Stage, one family). */
export function premiumBullets(m: Paywall, learners: number = FAMILY_LIFETIME_LEARNERS): readonly string[] {
  return [m.bullets.everyStage, m.bullets.cloudSave, m.bullets.dashboard, m.bullets.learners(learners)];
}

/**
 * The single offer the child-side paywall shows; checkout itself lives on the web console.
 * The amount is `PLAN_PRICING` run through `formatUsd` for the locale: no price is
 * written into a message (F-I18N-001 §3.1). Codes are typed on the console, never in
 * the child app (F-ENT-002 §3.4), so the promo hint is `audience.promoHint`.
 */
export function lifetimeOffer(
  locale: UiLocale,
  m: Paywall,
  pricing: Pick<PlanPricing, 'amountUsd' | 'per'> = PLAN_PRICING.family_lifetime,
): { key: 'family_lifetime'; label: string; price: string; line: string } {
  const amount = formatUsd(locale, pricing.amountUsd);
  return {
    key: 'family_lifetime',
    label: m.offer.name,
    price: pricing.per === 'once' ? m.offer.price.once(amount) : m.offer.price.year(amount),
    line: m.offer.line,
  };
}

const DEFAULT_CONSOLE = 'https://hangulroute.com';

/** Where a grown-up buys on the web (checkout lives in the console, never in the child app). */
// Expo inlines only literal `process.env.EXPO_PUBLIC_*` reads, so the default spells the key out.
export function consoleBillingUrl(env: { EXPO_PUBLIC_CONSOLE_URL?: string } = { EXPO_PUBLIC_CONSOLE_URL: process.env.EXPO_PUBLIC_CONSOLE_URL }): string {
  const base = (env.EXPO_PUBLIC_CONSOLE_URL?.trim() || DEFAULT_CONSOLE).replace(/\/$/, '');
  return `${base}/teach/billing`;
}
