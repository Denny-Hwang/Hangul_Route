import { describe, expect, it } from 'vitest';
import { completedEpisodes, derivedAwards, isStageComplete, missingAwards, stageCanComplete } from '../derive';
import type { AwardWorld, DerivedAward } from '../types';
import { done, owned, PROFILE, snapshot, T1, T2, T3, T4, WORLD } from './fixtures';

const ids = (awards: readonly { cardId: string }[]): string[] => awards.map((a) => a.cardId);
const find = (awards: readonly DerivedAward[], cardId: string): DerivedAward | undefined => awards.find((a) => a.cardId === cardId);

describe('completedEpisodes', () => {
  it('maps each complete episode to the latest completedAt of its quests, at any star count', () => {
    const s = snapshot({ quests: [done('quest:l1', 1, T1), done('quest:l2', 0, T3), done('quest:f1', 3, T2)] });
    const map = completedEpisodes(WORLD, s);
    expect([...map.entries()]).toEqual([
      ['episode:stage1-letters', T3],
      ['episode:stage1-life', T2],
    ]);
  });

  it('an extra unfinished record of a finished quest does not change the completion time', () => {
    const s = snapshot({ quests: [done('quest:f1', 3, T2), done('quest:f1', 1, null)] });
    expect([...completedEpisodes(WORLD, s).entries()]).toEqual([['episode:stage1-life', T2]]);
  });

  it('a partly finished episode is not complete; a started but unfinished quest does not count', () => {
    const s = snapshot({ quests: [done('quest:l1', 3, T1), done('quest:l2', 3, null)] });
    expect(completedEpisodes(WORLD, s).size).toBe(0);
  });

  it('counts a one-quest story shelf episode, and never a preview episode with no quests', () => {
    const s = snapshot({ quests: [done('quest:story-sun-and-moon-a1', 1, T2)] });
    expect([...completedEpisodes(WORLD, s).keys()]).toEqual(['episode:shelf-sun-and-moon']);
  });

  it('a draft episode never completes, even when its quests are done', () => {
    const world: AwardWorld = { ...WORLD, episodes: WORLD.episodes.map((e) => (e.id === 'episode:stage1-life' ? { ...e, status: 'draft' } : e)) };
    expect(completedEpisodes(world, snapshot({ quests: [done('quest:f1', 3)] })).size).toBe(0);
  });
});

describe('isStageComplete and stageCanComplete', () => {
  it('stage 1 needs every grid episode; the story shelf does not count', () => {
    const half = completedEpisodes(WORLD, snapshot({ quests: [done('quest:l1', 3, T1), done('quest:l2', 3, T2)] }));
    expect(isStageComplete('stage1', WORLD, half)).toEqual({ complete: false });
    const all = completedEpisodes(WORLD, snapshot({ quests: [done('quest:l1', 3, T1), done('quest:l2', 3, T3), done('quest:f1', 1, T2)] }));
    expect(isStageComplete('stage1', WORLD, all)).toEqual({ complete: true, at: T3 });
  });

  it('stage 2 never completes while it has a placeholder; a stage with no episodes never completes', () => {
    const map = completedEpisodes(WORLD, snapshot({ quests: [done('quest:w1', 3)] }));
    expect(map.has('episode:stage2-life')).toBe(true);
    expect(isStageComplete('stage2', WORLD, map)).toEqual({ complete: false });
    expect(isStageComplete('stage5', WORLD, map)).toEqual({ complete: false });
    expect(stageCanComplete('stage1', WORLD)).toBe(true);
    expect(stageCanComplete('stage2', WORLD)).toBe(false);
    expect(stageCanComplete('stage5', WORLD)).toBe(false);
  });

  it('a stage whose only grid episodes are story shelves cannot complete', () => {
    const world: AwardWorld = { ...WORLD, episodes: WORLD.episodes.filter((e) => e.placement === 'shelf') };
    expect(stageCanComplete('stage1', world)).toBe(false);
  });
});

