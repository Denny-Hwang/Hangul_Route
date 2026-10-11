import { LEARNER_LEVELS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { effectiveReadToMe, readToMeDefault } from '../reader-settings';

describe('readToMeDefault (F-STORY-002 §3.2, D1)', () => {
  it('is on only for "Pictures first" (levelOrder 0), read through the order, never the raw id', () => {
    const byOrder = LEARNER_LEVELS.map((l) => [l.id, l.order, readToMeDefault(l.id)] as const);
    expect(byOrder.length).toBeGreaterThanOrEqual(3);
    for (const [id, order, on] of byOrder) expect(on, id).toBe(order === 0);
    expect(byOrder.some(([, , on]) => on)).toBe(true);
    expect(byOrder.some(([, , on]) => !on)).toBe(true);
  });

  it('is off for an id this build does not know', () => {
    expect(readToMeDefault('99-100')).toBe(false);
    expect(readToMeDefault('')).toBe(false);
  });
});

describe('effectiveReadToMe', () => {
  const pictures = LEARNER_LEVELS.find((l) => l.order === 0)!.id;
  const reads = LEARNER_LEVELS.find((l) => l.order === 2)!.id;

  it('an explicit setting wins over the level default, either way', () => {
    expect(effectiveReadToMe(false, pictures)).toBe(false);
    expect(effectiveReadToMe(true, reads)).toBe(true);
  });

  it('absent falls back to the level default', () => {
    expect(effectiveReadToMe(undefined, pictures)).toBe(true);
    expect(effectiveReadToMe(undefined, reads)).toBe(false);
  });
});
