import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  writeJson: vi.fn(),
}));

import { useProgressStore } from '../progress-store';

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
});
