import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MissionPlan } from '../../logic/homework/mission-builder';
import { clearMissionPins, markVocabRoundDone, pinMission, pinnedMission, vocabRoundsDone } from '../mission-pin-store';

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

/**
 * Source guard for the wiring (the mobile vitest lane does not render screens): Home must read and
 * write this store, never a pin of its own, or Results' Back home drops the pin again (PR 4.8c).
 */
describe('HomeScreen pins the plan in the session store (F-STORY-004 PR 4.8c)', () => {
  const home = readFileSync(join(__dirname, '..', '..', 'screens', 'home', 'HomeScreen.tsx'), 'utf8');

  it('reads the pin for the active profile and day', () => {
    expect(home).toMatch(/pinned:\s*pinnedMission\(profile\.id,\s*today\)/);
  });

  it('pins the merged plan it builds', () => {
    expect(home).toMatch(/pinMission\(merged\)/);
  });

  it('keeps no pin of its own', () => {
    expect(home).not.toMatch(/useRef<\s*MissionPlan/);
    expect(home).not.toMatch(/pinned:\s*null/);
    expect(home).not.toMatch(/pinnedPlan/);
  });
});

describe('Speed Rounds done today, for the Home vocabulary card (F-VOC-005 section 3.7, PR P-3)', () => {
  beforeEach(() => clearMissionPins());

  it('lists the topics whose round completed for that profile and day', () => {
    expect([...vocabRoundsDone('p1', '2026-10-12')]).toEqual([]);
    markVocabRoundDone('p1', '2026-10-12', 'food');
    markVocabRoundDone('p1', '2026-10-12', 'animals');
    markVocabRoundDone('p1', '2026-10-12', 'food');
    expect([...vocabRoundsDone('p1', '2026-10-12')].sort()).toEqual(['animals', 'food']);
  });

  it('never carries over to another profile or another day', () => {
    markVocabRoundDone('p1', '2026-10-12', 'food');
    expect(vocabRoundsDone('p2', '2026-10-12').size).toBe(0);
    expect(vocabRoundsDone('p1', '2026-10-13').size).toBe(0);
    markVocabRoundDone('p1', '2026-10-13', 'colors');
    expect([...vocabRoundsDone('p1', '2026-10-13')]).toEqual(['colors']);
    expect(vocabRoundsDone('p1', '2026-10-12').size).toBe(0);
  });

  it('is cleared with the pins', () => {
    markVocabRoundDone('p1', '2026-10-12', 'food');
    clearMissionPins();
    expect(vocabRoundsDone('p1', '2026-10-12').size).toBe(0);
  });
});