describe('derivedAwards (F-STORY-006 §3.1)', () => {
  it('a new profile derives only the welcome card, at profile.createdAt', () => {
    expect(derivedAwards(WORLD, snapshot(), PROFILE)).toEqual([{ cardId: 'card:tiger', source: 'welcome', via: 'welcome', unlockedAt: PROFILE.createdAt }]);
  });

  it('the quest card comes at 2 stars, not at 1', () => {
    const two = derivedAwards(WORLD, snapshot({ quests: [done('quest:l1', 2, T2)] }), PROFILE);
    expect(find(two, 'card:book')).toEqual({ cardId: 'card:book', source: 'quest', via: 'quest:l1', unlockedAt: T2 });
    const one = derivedAwards(WORLD, snapshot({ quests: [done('quest:l1', 1, T2)] }), PROFILE);
    expect(find(one, 'card:book')).toBeUndefined();
  });

  it('a quest with stars but no completion brings nothing', () => {
    expect(find(derivedAwards(WORLD, snapshot({ quests: [done('quest:l1', 3, null)] }), PROFILE), 'card:book')).toBeUndefined();
  });

  it('episode cards arrive at completion even after 1-star runs, at the latest completion time', () => {
    const s = snapshot({ quests: [done('quest:l1', 1, T1), done('quest:l2', 1, T3)] });
    const awards = derivedAwards(WORLD, s, PROFILE);
    expect(find(awards, 'card:book')).toEqual({ cardId: 'card:book', source: 'episode', via: 'episode:stage1-letters', unlockedAt: T3 });
    expect(find(awards, 'card:hanji')).toEqual({ cardId: 'card:hanji', source: 'episode', via: 'episode:stage1-letters', unlockedAt: T3 });
  });

  it('a card both rules award keeps the earlier time (the quest card before its episode)', () => {
    const s = snapshot({ quests: [done('quest:l1', 3, T1), done('quest:l2', 1, T3)] });
    expect(find(derivedAwards(WORLD, s, PROFILE), 'card:book')).toEqual({ cardId: 'card:book', source: 'quest', via: 'quest:l1', unlockedAt: T1 });
  });

  it('on equal times the quest source wins, so the result never depends on order', () => {
    const s = snapshot({ quests: [done('quest:f1', 3, T2)] });
    expect(find(derivedAwards(WORLD, s, PROFILE), 'card:rice')).toEqual({ cardId: 'card:rice', source: 'quest', via: 'quest:f1', unlockedAt: T2 });
  });

  it('an episode that completed before the quest run keeps the episode time', () => {
    // Content where a quest rewards a card of another episode (T-AWARD-2 forbids it in shipped content).
    const world: AwardWorld = { ...WORLD, quests: WORLD.quests.map((q) => (q.id === 'quest:w1' ? { ...q, rewardCardId: 'card:book' } : q)) };
    const s = snapshot({ quests: [done('quest:l1', 1, T1), done('quest:l2', 1, T2), done('quest:w1', 3, T4)] });
    expect(find(derivedAwards(world, s, PROFILE), 'card:book')).toEqual({ cardId: 'card:book', source: 'episode', via: 'episode:stage1-letters', unlockedAt: T2 });
  });

  it('a partial episode gives no episode card', () => {
    const awards = derivedAwards(WORLD, snapshot({ quests: [done('quest:l1', 1)] }), PROFILE);
    expect(ids(awards)).toEqual(['card:tiger']);
  });

  it('the stage card needs every grid episode of a fully shipped stage', () => {
    const partial = derivedAwards(WORLD, snapshot({ quests: [done('quest:l1', 1), done('quest:l2', 1)] }), PROFILE);
    expect(find(partial, 'card:lantern')).toBeUndefined();
    const s = snapshot({ quests: [done('quest:l1', 1, T1), done('quest:l2', 1, T2), done('quest:f1', 1, T4)] });
    expect(find(derivedAwards(WORLD, s, PROFILE), 'card:lantern')).toEqual({ cardId: 'card:lantern', source: 'stage', via: 'stage1', unlockedAt: T4 });
  });

  it('stage 2 cards never come while stage 2 has placeholders', () => {
    const awards = derivedAwards(WORLD, snapshot({ quests: [done('quest:w1', 3)] }), PROFILE);
    expect(find(awards, 'card:apple')?.source).toBe('episode');
    expect(find(awards, 'card:stage2-prize')).toBeUndefined();
  });

  it('a card on a preview episode is never derived', () => {
    const everything = snapshot({ quests: ['quest:l1', 'quest:l2', 'quest:f1', 'quest:story-sun-and-moon-a1', 'quest:w1'].map((q) => done(q, 3)) });
    expect(find(derivedAwards(WORLD, everything, PROFILE), 'card:soon')).toBeUndefined();
  });

  it('a set card needs every member, counting members derived in the same pass', () => {
    const s = snapshot({ quests: [done('quest:story-sun-and-moon-a1', 1, T2), done('quest:f1', 1, T3)] });
    expect(find(derivedAwards(WORLD, s, PROFILE), 'card:set-tales')).toEqual({ cardId: 'card:set-tales', source: 'set', via: 'set:tales', unlockedAt: T3 });
    const one = snapshot({ quests: [done('quest:f1', 1, T3)] });
    expect(find(derivedAwards(WORLD, one, PROFILE), 'card:set-tales')).toBeUndefined();
  });

  it('a set card counts members already owned, at their owned time', () => {
    const s = snapshot({ cards: [owned('card:story-sun-and-moon', T4), owned('card:rice', T1)] });
    expect(find(derivedAwards(WORLD, s, PROFILE), 'card:set-tales')).toEqual({ cardId: 'card:set-tales', source: 'set', via: 'set:tales', unlockedAt: T4 });
  });

  it('a set that is not registered, or has no members, awards nothing', () => {
    const s = snapshot({ cards: [owned('card:story-sun-and-moon'), owned('card:rice')] });
    expect(find(derivedAwards({ ...WORLD, sets: [] }, s, PROFILE), 'card:set-tales')).toBeUndefined();
    const empty: AwardWorld = { ...WORLD, sets: [{ id: 'set:tales', cardId: 'card:set-tales', titleEn: 'Tales', memberCardIds: [] }] };
    expect(find(derivedAwards(empty, s, PROFILE), 'card:set-tales')).toBeUndefined();
  });

  it('never derives a card that is not in the world, nor one with an unknown rule', () => {
    const world: AwardWorld = {
      ...WORLD,
      cards: [...WORLD.cards, { ...WORLD.cards[0]!, id: 'card:typo', unlockedBy: 'episod:stage1-letters' }],
      quests: [...WORLD.quests, { id: 'quest:ghost', rewardCardId: 'card:ghost' }],
    };
    const s = snapshot({ quests: [done('quest:l1', 3), done('quest:l2', 3), { ...done('quest:l1', 3), questId: 'quest:ghost' }] });
    const awards = ids(derivedAwards(world, s, PROFILE));
    expect(awards).not.toContain('card:typo');
    expect(awards).not.toContain('card:ghost');
  });

  it('is deterministic: the same progress always gives the same list, sorted by cardId', () => {
    const s = snapshot({ quests: [done('quest:f1', 1, T2), done('quest:l2', 1, T3), done('quest:l1', 2, T1)] });
    const reversed = snapshot({ quests: [...s.quests].reverse() });
    const a = derivedAwards(WORLD, s, PROFILE);
    expect(derivedAwards(WORLD, reversed, PROFILE)).toEqual(a);
    expect(ids(a)).toEqual([...ids(a)].sort());
    expect(ids(a)).toEqual(['card:book', 'card:hanji', 'card:lantern', 'card:rice', 'card:tiger']);
  });
});

