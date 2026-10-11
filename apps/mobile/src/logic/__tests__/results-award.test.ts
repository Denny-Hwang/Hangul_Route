import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { done, owned, PROFILE, snapshot, T1, T2, WORLD } from '../awards/__tests__/fixtures';
import { recordBestQuest } from '../quest-progress';
import { applyQuestResult, type QuestResultDeps, type QuestResultInput } from '../results-award';

const NOW = '2026-10-11T12:00:00.000Z';

const base: QuestResultInput = {
  profileId: 'p1',
  profileCreatedAt: PROFILE.createdAt,
  questId: 'quest:l1',
  episodeId: 'episode:stage1-letters',
  rewardCardId: 'card:book',
  stars: 3,
  correct: 5,
  total: 5,
  retries: 0,
};

type Deps = QuestResultDeps & {
  recordQuestComplete: ReturnType<typeof vi.fn>;
  unlockCards: ReturnType<typeof vi.fn>;
  recordCatchUp: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  current: () => ProgressSnapshot | undefined;
};

/**
 * A small in-memory progress store over the fixture world: `recordQuestComplete`
 * keeps the best run like the real store, and `unlockCards` adds unowned cards
 * and returns their ids.
 */
function makeDeps(start: ProgressSnapshot | undefined = snapshot({ cards: [owned('card:tiger', PROFILE.createdAt)] })): Deps {
  let snap = start;
  return {
    world: WORLD,
    isHydrated: () => true,
    snapshot: () => snap,
    current: () => snap,
    recordQuestComplete: vi.fn((_p: string, run: { questId: string; episodeId: string; stars: 0 | 1 | 2 | 3; accuracy: number; attempts: number }) => {
      const s = snap ?? snapshot();
      const previous = s.quests.find((q) => q.questId === run.questId);
      snap = { ...s, quests: [...s.quests.filter((q) => q.questId !== run.questId), recordBestQuest(previous, run, NOW)] };
    }),
    unlockCards: vi.fn((_p: string, cards: readonly { cardId: string; unlockedAt?: string }[]) => {
      const s = snap ?? snapshot();
      const ownedIds = new Set(s.cards.map((c) => c.cardId));
      const added = cards.filter((c) => !ownedIds.has(c.cardId));
      snap = { ...s, cards: [...s.cards, ...added.map((c) => ({ cardId: c.cardId, unlockedAt: c.unlockedAt ?? NOW, newSinceLastView: true }))] };
      return added.map((c) => c.cardId);
    }),
    recordCatchUp: vi.fn(),
    track: vi.fn(),
  };
}

type Event = { name: string; payload?: Record<string, unknown> };
const events = (deps: Deps): Event[] => deps.track.mock.calls.map((c) => c[0] as Event);
const eventNames = (deps: Deps): string[] => events(deps).map((e) => e.name);
const ofName = (deps: Deps, name: string): Event[] => events(deps).filter((e) => e.name === name);
const cardIds = (deps: Deps): string[] => (deps.current()?.cards ?? []).map((c) => c.cardId).sort();

/** Letters episode finished except quest:l2; the book (its quest card) is owned. */
const lettersHalfDone = (): ProgressSnapshot =>
  snapshot({ quests: [done('quest:l1', 2, T1)], cards: [owned('card:tiger', PROFILE.createdAt), owned('card:book', T1)] });

/** Everything of stage 1 but the life episode's one quest, with its cards. */
const stage1AllButLife = (): ProgressSnapshot =>
  snapshot({
    quests: [done('quest:l1', 2, T1), done('quest:l2', 1, T2)],
    cards: [owned('card:tiger', PROFILE.createdAt), owned('card:book', T1), owned('card:hanji', T2)],
  });

