import { VocabProgressSchema, type ProgressSnapshot, type VocabItemState, type VocabProgress, type VocabTopicProgress } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { PLACEMENT_KEEP } from '@hangul-route/content-schema';
import { seededRandom } from '../../listen-pick';
import { placementResult } from '../../placement/__tests__/fixtures';
import { selfRoute } from '../../homework/__tests__/curriculum-fixture';
import { compareInstant, isSubsetOf, mergeCard, mergeQuestDoneAt, mergeReview, mergeSnapshots, mergeVocab, rebaseSnapshot, withSnapshotDefaults } from '../merge';

const NOW = new Date('2026-09-21T12:00:00.000Z');
const base = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
  profileId: 'profile:a',
  updatedAt: '2026-09-20T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
  ...over,
});
const quest = (questId: string, stars: 0 | 1 | 2 | 3, accuracy: number, attempts = 1, completedAt?: string) => ({
  questId,
  episodeId: 'episode:x',
  startedAt: '2026-09-20T00:00:00.000Z',
  completedAt,
  stars,
  attempts,
  accuracy,
});
const session = (id: string, startedAt: string) => ({ id, profileId: 'profile:a', startedAt, episodesTouched: [] });

describe('mergeSnapshots (F-SYNC-001 §3.3)', () => {
  it('unions quests, keeps the better run, sums attempts, keeps earliest dates', () => {
    const local = base({ quests: [quest('q1', 2, 0.7, 2, '2026-09-20T01:00:00Z'), quest('q2', 1, 0.4)] });
    const server = base({ quests: [quest('q1', 3, 0.9, 1, '2026-09-19T01:00:00Z'), quest('q3', 2, 0.8)] });
    const m = mergeSnapshots(local, server, { now: NOW });
    const q1 = m.quests.find((q) => q.questId === 'q1');
    expect(q1?.stars).toBe(3);
    expect(q1?.attempts).toBe(3);
    expect(q1?.completedAt).toBe('2026-09-19T01:00:00Z');
    expect(m.quests.map((q) => q.questId).sort()).toEqual(['q1', 'q2', 'q3']);
  });

  it('same stars → higher accuracy wins; cards keep earliest unlock and seen-anywhere newSinceLastView', () => {
    const local = base({
      quests: [quest('q1', 2, 0.6)],
      cards: [{ cardId: 'card:a', unlockedAt: '2026-09-20T00:00:00Z', newSinceLastView: false }],
    });
    const server = base({
      quests: [quest('q1', 2, 0.9)],
      cards: [
        { cardId: 'card:a', unlockedAt: '2026-09-19T00:00:00Z', newSinceLastView: true },
        { cardId: 'card:b', unlockedAt: '2026-09-19T00:00:00Z', newSinceLastView: true },
      ],
    });
    const m = mergeSnapshots(local, server, { now: NOW });
    expect(m.quests[0]?.accuracy).toBe(0.9);
    const a = m.cards.find((c) => c.cardId === 'card:a');
    expect(a?.unlockedAt).toBe('2026-09-19T00:00:00Z');
    expect(a?.newSinceLastView).toBe(false);
    expect(m.cards).toHaveLength(2);
  });

  it('episodes take max counts; homework keeps completion; reviews keep higher stars', () => {
    const local = base({
      episodes: [{ episodeId: 'e', startedAt: 's', questsCompleted: 1, totalQuests: 3 }],
      homework: [{ id: 'h1', profileId: 'profile:a', questId: 'q', episodeId: 'e', assignedBy: 'parent', assignedAt: 't', targetDate: '2026-09-20' }],
      reviews: [{ id: 'r1', kind: 'daily', generatedAt: 't', scope: 's', itemIds: [], resultStars: 1 }],
    });
    const server = base({
      episodes: [{ episodeId: 'e', startedAt: 's', questsCompleted: 2, totalQuests: 3, completedAt: 'c' }],
      homework: [{ id: 'h1', profileId: 'profile:a', questId: 'q', episodeId: 'e', assignedBy: 'parent', assignedAt: 't', targetDate: '2026-09-20', completedAt: 'done' }],
      reviews: [{ id: 'r1', kind: 'daily', generatedAt: 't', scope: 's', itemIds: [], resultStars: 3 }],
    });
    const m = mergeSnapshots(local, server, { now: NOW });
    expect(m.episodes[0]).toMatchObject({ questsCompleted: 2, totalQuests: 3, completedAt: 'c' });
    expect(m.homework[0]?.completedAt).toBe('done');
    expect(m.reviews[0]?.resultStars).toBe(3);
  });

  it('mergeReview: on a star tie the copy that kept missedItemIds wins, whichever side it is on', () => {
    const full = { id: 'r1', kind: 'stage-certificate' as const, generatedAt: 't', scope: 'stage1', itemIds: ['jamo:a'], resultStars: 3 as const, missedItemIds: ['jamo:a'] };
    const { missedItemIds: _m, ...stripped } = full;
    expect(mergeReview(stripped, full)).toBe(full);
    expect(mergeReview(full, stripped)).toBe(full);
    // Higher stars still win first; a tie of two complete copies keeps the local one.
    expect(mergeReview({ ...stripped, resultStars: 3 }, { ...full, resultStars: 2 }).resultStars).toBe(3);
    const other = { ...full, missedItemIds: [] };
    expect(mergeReview(full, other)).toBe(full);
  });

  it('unions sessions by id, sorts them, and recomputes the streak from the union', () => {
    const local = base({ sessions: [session('s2', '2026-09-21T09:00:00Z')] });
    const server = base({ sessions: [session('s1', '2026-09-20T09:00:00Z'), session('s2', '2026-09-21T09:00:00Z')] });
    const m = mergeSnapshots(local, server, { now: NOW });
    expect(m.sessions.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(m.streakDays).toBe(2);
    expect(m.updatedAt).toBe('2026-09-20T00:00:00.000Z');
  });

  it('recomputes the streak from quest sessions only: story, game and level-check time never moves it (F-REPORT-001 OD-19)', () => {
    const local = base({ sessions: [session('session:time:2026-09-21T09:00:00Z', '2026-09-21T09:00:00Z')] });
    const server = base({ sessions: [session('s1', '2026-09-20T09:00:00Z')] });
    const m = mergeSnapshots(local, server, { now: NOW });
    expect(m.sessions).toHaveLength(2);
    // the story day (today) is not a streak day: only yesterday's quest counts
    expect(m.streakDays).toBe(1);
    const quest = mergeSnapshots(base({ sessions: [session('s2', '2026-09-21T09:00:00Z')] }), server, { now: NOW });
    expect(quest.streakDays).toBe(2);
  });

  it('is commutative and idempotent (profileId aside)', () => {
    const a = base({ quests: [quest('q1', 1, 0.5)], cards: [{ cardId: 'c', unlockedAt: 'x', newSinceLastView: true }] });
    const b = base({ profileId: 'profile:b', quests: [quest('q2', 3, 1)], sessions: [session('s', '2026-09-21T00:00:00Z')] });
    const ab = mergeSnapshots(a, b, { now: NOW });
    const ba = mergeSnapshots(b, a, { now: NOW });
    expect({ ...ab, profileId: '' }).toEqual({ ...ba, profileId: '' });
    expect(mergeSnapshots(ab, ab, { now: NOW })).toEqual({ ...ab, quests: ab.quests.map((q) => ({ ...q, attempts: q.attempts * 2 })) });
  });

  it('isSubsetOf says when an upload adds nothing', () => {
    const server = base({ quests: [quest('q1', 2, 0.7)], cards: [{ cardId: 'c', unlockedAt: 'x', newSinceLastView: true }] });
    expect(isSubsetOf(base({ quests: [quest('q1', 2, 0.7)] }), server)).toBe(true);
    expect(isSubsetOf(base({ quests: [quest('q1', 3, 0.7)] }), server)).toBe(false);
    expect(isSubsetOf(base({ sessions: [session('s', 't')] }), server)).toBe(false);
  });

  it('isSubsetOf counts a card seen only on this device as something to upload (F-STORY-006 section 3.6 M3)', () => {
    const card = (newSinceLastView: boolean) => ({ cardId: 'c', unlockedAt: 'x', newSinceLastView });
    expect(isSubsetOf(base({ cards: [card(false)] }), base({ cards: [card(true)] }))).toBe(false);
    expect(isSubsetOf(base({ cards: [card(false)] }), base({ cards: [card(false)] }))).toBe(true);
    expect(isSubsetOf(base({ cards: [card(true)] }), base({ cards: [card(false)] }))).toBe(true);
    expect(isSubsetOf(base({ cards: [card(true)] }), base({ cards: [card(true)] }))).toBe(true);
  });
});

describe('legacy snapshots without placements (F-PLC-001 section 3.8)', () => {
  const legacy = (over: Record<string, unknown> = {}): ProgressSnapshot => {
    const snapshot: Record<string, unknown> = { ...base(), ...over };
    delete snapshot['placements'];
    return snapshot as unknown as ProgressSnapshot;
  };

  it('merges two snapshots that predate the key without throwing', () => {
    const merged = mergeSnapshots(legacy({ quests: [quest('q1', 2, 0.7)] }), legacy({ quests: [quest('q2', 1, 0.5)] }), { now: NOW });
    expect(merged.quests.map((q) => q.questId).sort()).toEqual(['q1', 'q2']);
  });

  it('merges a legacy local copy with a server copy that carries placements', () => {
    const server = base({ quests: [quest('q2', 1, 0.5)], placements: [{ id: 'placement:a' } as never] });
    const merged = mergeSnapshots(legacy({ quests: [quest('q1', 2, 0.7)] }), server, { now: NOW });
    expect(merged.quests.map((q) => q.questId).sort()).toEqual(['q1', 'q2']);
    expect(isSubsetOf(legacy({ quests: [quest('q2', 1, 0.5)] }), server)).toBe(true);
    expect(isSubsetOf(server, legacy())).toBe(false);
  });

  it('isSubsetOf works when either side lacks the key', () => {
    expect(isSubsetOf(legacy(), legacy())).toBe(true);
    expect(isSubsetOf(legacy(), base())).toBe(true);
    expect(isSubsetOf(base(), legacy())).toBe(true);
  });
});

describe('stageDoneAt, the stage latch (F-ROUTE-001 section 3.15)', () => {
  const legacy = (over: Record<string, unknown> = {}): ProgressSnapshot => {
    const snapshot: Record<string, unknown> = { ...base(), ...over };
    delete snapshot['stageDoneAt'];
    return snapshot as unknown as ProgressSnapshot;
  };

  it('unions the keys and keeps the earliest time per stage', () => {
    const local = base({ stageDoneAt: { stage1: '2026-10-11T10:00:00.000Z', stage2: '2026-10-20T10:00:00.000Z' } });
    const server = base({ stageDoneAt: { stage1: '2026-10-10T10:00:00.000Z', stage4: '2026-10-15T10:00:00.000Z' } });
    const expected = { stage1: '2026-10-10T10:00:00.000Z', stage2: '2026-10-20T10:00:00.000Z', stage4: '2026-10-15T10:00:00.000Z' };
    expect(mergeSnapshots(local, server, { now: NOW }).stageDoneAt).toEqual(expected);
    // order of the arguments never changes the result
    expect(mergeSnapshots(server, local, { now: NOW }).stageDoneAt).toEqual(expected);
  });

  it('never drops a latch either side holds (an earned Complete is never removed)', () => {
    const latch = { stage1: '2026-10-11T10:00:00.000Z' };
    expect(mergeSnapshots(base({ stageDoneAt: latch }), legacy(), { now: NOW }).stageDoneAt).toEqual(latch);
    expect(mergeSnapshots(legacy(), base({ stageDoneAt: latch }), { now: NOW }).stageDoneAt).toEqual(latch);
    expect(mergeSnapshots(base({ stageDoneAt: {} }), base({ stageDoneAt: latch }), { now: NOW }).stageDoneAt).toEqual(latch);
  });

  it('compares instants, not strings: an offset time and a junk value never win wrongly', () => {
    const at = (l: string, s: string) => mergeSnapshots(base({ stageDoneAt: { stage1: l } }), base({ stageDoneAt: { stage1: s } }), { now: NOW }).stageDoneAt;
    // 08:00+09:00 is 23:00Z the day before, so it is the earlier instant
    expect(at('2026-10-11T08:00:00+09:00', '2026-10-11T00:00:00Z')).toEqual({ stage1: '2026-10-11T08:00:00+09:00' });
    expect(at('2026-10-11T00:00:00Z', '2026-10-11T08:00:00+09:00')).toEqual({ stage1: '2026-10-11T08:00:00+09:00' });
    // a value that does not parse never beats a real time, whichever side holds it
    expect(at('', '2026-10-11T00:00:00.000Z')).toEqual({ stage1: '2026-10-11T00:00:00.000Z' });
    expect(at('2026-10-11T00:00:00.000Z', 'soon')).toEqual({ stage1: '2026-10-11T00:00:00.000Z' });
    // two unparseable values still give one answer whatever the order
    expect(at('b', 'a')).toEqual({ stage1: 'a' });
    expect(at('a', 'b')).toEqual({ stage1: 'a' });
  });

  it('does not add the key to snapshots that predate it (legacy shape kept)', () => {
    expect(mergeSnapshots(legacy(), legacy(), { now: NOW })).not.toHaveProperty('stageDoneAt');
    expect(mergeSnapshots(base({ stageDoneAt: {} }), legacy(), { now: NOW })).not.toHaveProperty('stageDoneAt');
  });

  it('isSubsetOf asks for an upload when the local copy holds a latch the server lacks', () => {
    const latch = { stage1: '2026-10-11T10:00:00.000Z' };
    expect(isSubsetOf(base({ stageDoneAt: latch }), legacy())).toBe(false);
    // the server holds a later "first complete" time than the device: the earlier one must go up
    expect(isSubsetOf(base({ stageDoneAt: latch }), base({ stageDoneAt: { stage1: '2026-10-12T00:00:00.000Z' } }))).toBe(false);
    expect(isSubsetOf(base({ stageDoneAt: { stage1: '2026-10-12T00:00:00.000Z' } }), base({ stageDoneAt: latch }))).toBe(true);
    expect(isSubsetOf(base({ stageDoneAt: latch }), base({ stageDoneAt: latch }))).toBe(true);
    expect(isSubsetOf(legacy(), base({ stageDoneAt: latch }))).toBe(true);
    expect(isSubsetOf(base({ stageDoneAt: {} }), legacy())).toBe(true);
    // a key that happens to name an Object.prototype member is still a missing latch
    expect(isSubsetOf(base({ stageDoneAt: { constructor: '2026-10-11T10:00:00.000Z' } }), legacy())).toBe(false);
  });
});

describe('questDoneAt, the quest latch (F-REPORT-001 section 3.3.1, M5)', () => {
  const legacy = (over: Record<string, unknown> = {}): ProgressSnapshot => {
    const snapshot: Record<string, unknown> = { ...base(), ...over };
    delete snapshot['questDoneAt'];
    return snapshot as unknown as ProgressSnapshot;
  };

  it('unions the keys and keeps the earliest time per quest, whatever the argument order', () => {
    const local = { 'quest:a': '2026-10-11T10:00:00.000Z', 'quest:b': '2026-10-20T10:00:00.000Z' };
    const server = { 'quest:a': '2026-10-10T10:00:00.000Z', 'quest:c': '2026-10-15T10:00:00.000Z' };
    const expected = { 'quest:a': '2026-10-10T10:00:00.000Z', 'quest:b': '2026-10-20T10:00:00.000Z', 'quest:c': '2026-10-15T10:00:00.000Z' };
    expect(mergeQuestDoneAt(local, server)).toEqual(expected);
    expect(mergeQuestDoneAt(server, local)).toEqual(expected);
    expect(mergeSnapshots(base({ questDoneAt: local }), base({ questDoneAt: server }), { now: NOW }).questDoneAt).toEqual(expected);
  });

  it('never drops an entry either side holds (a first finish is never lost)', () => {
    const latch = { 'quest:a': '2026-10-11T10:00:00.000Z' };
    expect(mergeSnapshots(base({ questDoneAt: latch }), legacy(), { now: NOW }).questDoneAt).toEqual(latch);
    expect(mergeSnapshots(legacy(), base({ questDoneAt: latch }), { now: NOW }).questDoneAt).toEqual(latch);
    expect(mergeSnapshots(base({ questDoneAt: {} }), base({ questDoneAt: latch }), { now: NOW }).questDoneAt).toEqual(latch);
  });

  it('compares instants, not strings: an offset time and an unparseable value never win wrongly', () => {
    const at = (l: string, s: string) => mergeQuestDoneAt({ 'quest:a': l }, { 'quest:a': s });
    // 08:00+09:00 is 23:00Z the day before, so it is the earlier instant
    expect(at('2026-10-11T08:00:00+09:00', '2026-10-11T00:00:00Z')).toEqual({ 'quest:a': '2026-10-11T08:00:00+09:00' });
    expect(at('2026-10-11T00:00:00Z', '2026-10-11T08:00:00+09:00')).toEqual({ 'quest:a': '2026-10-11T08:00:00+09:00' });
    // a value that does not parse never beats a real time, whichever side holds it
    expect(at('', '2026-10-11T00:00:00.000Z')).toEqual({ 'quest:a': '2026-10-11T00:00:00.000Z' });
    expect(at('2026-10-11T00:00:00.000Z', 'soon')).toEqual({ 'quest:a': '2026-10-11T00:00:00.000Z' });
    // two unparseable values still give one answer whatever the order
    expect(at('b', 'a')).toEqual({ 'quest:a': 'a' });
    expect(at('a', 'b')).toEqual({ 'quest:a': 'a' });
  });

  it('an empty record is a value: kept when either side holds the key, absent only when neither does', () => {
    expect(mergeQuestDoneAt(undefined, undefined)).toBeUndefined();
    expect(mergeQuestDoneAt({}, undefined)).toEqual({});
    expect(mergeQuestDoneAt(undefined, {})).toEqual({});
    expect(mergeSnapshots(legacy(), legacy(), { now: NOW })).not.toHaveProperty('questDoneAt');
    expect(mergeSnapshots(base({ questDoneAt: {} }), legacy(), { now: NOW }).questDoneAt).toEqual({});
    expect(mergeSnapshots(legacy(), base({ questDoneAt: {} }), { now: NOW }).questDoneAt).toEqual({});
  });

  it('is commutative, associative and idempotent', () => {
    const a = { 'quest:a': '2026-10-11T10:00:00.000Z', 'quest:b': 'junk' };
    const b = { 'quest:a': '2026-10-11T19:00:00+09:00', 'quest:c': '2026-10-01T00:00:00.000Z' };
    const c = { 'quest:b': '2026-10-02T00:00:00.000Z', 'quest:c': '2026-10-03T00:00:00.000Z' };
    expect(mergeQuestDoneAt(a, b)).toEqual(mergeQuestDoneAt(b, a));
    expect(mergeQuestDoneAt(a, mergeQuestDoneAt(b, c))).toEqual(mergeQuestDoneAt(mergeQuestDoneAt(a, b), c));
    expect(mergeQuestDoneAt(a, a)).toEqual(a);
    expect(Object.keys(mergeQuestDoneAt(c, a) ?? {})).toEqual(['quest:a', 'quest:b', 'quest:c']);
  });

  it('a key that names an Object.prototype member is merged like any other', () => {
    expect(mergeQuestDoneAt({ constructor: '2026-10-11T10:00:00.000Z' }, {})).toEqual({ constructor: '2026-10-11T10:00:00.000Z' });
  });

  it('isSubsetOf asks for an upload when the local copy holds an entry the server lacks or holds later', () => {
    const latch = { 'quest:a': '2026-10-11T10:00:00.000Z' };
    expect(isSubsetOf(base({ questDoneAt: latch }), legacy())).toBe(false);
    expect(isSubsetOf(base({ questDoneAt: latch }), base({ questDoneAt: { 'quest:a': '2026-10-12T00:00:00.000Z' } }))).toBe(false);
    expect(isSubsetOf(base({ questDoneAt: { 'quest:a': '2026-10-12T00:00:00.000Z' } }), base({ questDoneAt: latch }))).toBe(true);
    expect(isSubsetOf(base({ questDoneAt: latch }), base({ questDoneAt: latch }))).toBe(true);
    expect(isSubsetOf(legacy(), base({ questDoneAt: latch }))).toBe(true);
    // an empty local record adds nothing the server needs
    expect(isSubsetOf(base({ questDoneAt: {} }), legacy())).toBe(true);
    expect(isSubsetOf(base({ questDoneAt: { constructor: '2026-10-11T10:00:00.000Z' } }), legacy())).toBe(false);
  });

  it('rebaseSnapshot keeps a first finish written while the request was in flight', () => {
    const sent = base({ questDoneAt: {} });
    const ours = base({ quests: [quest('q1', 2, 0.8, 1, '2026-09-21T10:00:00.000Z')], questDoneAt: { q1: '2026-09-21T10:00:00.000Z' } });
    const theirs = base({ questDoneAt: { q0: '2026-09-20T10:00:00.000Z' } });
    expect(rebaseSnapshot(sent, ours, theirs, { now: NOW }).questDoneAt).toEqual({ q0: '2026-09-20T10:00:00.000Z', q1: '2026-09-21T10:00:00.000Z' });
  });
});

/**
 * Card collection contract of mergeSnapshots (F-STORY-006 §3.6, M1-M5).
 * Property tests over seeded random card sets: the same seeds run on every
 * machine, so a failure is reproducible from the printed seed.
 */
type Card = ProgressSnapshot['cards'][number];

const CARD_IDS = ['card:a', 'card:b', 'card:c', 'card:d', 'card:e', 'card:f'];
const TIMES = ['2026-09-18T00:00:00.000Z', '2026-09-19T00:00:00.000Z', '2026-09-20T00:00:00.000Z', '2026-09-21T00:00:00.000Z'];
const RUNS = 300;

function pick<T>(rand: () => number, from: readonly T[]): T {
  return from[Math.floor(rand() * from.length)] as T;
}

/** A random snapshot: each card present with probability 1/2, random time and seen flag. */
function randomCards(rand: () => number): Card[] {
  return CARD_IDS.filter(() => rand() < 0.5).map((cardId) => ({ cardId, unlockedAt: pick(rand, TIMES), newSinceLastView: rand() < 0.5 }));
}

function randomSnapshot(rand: () => number): ProgressSnapshot {
  const quests = CARD_IDS.filter(() => rand() < 0.4).map((id) =>
    quest(`q${id.slice(-1)}`, pick(rand, [0, 1, 2, 3] as const), rand(), 1, rand() < 0.7 ? pick(rand, TIMES) : undefined),
  );
  return base({ cards: randomCards(rand), quests: quests.map((q, i) => ({ ...q, attempts: i + 1 })) });
}

const cardsOf = (a: ProgressSnapshot, b: ProgressSnapshot): Card[] => mergeSnapshots(a, b, { now: NOW }).cards;
const byId = (cards: readonly Card[]): Map<string, Card> => new Map(cards.map((c) => [c.cardId, c]));

function forAll(property: (rand: () => number, seed: number) => void): void {
  for (let seed = 1; seed <= RUNS; seed += 1) property(seededRandom(seed), seed);
}

describe('mergeCard: seen anywhere = seen (M3)', () => {
  const at = '2026-09-20T00:00:00.000Z';
  it('a card seen on either device stays seen, whichever side is local', () => {
    const seen: Card = { cardId: 'card:a', unlockedAt: at, newSinceLastView: false };
    const fresh: Card = { cardId: 'card:a', unlockedAt: at, newSinceLastView: true };
    expect(mergeCard(seen, fresh).newSinceLastView).toBe(false);
    expect(mergeCard(fresh, seen).newSinceLastView).toBe(false);
    expect(mergeCard(fresh, fresh).newSinceLastView).toBe(true);
    expect(mergeCard(seen, seen).newSinceLastView).toBe(false);
  });

  it('a seen local copy merged with an unseen server copy is not new again (and the reverse)', () => {
    const local = base({ cards: [{ cardId: 'card:a', unlockedAt: at, newSinceLastView: true }] });
    const server = base({ cards: [{ cardId: 'card:a', unlockedAt: at, newSinceLastView: false }] });
    expect(cardsOf(local, server)).toEqual([{ cardId: 'card:a', unlockedAt: at, newSinceLastView: false }]);
    expect(cardsOf(server, local)).toEqual([{ cardId: 'card:a', unlockedAt: at, newSinceLastView: false }]);
  });
});

describe('mergeSnapshots card properties (F-STORY-006 §3.6)', () => {
  it('M1 superset: every card of either side survives, one entry per cardId', () => {
    forAll((rand, seed) => {
      const a = randomSnapshot(rand);
      const b = randomSnapshot(rand);
      const merged = cardsOf(a, b);
      const ids = merged.map((c) => c.cardId);
      expect(new Set(ids).size, `seed ${seed}`).toBe(ids.length);
      for (const c of [...a.cards, ...b.cards]) expect(ids, `seed ${seed}`).toContain(c.cardId);
      expect(ids.every((id) => a.cards.some((c) => c.cardId === id) || b.cards.some((c) => c.cardId === id)), `seed ${seed}`).toBe(true);
    });
  });

  it('M2 earliest time: unlockedAt is the minimum of both sides', () => {
    forAll((rand, seed) => {
      const a = randomSnapshot(rand);
      const b = randomSnapshot(rand);
      const ma = byId(a.cards);
      const mb = byId(b.cards);
      for (const c of cardsOf(a, b)) {
        const times = [ma.get(c.cardId)?.unlockedAt, mb.get(c.cardId)?.unlockedAt].filter((t): t is string => t !== undefined);
        expect(c.unlockedAt, `seed ${seed}`).toBe([...times].sort()[0]);
      }
    });
  });

  it('M3 seen anywhere: newSinceLastView is true only when every side holding the card still has it new', () => {
    forAll((rand, seed) => {
      const a = randomSnapshot(rand);
      const b = randomSnapshot(rand);
      const ma = byId(a.cards);
      const mb = byId(b.cards);
      for (const c of cardsOf(a, b)) {
        const expected = (ma.get(c.cardId)?.newSinceLastView ?? true) && (mb.get(c.cardId)?.newSinceLastView ?? true);
        expect(c.newSinceLastView, `seed ${seed}`).toBe(expected);
      }
    });
  });

  it('M4 commutative: merge(a, b) and merge(b, a) hold the same cards', () => {
    forAll((rand, seed) => {
      const a = randomSnapshot(rand);
      const b = randomSnapshot(rand);
      expect(cardsOf(a, b), `seed ${seed}`).toEqual(cardsOf(b, a));
    });
  });

  it('M4 associative: merge(a, merge(b, c)) and merge(merge(a, b), c) hold the same cards', () => {
    forAll((rand, seed) => {
      const a = randomSnapshot(rand);
      const b = randomSnapshot(rand);
      const c = randomSnapshot(rand);
      const left = cardsOf(a, mergeSnapshots(b, c, { now: NOW }));
      const right = cardsOf(mergeSnapshots(a, b, { now: NOW }), c);
      expect(left, `seed ${seed}`).toEqual(right);
    });
  });

  it('M4 idempotent: merge(a, a) holds exactly the cards of a, sorted by cardId', () => {
    forAll((rand, seed) => {
      const a = randomSnapshot(rand);
      const sorted = [...a.cards].sort((x, y) => x.cardId.localeCompare(y.cardId));
      expect(cardsOf(a, a), `seed ${seed}`).toEqual(sorted);
    });
  });

  it('M5 (merge side): a quest completed on either side is completed in the merge, at the earliest time', () => {
    // Reconcile is a monotone function of the completed quests (F-STORY-006 §3.6 M5); the
    // merge keeps that input monotone, so reconcile(merge(a, b)) can only add cards.
    forAll((rand, seed) => {
      const a = randomSnapshot(rand);
      const b = randomSnapshot(rand);
      const merged = mergeSnapshots(a, b, { now: NOW });
      const done = new Map(merged.quests.filter((q) => q.completedAt).map((q) => [q.questId, q.completedAt]));
      for (const q of [...a.quests, ...b.quests]) {
        if (!q.completedAt) continue;
        const at = done.get(q.questId);
        expect(at, `seed ${seed}`).toBeDefined();
        expect((at ?? '') <= q.completedAt, `seed ${seed}`).toBe(true);
      }
    });
  });
});

describe('placements (F-PLC-001 section 3.8)', () => {
  const p = (id: string, completedAt: string, over: Parameters<typeof placementResult>[0] = {}) =>
    placementResult({ id, completedAt, ...over });

  it('withSnapshotDefaults gives a legacy snapshot an empty list and keeps an existing one', () => {
    const legacy = base();
    expect('placements' in legacy).toBe(false);
    expect(withSnapshotDefaults(legacy).placements).toEqual([]);
    const held = base({ placements: [p('placement:a', '2026-10-01T00:00:00Z')], selfRoute: null });
    expect(withSnapshotDefaults(held)).toBe(held);
    const partial = base({ placements: held.placements });
    expect(withSnapshotDefaults(partial).placements).toBe(held.placements);
  });

  it('keeps the snapshot shape when neither side has placements', () => {
    const m = mergeSnapshots(base(), base(), { now: NOW });
    expect('placements' in m).toBe(false);
  });

  it('unions by id, sorted by completedAt, with a legacy side read as empty', () => {
    const local = base({ placements: [p('placement:b', '2026-10-02T00:00:00Z')] });
    const server = base({ placements: [p('placement:a', '2026-10-01T00:00:00Z')] });
    expect(mergeSnapshots(local, server, { now: NOW }).placements?.map((r) => r.id)).toEqual(['placement:a', 'placement:b']);
    expect(mergeSnapshots(base(), server, { now: NOW }).placements?.map((r) => r.id)).toEqual(['placement:a']);
    expect(mergeSnapshots(local, base(), { now: NOW }).placements?.map((r) => r.id)).toEqual(['placement:b']);
  });

  it('for the same id the copy with an override wins, the later override.at when both carry one, else local', () => {
    const at = '2026-10-01T00:00:00Z';
    const plain = p('placement:a', at, { contentVer: 'local' });
    const serverPlain = p('placement:a', at, { contentVer: 'server' });
    const early = p('placement:a', at, { contentVer: 'early', override: { by: 'parent', at: '2026-10-03T00:00:00Z', startQuestId: 'quest:q2' } });
    const late = p('placement:a', at, { contentVer: 'late', override: { by: 'parent', at: '2026-10-04T00:00:00Z', startQuestId: 'quest:q3' } });
    const pick = (l: typeof plain, s: typeof plain) =>
      mergeSnapshots(base({ placements: [l] }), base({ placements: [s] }), { now: NOW }).placements?.[0]?.contentVer;
    expect(pick(plain, serverPlain)).toBe('local');
    expect(pick(plain, early)).toBe('early');
    expect(pick(early, plain)).toBe('early');
    expect(pick(early, late)).toBe('late');
    expect(pick(late, early)).toBe('late');
  });

  it('keeps only the newest PLACEMENT_KEEP results', () => {
    const many = Array.from({ length: PLACEMENT_KEEP + 2 }, (_, i) =>
      p(`placement:r${String(i).padStart(2, '0')}`, `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z`),
    );
    const m = mergeSnapshots(base({ placements: many.slice(0, 6) }), base({ placements: many.slice(6) }), { now: NOW });
    expect(m.placements).toHaveLength(PLACEMENT_KEEP);
    expect(m.placements?.[0]?.id).toBe('placement:r02');
    expect(m.placements?.[PLACEMENT_KEEP - 1]?.id).toBe(`placement:r${PLACEMENT_KEEP + 1}`);
  });

  it('isSubsetOf compares placement ids, treating a missing list as empty', () => {
    const one = base({ placements: [p('placement:a', '2026-10-01T00:00:00Z')] });
    expect(isSubsetOf(one, base())).toBe(false);
    expect(isSubsetOf(base(), one)).toBe(true);
    expect(isSubsetOf(one, one)).toBe(true);
    expect(isSubsetOf(base(), base())).toBe(true);
  });

  it('isSubsetOf needs an upload when the local copy carries a newer override than the server', () => {
    const at = '2026-10-01T00:00:00Z';
    const plain = base({ placements: [p('placement:a', at)] });
    const overridden = base({
      placements: [p('placement:a', at, { override: { by: 'parent', at: '2026-10-05T00:00:00Z', startQuestId: 'quest:q2' } })],
    });
    expect(isSubsetOf(overridden, plain)).toBe(false);
    expect(isSubsetOf(plain, overridden)).toBe(true);
    expect(isSubsetOf(overridden, overridden)).toBe(true);
  });

  it('orders results and overrides as instants, not strings (offset and Z forms, with or without milliseconds)', () => {
    // 01:30+02:00 is 23:30Z the day before: earlier than 00:00Z, though it sorts later as a string.
    const offset = p('placement:b', '2026-10-02T01:30:00+02:00');
    const zulu = p('placement:a', '2026-10-02T00:00:00.000Z');
    expect(mergeSnapshots(base({ placements: [zulu] }), base({ placements: [offset] }), { now: NOW }).placements?.map((r) => r.id)).toEqual([
      'placement:b',
      'placement:a',
    ]);
    const at = '2026-10-01T00:00:00Z';
    const localLater = p('placement:a', at, { contentVer: 'local', override: { by: 'parent', at: '2026-10-05T00:00:00Z', startQuestId: 'quest:q2' } });
    const serverEarlier = p('placement:a', at, { contentVer: 'server', override: { by: 'parent', at: '2026-10-05T01:00:00+02:00', startQuestId: 'quest:q3' } });
    expect(mergeSnapshots(base({ placements: [localLater] }), base({ placements: [serverEarlier] }), { now: NOW }).placements?.[0]?.contentVer).toBe('local');
    expect(isSubsetOf(base({ placements: [localLater] }), base({ placements: [serverEarlier] }))).toBe(false);
    expect(isSubsetOf(base({ placements: [serverEarlier] }), base({ placements: [localLater] }))).toBe(true);
  });

  it('breaks a completedAt tie by id in code-point order', () => {
    const at = '2026-10-01T00:00:00Z';
    const m = mergeSnapshots(base({ placements: [p('placement:a-b', at)] }), base({ placements: [p('placement:ab', at)] }), { now: NOW });
    expect(m.placements?.map((r) => r.id)).toEqual(['placement:a-b', 'placement:ab']);
  });
});

describe('compareInstant', () => {
  it('compares instants, then code points; an unparsable side sorts first', () => {
    expect(compareInstant('2026-10-01T00:00:00Z', '2026-10-01T00:00:01Z')).toBe(-1);
    expect(compareInstant('2026-10-01T02:00:00+02:00', '2026-10-01T00:00:00.500Z')).toBe(-1);
    expect(compareInstant('2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00Z')).toBe(-1);
    expect(compareInstant('2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')).toBe(0);
    expect(compareInstant('garbage', '2026-10-01T00:00:00Z')).toBe(-1);
    expect(compareInstant('2026-10-01T00:00:00Z', 'garbage')).toBe(1);
    expect(compareInstant('b', 'a')).toBe(1);
  });
});

describe('selfRoute, the learner weekly plan (F-PLAN-002 section 3.5)', () => {
  const legacy = (over: Record<string, unknown> = {}): ProgressSnapshot => {
    const snapshot: Record<string, unknown> = { ...base(), ...over };
    delete snapshot['selfRoute'];
    return snapshot as unknown as ProgressSnapshot;
  };

  it('withSnapshotDefaults fills a missing selfRoute with null and keeps a held one', () => {
    const filled = withSnapshotDefaults(legacy());
    expect(filled.selfRoute).toBeNull();
    expect(filled.placements).toEqual([]);
    const route = selfRoute();
    const held = base({ placements: [], selfRoute: route });
    expect(withSnapshotDefaults(held)).toBe(held);
    expect(withSnapshotDefaults(base({ placements: [] })).selfRoute).toBeNull();
    expect(withSnapshotDefaults(base({ selfRoute: route })).selfRoute).toBe(route);
  });

  it('keeps the snapshot shape when neither side has the key', () => {
    expect('selfRoute' in mergeSnapshots(legacy(), legacy(), { now: NOW })).toBe(false);
  });

  it('a missing or null side never replaces a held route', () => {
    const route = selfRoute();
    expect(mergeSnapshots(legacy(), base({ selfRoute: route }), { now: NOW }).selfRoute).toEqual(route);
    expect(mergeSnapshots(base({ selfRoute: route }), base({ selfRoute: null }), { now: NOW }).selfRoute).toEqual(route);
    expect(mergeSnapshots(base({ selfRoute: null }), legacy(), { now: NOW }).selfRoute).toBeNull();
  });

  it('keeps the route with the newest updatedAt as an instant; a tie keeps the local copy', () => {
    const older = selfRoute({ id: 'route:old', updatedAt: '2026-09-20T00:00:00.000Z' });
    const newer = selfRoute({ id: 'route:new', updatedAt: '2026-09-21T00:00:00.000Z' });
    expect(mergeSnapshots(base({ selfRoute: older }), base({ selfRoute: newer }), { now: NOW }).selfRoute?.id).toBe('route:new');
    expect(mergeSnapshots(base({ selfRoute: newer }), base({ selfRoute: older }), { now: NOW }).selfRoute?.id).toBe('route:new');
    const tieServer = selfRoute({ id: 'route:server', updatedAt: older.updatedAt });
    expect(mergeSnapshots(base({ selfRoute: older }), base({ selfRoute: tieServer }), { now: NOW }).selfRoute?.id).toBe('route:old');
    // 01:00+02:00 is 23:00Z the day before, so the Z form is newer although it sorts first as a string.
    const offset = selfRoute({ id: 'route:offset', updatedAt: '2026-09-21T01:00:00+02:00' });
    const zulu = selfRoute({ id: 'route:zulu', updatedAt: '2026-09-21T00:00:00.000Z' });
    expect(mergeSnapshots(base({ selfRoute: offset }), base({ selfRoute: zulu }), { now: NOW }).selfRoute?.id).toBe('route:zulu');
  });

  it('isSubsetOf compares id and updatedAt, treating a missing key as null', () => {
    const route = selfRoute();
    const edited = selfRoute({ updatedAt: '2026-09-22T00:00:00.000Z' });
    expect(isSubsetOf(base({ selfRoute: route }), legacy())).toBe(false);
    expect(isSubsetOf(base({ selfRoute: route }), base({ selfRoute: null }))).toBe(false);
    expect(isSubsetOf(base({ selfRoute: route }), base({ selfRoute: route }))).toBe(true);
    expect(isSubsetOf(base({ selfRoute: route }), base({ selfRoute: edited }))).toBe(true);
    expect(isSubsetOf(base({ selfRoute: edited }), base({ selfRoute: route }))).toBe(false);
    expect(isSubsetOf(base({ selfRoute: route }), base({ selfRoute: selfRoute({ id: 'route:other', updatedAt: edited.updatedAt }) }))).toBe(false);
    expect(isSubsetOf(legacy(), base({ selfRoute: route }))).toBe(true);
    expect(isSubsetOf(base({ selfRoute: null }), legacy())).toBe(true);
  });
});

describe('mergeVocab, the word progress slice (F-VOC-005 section 3.3)', () => {
  const ws = (over: Partial<VocabItemState> = {}): VocabItemState => ({
    id: 'vocab:sagwa-apple',
    first: '2026-10-01',
    seen: 3,
    right: 2,
    bestBox: 2,
    last: '2026-10-05',
    box: 2,
    due: '2026-10-08',
    at: '2026-10-05T10:00:00.000Z',
    ...over,
  });
  const vs = (items: VocabItemState[] = [], topics: VocabProgress['topics'] = []): VocabProgress => ({ v: 1, items, topics });
  const tp = (over: Partial<VocabTopicProgress> = {}): VocabTopicProgress => ({ topic: 'food', bestStars: 1, sessions: 2, last: '2026-10-05', bestCaught: 0, ...over });

  it('undefined on both sides stays undefined; one side undefined gives the other', () => {
    const a = vs([ws()]);
    expect(mergeVocab(undefined, undefined)).toBeUndefined();
    expect(mergeVocab(a, undefined)).toBe(a);
    expect(mergeVocab(undefined, a)).toBe(a);
  });

  it('a corrupt side counts as none (section 3.10)', () => {
    const a = vs([ws()]);
    const bad = vs([ws({ box: 9 })]);
    expect(mergeVocab(bad, a)).toBe(a);
    expect(mergeVocab(a, bad)).toBe(a);
    expect(mergeVocab(bad, bad)).toBeUndefined();
  });

  it('unions words and keeps every learner-visible field at its best (behaviour 6)', () => {
    const phone = vs([ws({ seen: 5, right: 2, bestBox: 3, box: 3, first: '2026-10-02', last: '2026-10-09' }), ws({ id: 'vocab:nun-eye' })]);
    const tablet = vs([ws({ seen: 4, right: 4, bestBox: 4, box: 4, first: '2026-10-01', last: '2026-10-07' }), ws({ id: 'vocab:mul-water' })]);
    const m = mergeVocab(phone, tablet);
    expect(m?.items.map((s) => s.id)).toEqual(['vocab:mul-water', 'vocab:nun-eye', 'vocab:sagwa-apple']);
    expect(m?.items[2]).toMatchObject({ seen: 5, right: 4, bestBox: 4, first: '2026-10-01', last: '2026-10-09' });
    expect(mergeVocab(tablet, phone)).toEqual(m);
  });

  it('the schedule comes from the later stamp, and a drop is never a loss (behaviour 7)', () => {
    const a = vs([ws({ box: 4, bestBox: 4, due: '2026-10-19', at: '2026-10-05T10:00:00.000Z' })]);
    const b = vs([ws({ box: 1, bestBox: 1, due: '2026-10-06', at: '2026-10-05T11:00:00.000Z' })]);
    const m = mergeVocab(a, b);
    expect(m?.items[0]).toMatchObject({ box: 1, due: '2026-10-06', at: '2026-10-05T11:00:00.000Z', bestBox: 4 });
    expect(mergeVocab(b, a)).toEqual(m);
  });

  it('stamps compare as instants, not as strings', () => {
    // 19:00+09:00 is 10:00Z: it sorts after 10:30Z as a string but is earlier.
    const a = vs([ws({ box: 2, at: '2026-10-05T19:00:00+09:00' })]);
    const b = vs([ws({ box: 3, bestBox: 3, at: '2026-10-05T10:30:00.000Z' })]);
    expect(mergeVocab(a, b)?.items[0]?.box).toBe(3);
    expect(mergeVocab(b, a)?.items[0]?.box).toBe(3);
  });

  it('on an equal stamp the higher box wins; on an equal box the later due (null earliest)', () => {
    const at = '2026-10-05T10:00:00.000Z';
    const hi = vs([ws({ box: 3, bestBox: 3, at })]);
    const lo = vs([ws({ box: 2, bestBox: 3, at })]);
    expect(mergeVocab(lo, hi)?.items[0]?.box).toBe(3);
    expect(mergeVocab(hi, lo)?.items[0]?.box).toBe(3);
    const later = vs([ws({ due: '2026-10-09', at })]);
    const earlier = vs([ws({ due: '2026-10-08', at })]);
    const none = vs([ws({ due: null, at })]);
    expect(mergeVocab(earlier, later)?.items[0]?.due).toBe('2026-10-09');
    expect(mergeVocab(later, earlier)?.items[0]?.due).toBe('2026-10-09');
    expect(mergeVocab(none, earlier)?.items[0]?.due).toBe('2026-10-08');
    expect(mergeVocab(earlier, none)?.items[0]?.due).toBe('2026-10-08');
    expect(mergeVocab(none, none)?.items[0]?.due).toBeNull();
  });

  it('topics union and every field is a max', () => {
    const a = vs([], [tp({ bestStars: 3, sessions: 2, last: '2026-10-09', bestCaught: 4 }), tp({ topic: 'animals' })]);
    const b = vs([], [tp({ bestStars: 1, sessions: 5, last: '2026-10-07', bestCaught: 9 })]);
    const m = mergeVocab(a, b);
    expect(m?.topics).toEqual([tp({ topic: 'animals' }), tp({ bestStars: 3, sessions: 5, last: '2026-10-09', bestCaught: 9 })]);
    expect(mergeVocab(b, a)).toEqual(m);
  });

  describe('properties over 500 seeded random triples', () => {
    const IDS = ['vocab:sagwa-apple', 'vocab:nun-eye', 'vocab:nun-snow', 'vocab:nuna-sister', 'vocab:mul-water', 'vocab:bae-pear'];
    const TOPICS = ['food', 'body', 'animals', 'school'];
    const STAMPS = ['2026-10-05T10:00:00.000Z', '2026-10-05T10:00:00Z', '2026-10-05T19:00:00+09:00', '2026-10-05T11:00:00.000Z', '2026-10-06T08:30:00.000Z'];
    const day = (rand: () => number): string => `2026-10-${String(1 + Math.floor(rand() * 20)).padStart(2, '0')}`;
    const pick = <T,>(rand: () => number, xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
    const randomSlice = (rand: () => number): VocabProgress => {
      const items = IDS.filter(() => rand() < 0.6).map((id): VocabItemState => {
        const box = 1 + Math.floor(rand() * 5);
        const seen = Math.floor(rand() * 8);
        const first = day(rand);
        const other = day(rand);
        return {
          id,
          first,
          last: other > first ? other : first,
          seen,
          right: Math.floor(rand() * (seen + 1)),
          box,
          bestBox: box + Math.floor(rand() * (6 - box)),
          due: rand() < 0.15 ? null : day(rand),
          at: pick(rand, STAMPS),
        };
      });
      const topics = TOPICS.filter(() => rand() < 0.5).map((topic) => ({
        topic,
        bestStars: Math.floor(rand() * 4),
        sessions: Math.floor(rand() * 6),
        last: day(rand),
        bestCaught: Math.floor(rand() * 12),
      }));
      return vs(items, topics);
    };
    const rand = seededRandom(5005);
    const triples = Array.from({ length: 500 }, () => [randomSlice(rand), randomSlice(rand), randomSlice(rand)] as const);

    it('commutative, associative and idempotent', () => {
      for (const [a, b, c] of triples) {
        expect(mergeVocab(a, b)).toEqual(mergeVocab(b, a));
        expect(mergeVocab(mergeVocab(a, b), c)).toEqual(mergeVocab(a, mergeVocab(b, c)));
        const aa = mergeVocab(a, a);
        expect(mergeVocab(aa, a)).toEqual(aa);
        expect(aa?.items).toEqual([...a.items].sort((x, y) => (x.id < y.id ? -1 : 1)));
      }
    });

    it('every monotonic field is at least as good as on either side, and the result passes the schema', () => {
      for (const [a, b] of triples) {
        const m = mergeVocab(a, b) as VocabProgress;
        expect(VocabProgressSchema.safeParse(m).success).toBe(true);
        for (const side of [a, b]) {
          for (const s of side.items) {
            const got = m.items.find((x) => x.id === s.id);
            expect(got).toBeDefined();
            expect(got!.bestBox).toBeGreaterThanOrEqual(s.bestBox);
            expect(got!.seen).toBeGreaterThanOrEqual(s.seen);
            expect(got!.right).toBeGreaterThanOrEqual(s.right);
            expect(got!.first <= s.first).toBe(true);
            expect(got!.last >= s.last).toBe(true);
          }
          for (const t of side.topics) {
            const got = m.topics.find((x) => x.topic === t.topic);
            expect(got).toBeDefined();
            expect(got!.bestStars).toBeGreaterThanOrEqual(t.bestStars);
            expect(got!.sessions).toBeGreaterThanOrEqual(t.sessions);
            expect(got!.bestCaught).toBeGreaterThanOrEqual(t.bestCaught);
            expect(got!.last >= t.last).toBe(true);
          }
        }
      }
    });

    it('a server copy that merged the local one always covers it', () => {
      for (const [a, b] of triples) {
        const server = base({ vocab: mergeVocab(a, b) });
        expect(isSubsetOf(base({ vocab: a }), server)).toBe(true);
        expect(isSubsetOf(base({ vocab: b }), server)).toBe(true);
      }
    });
  });

  describe('mergeSnapshots and isSubsetOf', () => {
    it('omits vocab when neither side has it, so an old snapshot keeps its shape', () => {
      const m = mergeSnapshots(base(), base(), { now: NOW });
      expect('vocab' in m).toBe(false);
    });

    it('merges vocab when either side has it', () => {
      const a = vs([ws()]);
      expect(mergeSnapshots(base(), base({ vocab: a }), { now: NOW }).vocab).toEqual(a);
      expect(mergeSnapshots(base({ vocab: a }), base(), { now: NOW }).vocab).toEqual(a);
      const b = vs([ws({ id: 'vocab:nun-eye' })]);
      expect(mergeSnapshots(base({ vocab: a }), base({ vocab: b }), { now: NOW }).vocab?.items).toHaveLength(2);
    });

    it('no local vocab is always covered; a local slice the server lacks is not', () => {
      expect(isSubsetOf(base(), base({ vocab: vs([ws()]) }))).toBe(true);
      expect(isSubsetOf(base({ vocab: vs() }), base())).toBe(false);
      expect(isSubsetOf(base({ vocab: vs([ws()]) }), base({ vocab: vs() }))).toBe(false);
    });

    it('needs an upload when the server is behind on any word field or the schedule', () => {
      const local = base({ vocab: vs([ws()]) });
      const server = (over: Partial<VocabItemState>) => base({ vocab: vs([ws(over)]) });
      expect(isSubsetOf(local, server({}))).toBe(true);
      expect(isSubsetOf(local, server({ seen: 4, right: 3, bestBox: 3, box: 3, at: '2026-10-06T10:00:00.000Z', first: '2026-09-30', last: '2026-10-06' }))).toBe(true);
      expect(isSubsetOf(local, server({ at: '2026-10-05T09:00:00.000Z' }))).toBe(false);
      expect(isSubsetOf(local, server({ box: 1, bestBox: 2 }))).toBe(false);
      expect(isSubsetOf(local, server({ due: '2026-10-07' }))).toBe(false);
      expect(isSubsetOf(local, server({ seen: 2 }))).toBe(false);
      expect(isSubsetOf(local, server({ right: 1 }))).toBe(false);
      expect(isSubsetOf(base({ vocab: vs([ws({ bestBox: 3 })]) }), server({}))).toBe(false);
      expect(isSubsetOf(local, server({ first: '2026-10-02' }))).toBe(false);
      expect(isSubsetOf(local, server({ last: '2026-10-04' }))).toBe(false);
    });

    it('needs an upload when the server lacks a topic or is behind on one', () => {
      const local = base({ vocab: vs([], [tp()]) });
      const server = (topics: VocabTopicProgress[]) => base({ vocab: vs([], topics) });
      expect(isSubsetOf(local, server([tp({ sessions: 3, last: '2026-10-06' })]))).toBe(true);
      expect(isSubsetOf(local, server([]))).toBe(false);
      expect(isSubsetOf(local, server([tp({ bestStars: 0 })]))).toBe(false);
      expect(isSubsetOf(local, server([tp({ sessions: 1 })]))).toBe(false);
      expect(isSubsetOf(local, server([tp({ last: '2026-10-04' })]))).toBe(false);
      expect(isSubsetOf(base({ vocab: vs([], [tp({ bestCaught: 2 })]) }), server([tp()]))).toBe(false);
    });
  });
});

describe('rebaseSnapshot (issue #262: a write that lands while a sync is in flight)', () => {
  // base = what went up; theirs = the server's answer, which already holds base;
  // ours = base plus the writes made while the request was in flight.
  it('keeps the writes made after base and everything theirs added', () => {
    const sent = base({ quests: [quest('q1', 2, 0.7)] });
    const theirs = base({ quests: [quest('q1', 2, 0.7), quest('q2', 1, 0.5)], updatedAt: '2026-09-20T02:00:00.000Z' });
    const ours = base({
      quests: [quest('q1', 2, 0.7), quest('q3', 3, 1)],
      cards: [{ cardId: 'card:a', unlockedAt: '2026-09-20T03:00:00Z', newSinceLastView: true }],
      sessions: [session('s1', '2026-09-20T03:00:00Z')],
      updatedAt: '2026-09-20T03:00:00.000Z',
    });
    const m = rebaseSnapshot(sent, ours, theirs, { now: NOW });
    expect(m.quests.map((q) => q.questId)).toEqual(['q1', 'q2', 'q3']);
    expect(m.cards.map((c) => c.cardId)).toEqual(['card:a']);
    expect(m.sessions.map((s) => s.id)).toEqual(['s1']);
    expect(m.updatedAt).toBe('2026-09-20T03:00:00.000Z');
  });

  it('counts each attempt once: the attempts base gave theirs are not summed twice', () => {
    const sent = base({ quests: [quest('q1', 2, 0.7, 3)] });
    // The server held 2 attempts from another device; theirs = 3 + 2.
    const theirs = base({ quests: [quest('q1', 2, 0.7, 5)] });
    // One more run on this device during the request: 3 + 1, now 3 stars.
    const ours = base({ quests: [quest('q1', 3, 0.95, 4)] });
    const q1 = rebaseSnapshot(sent, ours, theirs, { now: NOW }).quests[0];
    expect(q1?.attempts).toBe(6);
    expect(q1?.stars).toBe(3);
    // No write in between: the result is theirs, attempts unchanged.
    expect(rebaseSnapshot(sent, sent, theirs, { now: NOW }).quests[0]?.attempts).toBe(5);
  });

  it('a card seen during the request stays seen; a quest new on both sides sums both runs', () => {
    const card = { cardId: 'card:a', unlockedAt: '2026-09-20T00:00:00Z', newSinceLastView: true };
    const sent = base({ cards: [card] });
    const theirs = base({ cards: [card], quests: [quest('q9', 1, 0.5, 2)] });
    const ours = base({ cards: [{ ...card, newSinceLastView: false }], quests: [quest('q9', 2, 0.8, 1)] });
    const m = rebaseSnapshot(sent, ours, theirs, { now: NOW });
    expect(m.cards[0]?.newSinceLastView).toBe(false);
    expect(m.quests[0]).toMatchObject({ questId: 'q9', stars: 2, attempts: 3 });
  });

  it('never subtracts below what ours holds when theirs lacks the quest', () => {
    const sent = base({ quests: [quest('q1', 2, 0.7, 3)] });
    const ours = base({ quests: [quest('q1', 2, 0.7, 4)] });
    expect(rebaseSnapshot(sent, ours, base(), { now: NOW }).quests[0]?.attempts).toBe(4);
  });

  it('a quest replayed during the request keeps its new completedAt; a merge between devices still keeps the earliest', () => {
    const sent = base({ quests: [quest('q1', 2, 0.7, 1, '2026-09-18T09:00:00.000Z')] });
    const theirs = base({ quests: [quest('q1', 2, 0.7, 1, '2026-09-18T09:00:00.000Z'), quest('q2', 1, 0.5, 1, '2026-09-17T09:00:00.000Z')] });
    // Replayed today while the request was in flight (recordBestQuest moves completedAt to the latest finish).
    const ours = base({ quests: [quest('q1', 2, 0.8, 2, '2026-10-11T10:00:00.000Z')] });
    const m = rebaseSnapshot(sent, ours, theirs, { now: NOW });
    expect(m.quests.find((q) => q.questId === 'q1')?.completedAt).toBe('2026-10-11T10:00:00.000Z');
    // Untouched by the write: the server's dates stand.
    expect(m.quests.find((q) => q.questId === 'q2')?.completedAt).toBe('2026-09-17T09:00:00.000Z');
    // No write in between: theirs' date stands even when it is earlier than base's.
    const older = base({ quests: [quest('q1', 2, 0.7, 2, '2026-09-10T09:00:00.000Z')] });
    expect(rebaseSnapshot(sent, sent, older, { now: NOW }).quests[0]?.completedAt).toBe('2026-09-10T09:00:00.000Z');
  });

  it('a quest first finished during the request keeps its completedAt over an earlier one from another device', () => {
    const sent = base();
    const theirs = base({ quests: [quest('q5', 1, 0.5, 1, '2026-09-15T09:00:00.000Z')] });
    const ours = base({ quests: [quest('q5', 3, 1, 1, '2026-10-11T10:00:00.000Z')] });
    expect(rebaseSnapshot(sent, ours, theirs, { now: NOW }).quests[0]).toMatchObject({ completedAt: '2026-10-11T10:00:00.000Z', attempts: 2, stars: 3 });
  });
});
