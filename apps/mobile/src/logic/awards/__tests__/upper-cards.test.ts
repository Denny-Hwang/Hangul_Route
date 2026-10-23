import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { awardWorld, awardWorldFor } from '../../../content/award-world';
import { episodesAll } from '../../../content/episodes';
import { UPPER_CARD_GATED_IDS } from '../../../content/upper-cell-cards';
import { mergeSnapshots } from '../../sync/merge';
import { applyAwards } from '../apply';
import { derivedAwards, firstFinishedAt, missingAwards } from '../derive';
import { obtainableCards } from '../obtainable';
import { ownedIdsOf, shownRewardCardIds, withUpperCards } from '../upper-cards';

/**
 * The upper-cell card award (F-CURR-002 §4.8 step 7, §7.2 and §12.2, row CM-23): finishing a cell's first volume brings
 * its card; a cell finished before the row shipped brings it on the next reconcile, dated by the cell's first finishes
 * (`questDoneAt`), so two devices derive the same award and a merge holds one entry; `upperCards` off adds none and
 * keeps the held ones.
 */
const PROFILE = { createdAt: '2026-09-01T08:00:00.000Z' };
const NOW = '2026-10-23T09:00:00.000Z';
const LETTERS = episodesAll.find((e) => e.id === 'episode:stage2-letters')!;
const LIFE = episodesAll.find((e) => e.id === 'episode:stage2-life')!;
const T = (d: number): string => `2026-10-${String(d).padStart(2, '0')}T10:00:00.000Z`;

/** A snapshot that finished every quest of `episode`: the first finish of quest i on day 1+i, its last replay on `replay`. */
function finished(episode: typeof LETTERS, replay: string | null, extra: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  const quests = episode.questIds.map((questId, i) => ({
    questId,
    episodeId: episode.id,
    startedAt: T(1 + i),
    completedAt: replay ?? T(1 + i),
    stars: 2 as const,
    attempts: 1,
    accuracy: 0.9,
  }));
  return {
    profileId: 'p',
    updatedAt: NOW,
    episodes: [],
    quests,
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    questDoneAt: Object.fromEntries(episode.questIds.map((q, i) => [q, T(1 + i)])),
    ...extra,
  };
}

const awardOf = (snap: ProgressSnapshot, cardId: string, world = awardWorld) => derivedAwards(world, snap, PROFILE).find((a) => a.cardId === cardId);

describe('withUpperCards and the cell page list (logic/awards/upper-cards.ts)', () => {
  const gated = new Set(['card:new']);
  const world = { ...awardWorld, cards: [{ ...awardWorld.cards[0]!, id: 'card:new' }, awardWorld.cards[1]!] };

  it('on: the world as shipped; off: a gated card is left out unless it is held', () => {
    expect(withUpperCards(world, true, gated, new Set())).toBe(world);
    expect(withUpperCards(world, false, gated, new Set()).cards.map((c) => c.id)).toEqual([awardWorld.cards[1]!.id]);
    expect(withUpperCards(world, false, gated, new Set(['card:new'])).cards.map((c) => c.id)).toEqual(['card:new', awardWorld.cards[1]!.id]);
  });

  it('a cell page shows a gated card while on, or once held', () => {
    expect(shownRewardCardIds(['card:new', 'card:x'], true, gated, new Set())).toEqual(['card:new', 'card:x']);
    expect(shownRewardCardIds(['card:new', 'card:x'], false, gated, new Set())).toEqual(['card:x']);
    expect(shownRewardCardIds(['card:new'], false, gated, new Set(['card:new']))).toEqual(['card:new']);
  });

  it('ownedIdsOf reads the held ids, and nothing from a missing list', () => {
    expect([...ownedIdsOf([{ cardId: 'card:a' }, { cardId: 'card:b' }])]).toEqual(['card:a', 'card:b']);
    expect(ownedIdsOf(undefined).size).toBe(0);
  });
});