describe('missingAwards', () => {
  it('is the derived awards minus the cards already owned, and leaves owned cards alone', () => {
    const s = snapshot({ quests: [done('quest:l1', 3, T1), done('quest:l2', 1, T2)], cards: [owned('card:book', T1), owned('card:tiger', T1)] });
    expect(missingAwards(WORLD, s, PROFILE)).toEqual([{ cardId: 'card:hanji', source: 'episode', via: 'episode:stage1-letters', unlockedAt: T2 }]);
  });

  it('is empty once everything derived is owned (a replay or a second reconcile adds nothing)', () => {
    const s = snapshot({ quests: [done('quest:l1', 3), done('quest:l2', 3)] });
    const all = derivedAwards(WORLD, s, PROFILE).map((a) => owned(a.cardId, a.unlockedAt));
    expect(missingAwards(WORLD, { ...s, cards: all }, PROFILE)).toEqual([]);
  });

  it('a replay with fewer stars never asks to take a card back', () => {
    const s = snapshot({ quests: [done('quest:l1', 1)], cards: [owned('card:book')] });
    expect(missingAwards(WORLD, s, PROFILE).map((a) => a.cardId)).toEqual(['card:tiger']);
  });
});

describe('times are compared as instants (the same rule as logic/sync/merge.ts earlierLatchTime)', () => {
  // 12:00+09:00 is 03:00Z: earlier as an instant, later as a string.
  const SEOUL_NOON = '2026-09-10T12:00:00.000+09:00';
  const UTC_FIVE = '2026-09-10T05:00:00.000Z';

  it('an episode completes at the latest instant, when an offset time sits next to a UTC time', () => {
    const s = snapshot({ quests: [done('quest:l1', 1, SEOUL_NOON), done('quest:l2', 1, UTC_FIVE)] });
    expect(completedEpisodes(WORLD, s).get('episode:stage1-letters')).toBe(UTC_FIVE);
  });

  it('the quest card keeps its earlier instant over the episode time, whatever the string order', () => {
    // quest:l1 at 08:00+09:00 (= 23:00Z the day before) is earlier than its episode's completion at T1.
    const early = '2026-09-10T08:00:00.000+09:00';
    const s = snapshot({ quests: [done('quest:l1', 3, early), done('quest:l2', 1, T1)] });
    expect(find(derivedAwards(WORLD, s, PROFILE), 'card:book')).toEqual({ cardId: 'card:book', source: 'quest', via: 'quest:l1', unlockedAt: early });
  });

  it('two forms of the same instant tie, so the quest source stays', () => {
    const same = '2026-09-10T09:00:00.000+09:00'; // = T1
    const s = snapshot({ quests: [done('quest:l1', 3, same), done('quest:l2', 1, T1)] });
    expect(find(derivedAwards(WORLD, s, PROFILE), 'card:book')?.source).toBe('quest');
  });

  it('a set completes at the latest instant of its members', () => {
    const s = snapshot({ cards: [owned('card:story-sun-and-moon', SEOUL_NOON), owned('card:rice', UTC_FIVE)] });
    expect(find(derivedAwards(WORLD, s, PROFILE), 'card:set-tales')?.unlockedAt).toBe(UTC_FIVE);
  });

  it('an unparseable time never beats a parseable one', () => {
    const s = snapshot({ quests: [done('quest:l1', 1, 'not-a-time'), done('quest:l2', 1, T1)] });
    expect(completedEpisodes(WORLD, s).get('episode:stage1-letters')).toBe(T1);
    // The quest card's unparseable time loses to its episode's parseable one.
    const q = snapshot({ quests: [done('quest:l1', 3, 'not-a-time'), done('quest:l2', 1, T1)] });
    expect(find(derivedAwards(WORLD, q, PROFILE), 'card:book')).toMatchObject({ source: 'episode', unlockedAt: T1 });
  });

  it('two unparseable times fall back to the string order, and the quest source stays on a tie', () => {
    const s = snapshot({ quests: [done('quest:l1', 3, 'b-bad'), done('quest:l2', 1, 'a-bad')] });
    expect(completedEpisodes(WORLD, s).get('episode:stage1-letters')).toBe('b-bad');
    expect(find(derivedAwards(WORLD, s, PROFILE), 'card:book')).toMatchObject({ source: 'quest', unlockedAt: 'b-bad' });
  });

  it('the latest time does not depend on argument order', () => {
    const pairs: [string, string, string][] = [
      [T1, 'not-a-time', T1],
      ['a-bad', 'b-bad', 'b-bad'],
      ['2026-09-10T09:00:00.000+09:00', T1, '2026-09-10T09:00:00.000+09:00'], // one instant, two forms: the string order breaks the tie
    ];
    for (const [x, y, want] of pairs) {
      for (const [l1, l2] of [[x, y], [y, x]] as const) {
        const s = snapshot({ quests: [done('quest:l1', 1, l1), done('quest:l2', 1, l2)] });
        expect(completedEpisodes(WORLD, s).get('episode:stage1-letters')).toBe(want);
      }
    }
  });
});

