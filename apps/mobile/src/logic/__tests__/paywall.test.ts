import { describe, expect, it } from 'vitest';
import { PLAN_LENGTHS, PREMIUM_BULLETS, consoleBillingUrl, paywallState } from '../paywall';

describe('paywall state (F-ENT-001 §3.5)', () => {
  it('picks covered / premium / free from the tier and its source', () => {
    expect(paywallState('free', null)).toBe('free');
    expect(paywallState('premium', null)).toBe('premium');
    expect(paywallState('premium', { kind: 'family', spaceId: 'space:f', name: 'Kim family' })).toBe('premium');
    expect(paywallState('premium', { kind: 'class', spaceId: 'space:c', name: 'Sunday Class A' })).toBe('covered');
    expect(paywallState('premium', { kind: 'school', spaceId: 'space:s', name: 'School' })).toBe('covered');
  });

  it('keeps prices as placeholders and points grown-ups at the console', () => {
    expect(PLAN_LENGTHS.map((p) => p.price)).toEqual(['price coming soon', 'price coming soon']);
    expect(PREMIUM_BULLETS.length).toBeGreaterThanOrEqual(3);
    expect(consoleBillingUrl({})).toBe('https://hangulroute.com/teach/billing');
    expect(consoleBillingUrl({ EXPO_PUBLIC_CONSOLE_URL: 'https://staging.example/ ' })).toBe('https://staging.example/teach/billing');
    expect(consoleBillingUrl()).toMatch(/\/teach\/billing$/);
  });
});