describe('firstFinishedAt (F-CURR-002 §4.8 step 7)', () => {
  it('is the latest first finish: the latch, else the run, the earlier of the two when both exist', () => {
    const snap = finished(LETTERS, T(20));
    expect(firstFinishedAt(LETTERS, snap)).toBe(T(LETTERS.questIds.length));
    // A run earlier than its latch (a merge brought another device's earlier finish) wins.
    const early = { ...snap, quests: snap.quests.map((q, i) => (i === LETTERS.questIds.length - 1 ? { ...q, completedAt: T(1) } : q)) };
    expect(firstFinishedAt(LETTERS, early)).toBe(T(LETTERS.questIds.length - 1));
    // No latch at all (an older record): the runs date it.
    expect(firstFinishedAt(LETTERS, { ...snap, questDoneAt: undefined })).toBe(T(20));
  });

  it('is undefined while a quest has neither, and for a missing, draft or empty episode', () => {
    const snap = finished(LETTERS, null);
    const [, ...rest] = LETTERS.questIds;
    const missingOne = { ...snap, quests: snap.quests.slice(1), questDoneAt: Object.fromEntries(rest.map((q) => [q, T(5)])) };
    expect(firstFinishedAt(LETTERS, missingOne)).toBeUndefined();
    expect(firstFinishedAt(undefined, snap)).toBeUndefined();
    expect(firstFinishedAt({ ...LETTERS, status: 'draft' }, snap)).toBeUndefined();
    expect(firstFinishedAt({ ...LETTERS, questIds: [] }, snap)).toBeUndefined();
  });

  it('a latch entry from another device counts even when this copy holds no run of that quest', () => {
    const snap = finished(LETTERS, null);
    expect(firstFinishedAt(LETTERS, { ...snap, quests: snap.quests.slice(1) })).toBe(T(LETTERS.questIds.length));
  });
});

describe('the retroactive award (row CM-23)', () => {
  it('a cell finished before the row shipped brings its card on reconcile, dated by the first finishes, once', () => {
    const before = finished(LETTERS, T(20));
    const award = awardOf(before, 'card:norae');
    expect(award).toEqual({ cardId: 'card:norae', source: 'episode', via: 'episode:stage2-letters', unlockedAt: T(LETTERS.questIds.length) });
    const once = applyAwards(before, missingAwards(awardWorld, before, PROFILE), NOW);
    expect(once.cards.filter((c) => c.cardId === 'card:norae')).toEqual([{ cardId: 'card:norae', unlockedAt: T(LETTERS.questIds.length), newSinceLastView: true }]);
    // Idempotent: a second reconcile adds nothing.
    expect(missingAwards(awardWorld, once, PROFILE)).toEqual([]);
  });

  it('two devices, one with later replays, derive the same card and time; their merge holds one entry', () => {
    const a = finished(LETTERS, T(25));
    const b = finished(LETTERS, null);
    expect(awardOf(a, 'card:norae')).toEqual(awardOf(b, 'card:norae'));
    const ra = applyAwards(a, missingAwards(awardWorld, a, PROFILE), NOW);
    const rb = applyAwards(b, missingAwards(awardWorld, b, PROFILE), NOW);
    const merged = mergeSnapshots(ra, rb, { now: new Date(NOW) });
    expect(merged.cards.filter((c) => c.cardId === 'card:norae').map((c) => c.unlockedAt)).toEqual([T(LETTERS.questIds.length)]);
    expect(missingAwards(awardWorld, merged, PROFILE).filter((x) => x.cardId === 'card:norae')).toEqual([]);
  });

  it('a cell not finished gives no card', () => {
    const snap = finished(LETTERS, null);
    const partial = { ...snap, quests: snap.quests.slice(1), questDoneAt: {} };
    expect(awardOf(partial, 'card:norae')).toBeUndefined();
  });

  it('upperCards off: no new upper-cell card, nothing listed to find; a held one stays listed', () => {
    const snap = finished(LETTERS, null);
    const off = awardWorldFor(false, ownedIdsOf(snap.cards));
    expect(awardOf(snap, 'card:norae', off)).toBeUndefined();
    expect(obtainableCards(off, new Set()).some((c) => UPPER_CARD_GATED_IDS.has(c.id))).toBe(false);
    const held = new Set(['card:norae']);
    expect(obtainableCards(awardWorldFor(false, held), held).map((c) => c.id)).toContain('card:norae');
    expect(awardWorldFor(true, new Set())).toBe(awardWorld);
  });

  it('the taste cells keep their shipped awards whatever the switch: Lunch Box Words still gives its four cards', () => {
    const snap = finished(LIFE, null);
    for (const on of [true, false]) {
      const ids = derivedAwards(awardWorldFor(on, new Set()), snap, PROFILE)
        .filter((a) => a.via === LIFE.id || a.via === 'quest:stage2-life-q1')
        .map((a) => a.cardId)
        .sort();
      expect(ids, String(on)).toEqual(['card:dosirak', 'card:ppang', 'card:sagwa', 'card:uyu']);
    }
  });

  it('never random, never bought: every upper-cell card is an episode rule, no quest gives one', () => {
    for (const id of UPPER_CARD_GATED_IDS) {
      const card = awardWorld.cards.find((c) => c.id === id);
      expect(card?.unlockedBy, id).toMatch(/^episode:stage[23]-/);
      expect(awardWorld.quests.some((q) => q.rewardCardId === id), id).toBe(false);
    }
  });
});
