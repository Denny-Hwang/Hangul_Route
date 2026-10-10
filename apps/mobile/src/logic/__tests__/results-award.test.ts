import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyQuestResult, type QuestResultDeps, type QuestResultInput } from '../results-award';

const base: QuestResultInput = {
  profileId: 'p1',
  questId: 'quest:a',
  episodeId: 'ep:a',
  rewardCardId: 'card:hanbok',
  stars: 3,
  correct: 5,
  total: 5,
  retries: 0,
};

function makeDeps(owned: string[] = []): QuestResultDeps & {
  recordQuestComplete: ReturnType<typeof vi.fn>;
  unlockCard: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
} {
  return {
    ownedCardIds: () => owned,
    recordQuestComplete: vi.fn(),
    unlockCard: vi.fn(),
    track: vi.fn(),
  };
}

const eventNames = (deps: { track: ReturnType<typeof vi.fn> }): string[] =>
  deps.track.mock.calls.map((c) => (c[0] as { name: string }).name);

describe('applyQuestResult (Results award effect)', () => {
  let deps: ReturnType<typeof makeDeps>;
  beforeEach(() => {
    deps = makeDeps();
  });

  it('newly earned card (2+ stars, not owned): records, unlocks once, announces', () => {
    const award = applyQuestResult({ ...base, stars: 2, correct: 3 }, deps);
    expect(award).toEqual({ cardId: 'card:hanbok', isNew: true, isFirstCard: true });
    expect(deps.recordQuestComplete).toHaveBeenCalledTimes(1);
    expect(deps.recordQuestComplete).toHaveBeenCalledWith('p1', {
      questId: 'quest:a',
      episodeId: 'ep:a',
      stars: 2,
      accuracy: 0.6,
      attempts: 1,
    });
    expect(deps.unlockCard).toHaveBeenCalledTimes(1);
    expect(deps.unlockCard).toHaveBeenCalledWith('p1', 'card:hanbok');
    expect(eventNames(deps)).toEqual(['quest.complete', 'card.unlocked', 'card.first_earned']);
  });

  it('a later card is announced but is not the first card ever', () => {
    deps = makeDeps(['card:other']);
    const award = applyQuestResult(base, deps);
    expect(award).toEqual({ cardId: 'card:hanbok', isNew: true, isFirstCard: false });
    expect(eventNames(deps)).toEqual(['quest.complete', 'card.unlocked']);
  });

  it('already-owned card (replay): score is written, nothing is unlocked or announced', () => {
    deps = makeDeps(['card:hanbok']);
    const award = applyQuestResult(base, deps);
    expect(award).toEqual({ cardId: 'card:hanbok', isNew: false, isFirstCard: false });
    expect(deps.recordQuestComplete).toHaveBeenCalledTimes(1);
    expect(deps.unlockCard).not.toHaveBeenCalled();
    expect(eventNames(deps)).toEqual(['quest.complete']);
  });

  it.each([0, 1] as const)('below 2 stars (%i): score written, no card, no unlock', (stars) => {
    const award = applyQuestResult({ ...base, stars, correct: stars, total: 5 }, deps);
    expect(award).toBeNull();
    expect(deps.recordQuestComplete).toHaveBeenCalledTimes(1);
    expect(deps.unlockCard).not.toHaveBeenCalled();
    expect(eventNames(deps)).toEqual(['quest.complete']);
  });

  it('a quest with no reward card never awards', () => {
    expect(applyQuestResult({ ...base, rewardCardId: undefined }, deps)).toBeNull();
    expect(deps.unlockCard).not.toHaveBeenCalled();
  });

  it('every game skipped (total 0): no score, no card, only a skipped completion event', () => {
    const award = applyQuestResult({ ...base, stars: 0, correct: 0, total: 0 }, deps);
    expect(award).toBeNull();
    expect(deps.recordQuestComplete).not.toHaveBeenCalled();
    expect(deps.unlockCard).not.toHaveBeenCalled();
    expect(deps.track).toHaveBeenCalledTimes(1);
    expect(deps.track.mock.calls[0]![0]).toMatchObject({
      name: 'quest.complete',
      payload: { skipped: true, total: 0 },
    });
  });

  it('reports retries in the completion payload', () => {
    applyQuestResult({ ...base, retries: 4 }, deps);
    expect(deps.track.mock.calls[0]![0]).toMatchObject({
      payload: { stars: 3, correct: 5, total: 5, retries: 4 },
    });
  });

  it('reads the owned cards at call time, so a second visit sees the first one unlock', () => {
    const owned: string[] = [];
    const d = makeDeps();
    d.ownedCardIds = () => owned;
    d.unlockCard = vi.fn((_p: string, cardId: string) => {
      owned.push(cardId);
    });
    expect(applyQuestResult(base, d)?.isNew).toBe(true);
    expect(applyQuestResult(base, d)?.isNew).toBe(false);
    expect(d.unlockCard).toHaveBeenCalledTimes(1);
  });
});
