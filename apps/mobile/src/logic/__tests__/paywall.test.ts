import { FAMILY_LIFETIME_LEARNERS, PLAN_PRICING } from '@hangul-route/content-schema';
import { LOCALES, formatUsd, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { consoleBillingUrl, lifetimeOffer, paywallState, premiumBullets } from '../paywall';

const m = getMessages('en').caregiver.paywall;

describe('paywall state (F-ENT-001 §3.5)', () => {
  it('picks covered / premium / free from the tier and its source', () => {
    expect(paywallState('free', null)).toBe('free');
    expect(paywallState('premium', null)).toBe('premium');
    expect(paywallState('premium', { kind: 'family', spaceId: 'space:f', name: 'Kim family' })).toBe('premium');
    expect(paywallState('premium', { kind: 'class', spaceId: 'space:c', name: 'Sunday Class A' })).toBe('covered');
    expect(paywallState('premium', { kind: 'school', spaceId: 'space:s', name: 'School' })).toBe('covered');
  });

  it('shows the one lifetime offer and points buyers at the console', () => {
    expect(lifetimeOffer('en', m)).toEqual({ key: 'family_lifetime', label: 'Family Lifetime', price: '$15.30 once', line: 'One payment. No subscription, nothing to cancel.' });
    const bullets = premiumBullets(m);
    expect(bullets.length).toBeGreaterThanOrEqual(3);
    expect(bullets).toContain('Up to 5 learners in your family');
    expect(consoleBillingUrl({})).toBe('https://hangulroute.com/teach/billing');
    expect(consoleBillingUrl({ EXPO_PUBLIC_CONSOLE_URL: 'https://staging.example/ ' })).toBe('https://staging.example/teach/billing');
    expect(consoleBillingUrl()).toMatch(/\/teach\/billing$/);
  });
});

describe('the offer price is built from PLAN_PRICING and formatUsd, never from a message (F-I18N-001 §3.1)', () => {
  it('shows the amount the plan table holds, formatted for the locale', () => {
    const { amountUsd, per } = PLAN_PRICING.family_lifetime;
    expect(per).toBe('once');
    for (const locale of LOCALES) {
      const offer = lifetimeOffer(locale, getMessages(locale).caregiver.paywall);
      expect(offer.price, locale).toContain(formatUsd(locale, amountUsd));
    }
  });

  it('follows the plan table: a yearly plan reads "/ year"', () => {
    expect(lifetimeOffer('en', m, { amountUsd: 153, per: 'year' }).price).toBe('$153 / year');
  });

  it('keeps the learner count in the bullet', () => {
    expect(premiumBullets(m, 1)).toContain('Up to 1 learner in your family');
    expect(premiumBullets(m)).toContain(`Up to ${FAMILY_LIFETIME_LEARNERS} learners in your family`);
  });
});