describe('applyQuestResult (Results award effect, F-STORY-006 §3.3)', () => {
  let deps: Deps;
  beforeEach(() => {
    deps = makeDeps();
  });

  describe('the quest card (unchanged rules)', () => {
    it('newly earned card (2+ stars, not owned): records, unlocks once, announces', () => {
      const outcome = applyQuestResult({ ...base, stars: 2, correct: 3 }, deps);
      expect(outcome).toEqual({ award: { cardId: 'card:book', isNew: true, isFirstCard: true }, extras: [], episodeCompleted: null, stageCompleted: null });
      expect(deps.recordQuestComplete).toHaveBeenCalledTimes(1);
      expect(deps.recordQuestComplete).toHaveBeenCalledWith('p1', {
        questId: 'quest:l1',
        episodeId: 'episode:stage1-letters',
        stars: 2,
        accuracy: 0.6,
        attempts: 1,
      });
      expect(deps.unlockCards).toHaveBeenCalledTimes(1);
      expect(deps.unlockCards).toHaveBeenCalledWith('p1', [{ cardId: 'card:book', unlockedAt: NOW }]);
      expect(eventNames(deps)).toEqual(['quest.complete', 'card.unlocked', 'card.first_earned']);
      expect(ofName(deps, 'card.unlocked')[0]?.payload).toEqual({ cardId: 'card:book', questId: 'quest:l1', episodeId: 'episode:stage1-letters', source: 'quest' });
      expect(ofName(deps, 'card.first_earned')[0]?.payload).toEqual({ cardId: 'card:book' });
    });

    it('a later card is announced but is not the first card ever', () => {
      deps = makeDeps(snapshot({ cards: [owned('card:tiger', PROFILE.createdAt), owned('card:apple')] }));
      const { award } = applyQuestResult(base, deps);
      expect(award).toEqual({ cardId: 'card:book', isNew: true, isFirstCard: false });
      expect(eventNames(deps)).toEqual(['quest.complete', 'card.unlocked']);
    });

    it("a learner who holds only Hoya's welcome card still fires card.first_earned once for the first card they earn (§3.4)", () => {
      const { award } = applyQuestResult({ ...base, stars: 2, correct: 3 }, deps);
      expect(award?.isFirstCard).toBe(true);
      expect(ofName(deps, 'card.first_earned')).toHaveLength(1);
    });

    it('already-owned card (replay): score is written, nothing is unlocked or announced', () => {
      deps = makeDeps(lettersHalfDone());
      const outcome = applyQuestResult(base, deps);
      expect(outcome).toEqual({ award: { cardId: 'card:book', isNew: false, isFirstCard: false }, extras: [], episodeCompleted: null, stageCompleted: null });
      expect(deps.recordQuestComplete).toHaveBeenCalledTimes(1);
      expect(deps.unlockCards).not.toHaveBeenCalled();
      expect(eventNames(deps)).toEqual(['quest.complete']);
    });

    it.each([0, 1] as const)('below 2 stars (%i) on an unfinished episode: score written, no card, no unlock', (stars) => {
      const outcome = applyQuestResult({ ...base, stars, correct: stars, total: 5 }, deps);
      expect(outcome.award).toBeNull();
      expect(outcome.extras).toEqual([]);
      expect(deps.recordQuestComplete).toHaveBeenCalledTimes(1);
      expect(deps.unlockCards).not.toHaveBeenCalled();
      expect(eventNames(deps)).toEqual(['quest.complete']);
    });

    it('a quest with no reward card never awards a quest card', () => {
      const outcome = applyQuestResult({ ...base, questId: 'quest:l2', rewardCardId: undefined }, deps);
      expect(outcome.award).toBeNull();
      expect(deps.unlockCards).not.toHaveBeenCalled();
    });

    it('a reward card the award rules do not know is still unlocked now, as before', () => {
      const outcome = applyQuestResult({ ...base, questId: 'quest:l2', rewardCardId: 'card:not-in-the-world' }, deps);
      expect(outcome.award).toEqual({ cardId: 'card:not-in-the-world', isNew: true, isFirstCard: true });
      expect(deps.unlockCards).toHaveBeenCalledWith('p1', [{ cardId: 'card:not-in-the-world' }]);
      expect(outcome.extras).toEqual([]);
      expect(ofName(deps, 'card.unlocked').map((e) => e.payload?.cardId)).toEqual(['card:not-in-the-world']);
    });

    it('every game skipped (total 0): no score, no card, only a skipped completion event', () => {
      const outcome = applyQuestResult({ ...base, stars: 0, correct: 0, total: 0 }, deps);
      expect(outcome).toEqual({ award: null, extras: [], episodeCompleted: null, stageCompleted: null });
      expect(deps.recordQuestComplete).not.toHaveBeenCalled();
      expect(deps.unlockCards).not.toHaveBeenCalled();
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

    it('reads the snapshot at call time, so a second visit sees the first one unlock', () => {
      expect(applyQuestResult(base, deps).award?.isNew).toBe(true);
      expect(applyQuestResult(base, deps).award?.isNew).toBe(false);
      expect(deps.unlockCards).toHaveBeenCalledTimes(1);
    });
  });

  describe('completion awards (extras)', () => {
    it('the last quest of an episode at 1 star: the episode cards arrive as extras, the quest card among them', () => {
      deps = makeDeps(snapshot({ quests: [done('quest:l1', 1, T1)], cards: [owned('card:tiger', PROFILE.createdAt)] }));
      const outcome = applyQuestResult({ ...base, questId: 'quest:l2', rewardCardId: undefined, stars: 1, correct: 2 }, deps);
      expect(outcome.award).toBeNull();
      expect(outcome.extras).toEqual([
        { cardId: 'card:book', source: 'episode' },
        { cardId: 'card:hanji', source: 'episode' },
      ]);
      expect(outcome.episodeCompleted).toBe('episode:stage1-letters');
      expect(outcome.stageCompleted).toBeNull();
      expect(deps.unlockCards).toHaveBeenCalledTimes(1);
      expect(cardIds(deps)).toEqual(['card:book', 'card:hanji', 'card:tiger']);
    });

    it('extras keep their deterministic time: the latest completion of the episode', () => {
      deps = makeDeps(snapshot({ quests: [done('quest:l1', 1, T1)], cards: [owned('card:tiger', PROFILE.createdAt)] }));
      applyQuestResult({ ...base, questId: 'quest:l2', rewardCardId: undefined, stars: 1, correct: 2 }, deps);
      expect(deps.unlockCards.mock.calls[0]![1]).toEqual([
        { cardId: 'card:book', unlockedAt: NOW },
        { cardId: 'card:hanji', unlockedAt: NOW },
      ]);
    });

    it('episode completion telemetry: card.unlocked per extra with its source, then episode.complete with the cards it brought', () => {
      deps = makeDeps(snapshot({ quests: [done('quest:l1', 1, T1)], cards: [owned('card:tiger', PROFILE.createdAt), owned('card:apple')] }));
      applyQuestResult({ ...base, questId: 'quest:l2', rewardCardId: undefined, stars: 1, correct: 2 }, deps);
      expect(eventNames(deps)).toEqual(['quest.complete', 'card.unlocked', 'card.unlocked', 'episode.complete']);
      expect(ofName(deps, 'card.unlocked').map((e) => e.payload)).toEqual([
        { cardId: 'card:book', questId: 'quest:l2', episodeId: 'episode:stage1-letters', source: 'episode' },
        { cardId: 'card:hanji', questId: 'quest:l2', episodeId: 'episode:stage1-letters', source: 'episode' },
      ]);
      expect(ofName(deps, 'episode.complete')[0]).toMatchObject({ profileId: 'p1', payload: { episodeId: 'episode:stage1-letters', cardsAwarded: 2 } });
    });

    it('extras never repeat the quest card; episode.complete counts it with the episode cards', () => {
      deps = makeDeps(snapshot({ quests: [done('quest:l2', 1, T1)], cards: [owned('card:tiger', PROFILE.createdAt), owned('card:apple')] }));
      const outcome = applyQuestResult({ ...base, stars: 3 }, deps);
      expect(outcome.award).toEqual({ cardId: 'card:book', isNew: true, isFirstCard: false });
      expect(outcome.extras).toEqual([{ cardId: 'card:hanji', source: 'episode' }]);
      expect(outcome.extras.some((e) => e.cardId === outcome.award?.cardId)).toBe(false);
      expect(deps.unlockCards).toHaveBeenCalledTimes(1);
      expect(ofName(deps, 'episode.complete')[0]?.payload).toEqual({ episodeId: 'episode:stage1-letters', cardsAwarded: 2 });
      expect(ofName(deps, 'card.unlocked').map((e) => e.payload?.source)).toEqual(['quest', 'episode']);
    });

    it('the first card earned as an extra (1-star episode finish) fires card.first_earned once, never for the welcome card', () => {
      deps = makeDeps(snapshot({ quests: [done('quest:l1', 1, T1)], cards: [owned('card:tiger', PROFILE.createdAt)] }));
      applyQuestResult({ ...base, questId: 'quest:l2', rewardCardId: undefined, stars: 1, correct: 2 }, deps);
      expect(ofName(deps, 'card.first_earned').map((e) => e.payload)).toEqual([{ cardId: 'card:book' }]);
    });

    it('the last quest of stage 1 brings the stage cards and reports the stage', () => {
      deps = makeDeps(stage1AllButLife());
      const outcome = applyQuestResult({ ...base, questId: 'quest:f1', episodeId: 'episode:stage1-life', rewardCardId: 'card:rice', stars: 2, correct: 4 }, deps);
      expect(outcome.award).toEqual({ cardId: 'card:rice', isNew: true, isFirstCard: false });
      expect(outcome.extras).toEqual([{ cardId: 'card:lantern', source: 'stage' }]);
      expect(outcome.episodeCompleted).toBe('episode:stage1-life');
      expect(outcome.stageCompleted).toBe('stage1');
      expect(eventNames(deps)).toEqual(['quest.complete', 'card.unlocked', 'card.unlocked', 'episode.complete', 'stage.complete']);
      expect(ofName(deps, 'card.unlocked')[1]?.payload).toEqual({ cardId: 'card:lantern', questId: 'quest:f1', source: 'stage' });
      expect(ofName(deps, 'episode.complete')[0]?.payload).toEqual({ episodeId: 'episode:stage1-life', cardsAwarded: 1 });
      expect(ofName(deps, 'stage.complete')[0]).toMatchObject({ profileId: 'p1', payload: { stageKey: 'stage1', cardsAwarded: 1 } });
      expect(deps.unlockCards).toHaveBeenCalledTimes(1);
    });

    it('a set completes when its last member arrives: the set card is an extra and card_set.complete fires', () => {
      const start = stage1AllButLife();
      deps = makeDeps({ ...start, cards: [...start.cards, owned('card:story-sun-and-moon', T2)] });
      const outcome = applyQuestResult({ ...base, questId: 'quest:f1', episodeId: 'episode:stage1-life', rewardCardId: 'card:rice', stars: 3 }, deps);
      expect(outcome.extras).toEqual([
        { cardId: 'card:lantern', source: 'stage' },
        { cardId: 'card:set-tales', source: 'set' },
      ]);
      expect(ofName(deps, 'card_set.complete').map((e) => e.payload)).toEqual([{ setId: 'set:tales', cardsAwarded: 1 }]);
      expect(ofName(deps, 'card.unlocked')[2]?.payload).toEqual({ cardId: 'card:set-tales', questId: 'quest:f1', source: 'set' });
      expect(eventNames(deps).at(-1)).toBe('card_set.complete');
    });

    it('a one-quest story shelf episode completes; it never counts toward its stage', () => {
      deps = makeDeps(stage1AllButLife());
      const outcome = applyQuestResult(
        { ...base, questId: 'quest:story-sun-and-moon-a1', episodeId: 'episode:shelf-sun-and-moon', rewardCardId: 'card:story-sun-and-moon', stars: 1, correct: 1 },
        deps,
      );
      expect(outcome.award).toBeNull();
      expect(outcome.extras).toEqual([{ cardId: 'card:story-sun-and-moon', source: 'episode' }]);
      expect(outcome.episodeCompleted).toBe('episode:shelf-sun-and-moon');
      expect(outcome.stageCompleted).toBeNull();
      expect(ofName(deps, 'stage.complete')).toEqual([]);
    });

    it('a welcome card missing from the snapshot arrives as an extra without a first-card event', () => {
      deps = makeDeps(snapshot());
      const outcome = applyQuestResult({ ...base, stars: 1, correct: 1 }, deps);
      expect(outcome.extras).toEqual([{ cardId: 'card:tiger', source: 'welcome' }]);
      expect(deps.unlockCards).toHaveBeenCalledWith('p1', [{ cardId: 'card:tiger', unlockedAt: PROFILE.createdAt }]);
      expect(ofName(deps, 'card.unlocked')[0]?.payload).toEqual({ cardId: 'card:tiger', questId: 'quest:l1', source: 'welcome' });
      expect(ofName(deps, 'card.first_earned')).toEqual([]);
    });

    it("another quest's card the snapshot already lacked before this run is a catch-up, not an extra (§3.5)", () => {
      // quest:l1 was finished at 2 stars, but its card never reached this snapshot.
      deps = makeDeps(snapshot({ quests: [done('quest:l1', 2, T1)], cards: [owned('card:tiger', PROFILE.createdAt), owned('card:apple')] }));
      const outcome = applyQuestResult({ ...base, questId: 'quest:l2', rewardCardId: undefined, stars: 1 }, deps);
      expect(outcome.extras).toEqual([{ cardId: 'card:hanji', source: 'episode' }]);
      expect(deps.unlockCards).toHaveBeenCalledTimes(1);
      expect(cardIds(deps)).toEqual(['card:apple', 'card:book', 'card:hanji', 'card:tiger']);
      expect(deps.recordCatchUp).toHaveBeenCalledTimes(1);
      expect(deps.recordCatchUp).toHaveBeenCalledWith('p1', [{ cardId: 'card:book', source: 'quest', via: 'quest:l1', unlockedAt: T1 }]);
      expect(ofName(deps, 'card.unlocked').map((e) => e.payload?.cardId)).toEqual(['card:hanji']);
    });

    it('cards a missed reconcile left out are a catch-up: same write, no per-card event, no first-card event', () => {
      // Letters was complete before this run, but its episode cards never arrived.
      deps = makeDeps(snapshot({ quests: [done('quest:l1', 1, T1), done('quest:l2', 1, T2)], cards: [owned('card:tiger', PROFILE.createdAt)] }));
      const outcome = applyQuestResult({ ...base, questId: 'quest:f1', episodeId: 'episode:stage1-life', rewardCardId: 'card:rice', stars: 2, correct: 4 }, deps);
      expect(outcome.award).toEqual({ cardId: 'card:rice', isNew: true, isFirstCard: false });
      expect(outcome.extras).toEqual([{ cardId: 'card:lantern', source: 'stage' }]);
      expect(deps.unlockCards).toHaveBeenCalledTimes(1);
      expect(cardIds(deps)).toEqual(['card:book', 'card:hanji', 'card:lantern', 'card:rice', 'card:tiger']);
      expect(deps.recordCatchUp.mock.calls[0]![1].map((a: { cardId: string }) => a.cardId)).toEqual(['card:book', 'card:hanji']);
      expect(ofName(deps, 'card.unlocked').map((e) => e.payload?.cardId)).toEqual(['card:rice', 'card:lantern']);
      expect(ofName(deps, 'card.first_earned')).toEqual([]);
      expect(ofName(deps, 'episode.complete').map((e) => e.payload)).toEqual([{ episodeId: 'episode:stage1-life', cardsAwarded: 1 }]);
    });

    it('a quest card that arrives with this write but belongs to another quest is credited to that quest', () => {
      deps = makeDeps(snapshot({ cards: [owned('card:tiger', PROFILE.createdAt), owned('card:apple')] }));
      const record = deps.recordQuestComplete.getMockImplementation()!;
      // The same write also lands quest:l1 at 2 stars (for example a merged pending run).
      deps.recordQuestComplete.mockImplementation((p: string, run: { questId: string; episodeId: string; stars: 0 | 1 | 2 | 3; accuracy: number; attempts: number }) => {
        record(p, { ...run, questId: 'quest:l1', stars: 2 });
        record(p, run);
      });
      const outcome = applyQuestResult({ ...base, questId: 'quest:l2', rewardCardId: undefined, stars: 1 }, deps);
      expect(outcome.extras).toEqual([
        { cardId: 'card:book', source: 'quest' },
        { cardId: 'card:hanji', source: 'episode' },
      ]);
      expect(ofName(deps, 'card.unlocked')[0]?.payload).toEqual({ cardId: 'card:book', questId: 'quest:l1', source: 'quest' });
    });

    it('episodeCompleted names only the episode of this run', () => {
      deps = makeDeps(snapshot({ cards: [owned('card:tiger', PROFILE.createdAt), owned('card:apple')] }));
      const record = deps.recordQuestComplete.getMockImplementation()!;
      // The same write also lands the life episode's one quest; this run leaves its own episode unfinished.
      deps.recordQuestComplete.mockImplementation((p: string, run: { questId: string; episodeId: string; stars: 0 | 1 | 2 | 3; accuracy: number; attempts: number }) => {
        record(p, { ...run, questId: 'quest:f1', episodeId: 'episode:stage1-life', stars: 1 });
        record(p, run);
      });
      const outcome = applyQuestResult({ ...base, stars: 1, correct: 1 }, deps);
      expect(ofName(deps, 'episode.complete').map((e) => e.payload?.episodeId)).toEqual(['episode:stage1-life']);
      expect(outcome.episodeCompleted).toBeNull();
    });

    it('before the saved snapshot has loaded: only the quest card, as before; no extras, no completion or first-card telemetry', () => {
      deps = makeDeps(snapshot({ quests: [done('quest:l2', 1, T1)] }));
      deps.isHydrated = () => false;
      const outcome = applyQuestResult(base, deps);
      expect(outcome).toEqual({ award: { cardId: 'card:book', isNew: true, isFirstCard: true }, extras: [], episodeCompleted: null, stageCompleted: null });
      expect(deps.unlockCards).toHaveBeenCalledWith('p1', [{ cardId: 'card:book' }]);
      expect(deps.recordCatchUp).not.toHaveBeenCalled();
      expect(eventNames(deps)).toEqual(['quest.complete', 'card.unlocked', 'card.first_earned']);
    });

    it('content the rules cannot read: the score and quest.complete still land, with only the quest card', () => {
      deps = makeDeps(snapshot({ quests: [done('quest:l2', 1, T1)], cards: [owned('card:tiger', PROFILE.createdAt)] }));
      deps.world = { ...WORLD, sets: WORLD.sets.map((s) => ({ ...s, memberCardIds: null as unknown as string[] })) };
      const outcome = applyQuestResult(base, deps);
      expect(outcome).toEqual({ award: { cardId: 'card:book', isNew: true, isFirstCard: true }, extras: [], episodeCompleted: null, stageCompleted: null });
      expect(deps.recordQuestComplete).toHaveBeenCalledTimes(1);
      expect(deps.unlockCards).toHaveBeenCalledWith('p1', [{ cardId: 'card:book' }]);
      expect(eventNames(deps)).toEqual(['quest.complete', 'card.unlocked', 'card.first_earned']);
    });

    it('a replay of a finished episode at fewer stars announces nothing and takes nothing away', () => {
      deps = makeDeps(stage1AllButLife());
      applyQuestResult({ ...base, questId: 'quest:f1', episodeId: 'episode:stage1-life', rewardCardId: 'card:rice', stars: 3 }, deps);
      const held = cardIds(deps);
      deps.track.mockClear();
      deps.unlockCards.mockClear();
      const replay = applyQuestResult({ ...base, questId: 'quest:f1', episodeId: 'episode:stage1-life', rewardCardId: 'card:rice', stars: 1, correct: 1 }, deps);
      expect(replay).toEqual({ award: null, extras: [], episodeCompleted: null, stageCompleted: null });
      expect(deps.unlockCards).not.toHaveBeenCalled();
      expect(eventNames(deps)).toEqual(['quest.complete']);
      expect(cardIds(deps)).toEqual(held);
      expect(deps.current()?.quests.find((q) => q.questId === 'quest:f1')?.stars).toBe(3);
    });

    it('a store with no snapshot yet still records the run and the quest card', () => {
      const d = makeDeps(undefined);
      d.snapshot = () => undefined;
      const outcome = applyQuestResult(base, d);
      expect(outcome).toEqual({ award: { cardId: 'card:book', isNew: true, isFirstCard: true }, extras: [], episodeCompleted: null, stageCompleted: null });
      expect(d.unlockCards).toHaveBeenCalledWith('p1', [{ cardId: 'card:book' }]);
    });

    it('a first write with no snapshot before it: the quest card and the welcome card, nothing counted as owed', () => {
      const d = makeDeps(snapshot());
      let reads = 0;
      // Nothing in memory before the score; the write creates the snapshot.
      d.snapshot = () => (reads++ === 0 ? undefined : d.current());
      const outcome = applyQuestResult(base, d);
      expect(outcome.award).toEqual({ cardId: 'card:book', isNew: true, isFirstCard: true });
      expect(outcome.extras).toEqual([{ cardId: 'card:tiger', source: 'welcome' }]);
      expect(d.recordCatchUp).not.toHaveBeenCalled();
    });

    it('uses the shipped bundle when no world is passed', () => {
      const d = makeDeps(snapshot({ cards: [owned('card:tiger', PROFILE.createdAt)] }));
      delete d.world;
      const outcome = applyQuestResult(
        { ...base, questId: 'quest:stage1-rites-q1', episodeId: 'episode:stage1-rites', rewardCardId: 'card:seollal', stars: 1, correct: 1 },
        d,
      );
      expect(outcome.episodeCompleted).toBe('episode:stage1-rites');
      expect(outcome.extras.map((e) => e.cardId).sort()).toEqual(['card:chuseok', 'card:sebae', 'card:seollal', 'card:songpyeon', 'card:tteokguk']);
    });
  });
});
