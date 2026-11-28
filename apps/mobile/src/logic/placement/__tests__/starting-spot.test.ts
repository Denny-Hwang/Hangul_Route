import { describe, expect, it } from 'vitest';
import { startingSpotRow } from '../starting-spot';
import { placementResult } from './fixtures';

describe('startingSpotRow (the dashboard row)', () => {
  it('is null without a result', () => {
    expect(startingSpotRow([])).toBeNull();
    expect(startingSpotRow(undefined)).toBeNull();
  });

  it('shows the highest level reached, the date of the newest check and whether a grown-up changed the start', () => {
    const older = placementResult({ id: 'placement:old', completedAt: '2026-10-01T10:00:00.000Z', level: { stage: 'stage1', band: 2 } });
    const newer = placementResult({ id: 'placement:new', completedAt: '2026-10-05T10:00:00.000Z', level: { stage: 'stage1', band: 1 } });
    expect(startingSpotRow([newer, older])).toEqual({ level: { stage: 'stage1', band: 2 }, takenAt: newer.completedAt, overridden: false });
    const changed = { ...older, override: { by: 'parent' as const, at: '2026-10-06T00:00:00.000Z', startQuestId: 'quest:q1' } };
    expect(startingSpotRow([changed, newer])?.overridden).toBe(true);
  });

  it('a later, higher check raises the row; two checks finished at the same instant keep their order', () => {
    const first = placementResult({ id: 'placement:first', level: { stage: 'stage1', band: 1 } });
    const second = placementResult({ id: 'placement:second', level: { stage: 'stage2', band: 0 } });
    expect(startingSpotRow([first, second])?.level).toEqual({ stage: 'stage2', band: 0 });
    expect(startingSpotRow([second, first])?.level).toEqual({ stage: 'stage2', band: 0 });
  });
});
