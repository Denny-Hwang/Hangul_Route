import { describe, expect, it } from 'vitest';
import { LIFETIME_OFFER, PREMIUM_BULLETS, consoleBillingUrl, paywallState } from '../paywall';

describe('paywall state (F-ENT-001 §3.5)', () => {
  it('picks covered / premium / free from the tier and its source', () => {
    expect(paywallState('free', null)).toBe('free');
    expect(paywallState('premium', null)).toBe('premium');
    expect(paywallState('premium', { kind: 'family', spaceId: 'space:f', name: 'Kim family' })).toBe('premium');
    expect(paywallState('premium', { kind: 'class', spaceId: 'space:c', name: 'Sunday Class A' })).toBe('covered');
    expect(paywallState('premium', { kind: 'school', spaceId: 'space:s', name: 'School' })).toBe('covered');
  });

  it('shows the one lifetime offer and points grown-ups at the console', () => {
    expect(LIFETIME_OFFER).toEqual({ key: 'family_lifetime', label: 'Family Lifetime', price: '$15.30 once', line: 'One payment. No subscription, nothing to cancel.' });
    expect(PREMIUM_BULLETS.length).toBeGreaterThanOrEqual(3);
    expect(PREMIUM_BULLETS).toContain('Up to 5 learners in your family');
    expect(consoleBillingUrl({})).toBe('https://hangulroute.com/teach/billing');
    expect(consoleBillingUrl({ EXPO_PUBLIC_CONSOLE_URL: 'https://staging.example/ ' })).toBe('https://staging.example/teach/billing');
    expect(consoleBillingUrl()).toMatch(/\/teach\/billing$/);
  });
});
