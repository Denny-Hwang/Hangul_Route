import { beforeEach, describe, expect, it } from 'vitest';
import type { MissionPlan } from '../../logic/homework/mission-builder';
import { clearMissionPins, pinMission, pinnedMission } from '../mission-pin-store';

const plan = (profileId: string, date: string, questId = 'quest:a'): MissionPlan => ({
  profileId,
  date,
  cards: [{ slot: 2, kind: 'new', titleEn: 'A', subtitle: 'new', collected: false, questId, episodeId: 'ep:a' }],
});

describe('mission-pin-store (F-STORY-004 PR 4.8c)', () => {
  beforeEach(() => clearMissionPins());

  it('has no pin before Home pins a plan', () => {
    expect(pinnedMission('p1', '2026-10-12')).toBeNull();
  });

  it('returns the plan pinned for that profile and day, outliving the screen that pinned it', () => {
    const p = plan('p1', '2026-10-12');
    pinMission(p);
    expect(pinnedMission('p1', '2026-10-12')).toBe(p);
  });

  it('never hands one profile the pin of another', () => {
    pinMission(plan('p1', '2026-10-12'));
    expect(pinnedMission('p2', '2026-10-12')).toBeNull();
  });

  it('never hands a new day the pin of an earlier day', () => {
    pinMission(plan('p1', '2026-10-12'));
    expect(pinnedMission('p1', '2026-10-13')).toBeNull();
  });

  it('a later pin for the same profile and day replaces the earlier one', () => {
    pinMission(plan('p1', '2026-10-12', 'quest:a'));
    const later = plan('p1', '2026-10-12', 'quest:b');
    pinMission(later);
    expect(pinnedMission('p1', '2026-10-12')).toBe(later);
  });

  it("keeps one pin per profile: a new day's pin drops that profile's older day, not other profiles", () => {
    pinMission(plan('p1', '2026-10-12'));
    const other = plan('p2', '2026-10-12');
    pinMission(other);
    pinMission(plan('p1', '2026-10-13'));
    expect(pinnedMission('p1', '2026-10-12')).toBeNull();
    expect(pinnedMission('p2', '2026-10-12')).toBe(other);
  });
});
