import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  writeJson: vi.fn(),
}));

vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async () => true),
}));

import { nextStreak, useProgressStore } from '../progress-store';

describe('progress-store', () => {
  beforeEach(() => {
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set() });
  });

  it('recordQuestComplete adds a quest record', () => {
    useProgressStore.getState().recordQuestComplete('p1', {
      questId: 'q1',
      episodeId: 'e1',
      stars: 3,
      accuracy: 1,
      attempts: 0,
    });
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.quests).toHaveLength(1);
    expect(snap?.quests[0]?.questId).toBe('q1');
    expect(snap?.quests[0]?.stars).toBe(3);
    expect(snap?.quests[0]?.completedAt).toBeTruthy();
  });

  it('recordQuestComplete replaces the record for the same quest', () => {
    const { recordQuestComplete } = useProgressStore.getState();
    recordQuestComplete('p1', { questId: 'q1', episodeId: 'e1', stars: 1, accuracy: 0.5, attempts: 2 });
    recordQuestComplete('p1', { questId: 'q1', episodeId: 'e1', stars: 3, accuracy: 1, attempts: 0 });
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.quests).toHaveLength(1);
    expect(snap?.quests[0]?.stars).toBe(3);
  });

  it('unlockCard adds a card and is idempotent', () => {
    const { unlockCard } = useProgressStore.getState();
    unlockCard('p1', 'card:book');
    unlockCard('p1', 'card:book');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.cards).toHaveLength(1);
    expect(snap?.cards[0]?.cardId).toBe('card:book');
    expect(snap?.cards[0]?.newSinceLastView).toBe(true);
  });

  it('beginSession then endSession records a non-negative duration', () => {
    const { beginSession, endSession } = useProgressStore.getState();
    beginSession('p1');
    endSession('p1');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.sessions).toHaveLength(1);
    expect(snap?.sessions[0]?.endedAt).toBeTruthy();
    expect(snap?.sessions[0]?.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it('endSession with no open session is a no-op', () => {
    useProgressStore.getState().endSession('p1');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap).toBeUndefined();
  });

  it('reset clears a profile snapshot', () => {
    const { recordQuestComplete, unlockCard, reset } = useProgressStore.getState();
    recordQuestComplete('p1', { questId: 'q1', episodeId: 'e1', stars: 2, accuracy: 0.8, attempts: 1 });
    unlockCard('p1', 'card:book');
    reset('p1');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.quests).toHaveLength(0);
    expect(snap?.cards).toHaveLength(0);
  });

  it('beginSession starts the streak at 1 on first call', () => {
    useProgressStore.getState().beginSession('p1');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.streakDays).toBe(1);
  });

  it('beginSession twice in the same day keeps the streak at 1', () => {
    const { beginSession, endSession } = useProgressStore.getState();
    beginSession('p1');
    endSession('p1');
    beginSession('p1');
    const snap = useProgressStore.getState().byProfile['p1'];
    expect(snap?.streakDays).toBe(1);
  });
});

describe('nextStreak', () => {
  it('seeds the streak at 1 when there is no prior session', () => {
    expect(nextStreak(0, undefined, '2026-05-28')).toBe(1);
  });

  it('keeps the streak (≥ 1) when the same day repeats', () => {
    expect(nextStreak(7, '2026-05-28', '2026-05-28')).toBe(7);
    expect(nextStreak(0, '2026-05-28', '2026-05-28')).toBe(1);
  });

  it('increments the streak by 1 when the next day is reached', () => {
    expect(nextStreak(7, '2026-05-27', '2026-05-28')).toBe(8);
  });

  it('resets to 1 when more than one day has passed', () => {
    expect(nextStreak(7, '2026-05-25', '2026-05-28')).toBe(1);
  });

  it('handles month rollovers correctly', () => {
    expect(nextStreak(3, '2026-04-30', '2026-05-01')).toBe(4);
  });
});
