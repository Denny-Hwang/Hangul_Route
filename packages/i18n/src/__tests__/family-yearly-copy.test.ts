import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';

/**
 * The Family Plan renews yearly (owner decision 2026-10-11,
 * docs/specs/AMENDMENTS-BILLING-FAMILY-YEARLY.md BY-D9). No billing or paywall
 * string may still describe it as a one-time lifetime purchase.
 */
const LIFETIME_WORDS = /\blifetime\b|\bonce\b|\bone payment\b|\bpay once\b|\bfor good\b|\bforever\b|\bnothing to cancel\b|\bno renewal\b/i;

/** Formatters for `PlanPricing.per === 'once'`, a value no plan uses since 2026-10-11 (kept for type completeness). */
const UNUSED_ONCE_FORMATTERS = new Set(['console.price.once', 'caregiver.paywall.offer.price.once']);

type Tree = { readonly [key: string]: unknown };

/** Every string a message renders: plain strings, and functions called with sample arguments. */
function strings(node: unknown, path: string, out: Array<[string, string]>): void {
  if (typeof node === 'string') out.push([path, node]);
  else if (typeof node === 'function') out.push([path, String((node as (...a: unknown[]) => unknown)('X', 'Y', 'Z', true, 'W'))]);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node as Tree)) strings(v, `${path}.${k}`, out);
}

function billingStrings(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const c = en.console as Tree;
  strings(en.caregiver.paywall, 'caregiver.paywall', out);
  strings(en.caregiver.audience.shared.paywallBuyOnWeb, 'caregiver.audience.shared.paywallBuyOnWeb', out);
  strings(en.caregiver.audience.shared.paywallBuyLater, 'caregiver.audience.shared.paywallBuyLater', out);
  strings(en.a11y.familyOffer, 'a11y.familyOffer', out);
  for (const key of ['billing', 'entitlementStatus', 'price', 'promoPrice', 'familyLine', 'groupLine', 'contactLine', 'billingSuccess', 'billingCancelled']) strings(c[key], `console.${key}`, out);
  return out.filter(([path]) => !UNUSED_ONCE_FORMATTERS.has(path));
}

describe('Family Plan copy says it renews yearly (BY-D9)', () => {
  it('scans the billing and paywall strings', () => {
    expect(billingStrings().length).toBeGreaterThan(30);
  });

  it('no billing or paywall string calls it a one-time or lifetime purchase', () => {
    for (const [path, value] of billingStrings()) expect(value, path).not.toMatch(LIFETIME_WORDS);
  });

  it('names the plan and how it renews', () => {
    expect(en.console.billing.planTitle.family_lifetime).toBe('Family Plan');
    expect(en.caregiver.paywall.offer.name).toBe('Family Plan');
    expect(en.console.familyLine).toMatch(/renews yearly/i);
    expect(en.caregiver.paywall.offer.line).toMatch(/renews every year/i);
  });
});
