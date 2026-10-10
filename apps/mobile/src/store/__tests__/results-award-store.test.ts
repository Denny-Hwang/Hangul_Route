import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async () => true),
}));

import { applyQuestResult } from '../../logic/results-award';
import { useProgressStore } from '../progress-store';

const owned = (): string[] =>
  (useProgressStore.getState().byProfile['p1']?.cards ?? []).map((c) => c.cardId);

function visit(stars: 0 | 1 | 2 | 3, correct: number, total: number, track = vi.fn()) {
  const s = useProgressStore.getState();
  const award = applyQuestResult(
    { profileId: 'p1', questId: 'q1', episodeId: 'e1', rewardCardId: 'card:book', stars, correct, total, retries: 0 },
    { ownedCardIds: owned, recordQuestComplete: s.recordQuestComplete, unlockCard: s.unlockCard, track },
  );
  return { award, track };
}

describe('Results award through the real progress store', () => {
  beforeEach(() => {
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set() });
  });

  it('first 2-star finish unlocks the card once; a replay announces nothing', () => {
    const first = visit(2, 3, 5);
    expect(first.award).toMatchObject({ isNew: true, isFirstCard: true });
    expect(owned()).toEqual(['card:book']);

    const replay = visit(3, 5, 5);
    expect(replay.award).toMatchObject({ isNew: false });
    expect(owned()).toEqual(['card:book']);
    expect(replay.track.mock.calls.map((c) => c[0].name)).toEqual(['quest.complete']);
  });

  it('a 1-star finish records the quest but leaves the card locked', () => {
    const r = visit(1, 1, 5);
    expect(r.award).toBeNull();
    expect(owned()).toEqual([]);
    expect(useProgressStore.getState().byProfile['p1']?.quests).toHaveLength(1);
  });
});
