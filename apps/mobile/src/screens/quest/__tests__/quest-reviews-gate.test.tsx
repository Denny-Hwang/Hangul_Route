import { beforeEach, describe, expect, it } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { currBuiltInPct } from '../../../config/flags';
import { useProfileStore } from '../../../store/profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../../../store/remote-config-store';
import { tryAgainWanted, warmupWanted } from '../quest-reviews';

/**
 * F-CURR-002 sections 4.5 and 12.2 (row CM-15): the warm-up and Try these again show only with their switch on
 * and `memoryRecord` on for a learner; off, the surface hides. Both ship at built-in pct 0: they ramp only after
 * the `memoryRecord` 2-week shadow, as `dailyReview` does (runbook K-4).
 */

const LEARNER = { id: 'profile:mina', displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const, createdAt: '2026-10-01T00:00:00.000Z', role: 'learner' as const };
const PARENT = { ...LEARNER, id: 'profile:mum', displayName: 'Mum', role: 'parent' as const };
const stage2 = episodesAll.find((e) => e.stage === 'stage2')!;
const stage1 = episodesAll.find((e) => e.stage === 'stage1')!;

function flags(on: Record<string, boolean>): void {
  useRemoteConfigStore.setState({
    hydrated: true,
    cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: Object.fromEntries(Object.entries(on).map(([flag, value]) => [flag, value ? { on: true, pct: 100 } : { on: false, pct: 100 }])) },
  });
}

beforeEach(() => {
  resetRemoteConfigForTests();
  useProfileStore.setState({ profiles: [LEARNER, PARENT], activeId: LEARNER.id, hydrated: true });
});

describe('the launch state', () => {
  it('questWarmup and missedPractice ship at built-in pct 0', () => {
    expect(currBuiltInPct('questWarmup')).toBe(0);
    expect(currBuiltInPct('missedPractice')).toBe(0);
  });

  it('a device that never fetched the config shows neither', () => {
    useRemoteConfigStore.setState({ hydrated: true, cache: null });
    expect(warmupWanted(LEARNER.id, stage2.id, 0)).toBe(false);
    expect(tryAgainWanted(LEARNER.id, 2)).toBe(false);
  });
});

describe('with the switches', () => {
  it('the warm-up: questWarmup and memoryRecord on, a learner, a Stage 2+ quest from its first step', () => {
    flags({ questWarmup: true, memoryRecord: true });
    expect(warmupWanted(LEARNER.id, stage2.id, 0)).toBe(true);
    expect(warmupWanted(LEARNER.id, stage1.id, 0)).toBe(false);
    expect(warmupWanted(LEARNER.id, stage2.id, 1)).toBe(false);
    expect(warmupWanted(PARENT.id, stage2.id, 0)).toBe(false);
    expect(warmupWanted(null, stage2.id, 0)).toBe(false);
    flags({ questWarmup: false, memoryRecord: true });
    expect(warmupWanted(LEARNER.id, stage2.id, 0)).toBe(false);
    // With answers not recorded the pool is not real: off as well.
    flags({ questWarmup: true, memoryRecord: false });
    expect(warmupWanted(LEARNER.id, stage2.id, 0)).toBe(false);
  });

  it('Try these again: missedPractice and memoryRecord on, a learner, and a miss', () => {
    flags({ missedPractice: true, memoryRecord: true });
    expect(tryAgainWanted(LEARNER.id, 1)).toBe(true);
    expect(tryAgainWanted(LEARNER.id, 0)).toBe(false);
    expect(tryAgainWanted(PARENT.id, 1)).toBe(false);
    flags({ missedPractice: false, memoryRecord: true });
    expect(tryAgainWanted(LEARNER.id, 1)).toBe(false);
    flags({ missedPractice: true, memoryRecord: false });
    expect(tryAgainWanted(LEARNER.id, 1)).toBe(false);
  });
});
