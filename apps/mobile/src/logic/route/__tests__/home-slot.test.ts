import { describe, expect, it } from 'vitest';
import { movedLineVisible, planSlotOf } from '../home-slot';

describe("Home's weekly plan slot (F-PLAN-002 sections 3.7 and 3.9)", () => {
  it('"Hoya moved your plan along" shows once: after an automatic re-pace, until it is seen', () => {
    expect(movedLineVisible({})).toBe(false);
    expect(movedLineVisible({ movedAt: '2026-10-12T08:00:00.000Z' })).toBe(true);
    expect(movedLineVisible({ movedAt: '2026-10-12T08:00:00.000Z', movedSeenAt: '2026-10-12T07:00:00.000Z' })).toBe(true);
    expect(movedLineVisible({ movedAt: '2026-10-12T08:00:00.000Z', movedSeenAt: '2026-10-12T08:00:00.000Z' })).toBe(false);
    expect(movedLineVisible({ movedAt: '2026-10-12T08:00:00.000Z', movedSeenAt: '2026-10-13T08:00:00.000Z' })).toBe(false);
  });

  it('one card at most: the prompt before a plan, then the check-in, then the moved line', () => {
    const offer = { kind: 'lighter' as const, pace: 'gentle' as const };
    expect(planSlotOf({ prompt: true, offer: null, moved: false })).toEqual({ kind: 'prompt' });
    expect(planSlotOf({ prompt: false, offer, moved: true })).toEqual({ kind: 'check-in', offer });
    expect(planSlotOf({ prompt: false, offer: null, moved: true })).toEqual({ kind: 'moved' });
    expect(planSlotOf({ prompt: false, offer: null, moved: false })).toBeNull();
  });
});
