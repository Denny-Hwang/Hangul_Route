import { FAMILY_LIFETIME_LEARNERS, PLAN_PRICING } from '@hangul-route/content-schema';
import { LOCALES, formatUsd, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { consoleBillingUrl, familyOffer, paywallState, premiumBullets } from '../paywall';

const m = getMessages('en').caregiver.paywall;

describe('paywall state (F-ENT-001 §3.5)', () => {
  it('picks covered / premium / free from the tier and its source', () => {
    expect(paywallState('free', null)).toBe('free');
    expect(paywallState('premium', null)).toBe('premium');
    expect(paywallState('premium', { kind: 'family', spaceId: 'space:f', name: 'Kim family' })).toBe('premium');
    expect(paywallState('premium', { kind: 'class', spaceId: 'space:c', name: 'Sunday Class A' })).toBe('covered');
    expect(paywallState('premium', { kind: 'school', spaceId: 'space:s', name: 'School' })).toBe('covered');
  });

  it('shows the one Family Plan offer, renewing yearly, and points buyers at the console', () => {
    expect(familyOffer('en', m)).toEqual({ key: 'family_lifetime', label: 'Family Plan', price: '$15.30 / year', line: 'Renews every year. Cancel any time.' });
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
    expect(per).toBe('year');
    for (const locale of LOCALES) {
      const offer = familyOffer(locale, getMessages(locale).caregiver.paywall);
      expect(offer.price, locale).toContain(formatUsd(locale, amountUsd));
    }
  });

  it('follows the plan table: a yearly plan reads "/ year", a one-time amount reads "once"', () => {
    expect(familyOffer('en', m, { amountUsd: 153, per: 'year' }).price).toBe('$153 / year');
    expect(familyOffer('en', m, { amountUsd: 10, per: 'once' }).price).toBe('$10 once');
  });

  it('keeps the learner count in the bullet', () => {
    expect(premiumBullets(m, 1)).toContain('Up to 1 learner in your family');
    expect(premiumBullets(m)).toContain(`Up to ${FAMILY_LIFETIME_LEARNERS} learners in your family`);
  });
});