describe('sets never count another set card derived in the same pass (§3.2)', () => {
  const nested = (order: 'inner-first' | 'outer-first'): AwardWorld => {
    const inner = { id: 'set:inner', cardId: 'card:set-inner', titleEn: 'Inner', memberCardIds: ['card:rice'] };
    const outer = { id: 'set:outer', cardId: 'card:set-outer', titleEn: 'Outer', memberCardIds: ['card:set-inner', 'card:book'] };
    return {
      ...WORLD,
      cards: [...WORLD.cards, { ...WORLD.cards[0]!, id: 'card:set-inner', unlockedBy: 'set:inner' }, { ...WORLD.cards[0]!, id: 'card:set-outer', unlockedBy: 'set:outer' }],
      sets: order === 'inner-first' ? [inner, outer] : [outer, inner],
    };
  };

  it('gives the same answer whatever the order of world.sets', () => {
    const s = snapshot({ quests: [done('quest:f1', 3, T2)], cards: [owned('card:book', T1)] });
    const a = derivedAwards(nested('inner-first'), s, PROFILE);
    expect(derivedAwards(nested('outer-first'), s, PROFILE)).toEqual(a);
    expect(ids(a)).toContain('card:set-inner');
    expect(ids(a)).not.toContain('card:set-outer');
  });

  it('counts a set card that is already owned', () => {
    const s = snapshot({ cards: [owned('card:book', T1), owned('card:set-inner', T3)] });
    expect(find(derivedAwards(nested('outer-first'), s, PROFILE), 'card:set-outer')?.unlockedAt).toBe(T3);
  });
});
