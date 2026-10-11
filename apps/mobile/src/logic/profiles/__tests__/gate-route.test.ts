import { describe, expect, it } from 'vitest';
import { gateOpensDirectly } from '../gate-route';

const child = { role: 'learner' as const, learnerType: 'child' as const };
const self = { role: 'learner' as const, learnerType: 'self' as const };
const legacy = { role: 'learner' as const };

describe('gateOpensDirectly: a grown-up action skips the PIN screen only when no PIN can be required (F-LEARN-001 L7)', () => {
  it('a self-only device without a PIN opens directly (no forced PIN setup from Profile)', () => {
    expect(gateOpensDirectly({ profiles: [self], parentPinHash: null, sessionOpen: false })).toBe(true);
    expect(gateOpensDirectly({ profiles: [self, self], parentPinHash: null, sessionOpen: false })).toBe(true);
  });

  it('a self-only device that set a PIN is gated', () => {
    expect(gateOpensDirectly({ profiles: [self], parentPinHash: 'hash', sessionOpen: false })).toBe(false);
  });

  it('a family device is gated, with or without a PIN yet (legacy first gate creates it)', () => {
    expect(gateOpensDirectly({ profiles: [child], parentPinHash: null, sessionOpen: false })).toBe(false);
    expect(gateOpensDirectly({ profiles: [legacy], parentPinHash: null, sessionOpen: false })).toBe(false);
    expect(gateOpensDirectly({ profiles: [self, child], parentPinHash: 'hash', sessionOpen: false })).toBe(false);
    expect(gateOpensDirectly({ profiles: [], parentPinHash: null, sessionOpen: false })).toBe(false);
  });

  it('an open grown-up session always opens directly', () => {
    expect(gateOpensDirectly({ profiles: [child], parentPinHash: 'hash', sessionOpen: true })).toBe(true);
  });
});
