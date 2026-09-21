import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { isSubsetOf, mergeSnapshots } from '../merge';

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

  it('same stars → higher accuracy wins; cards keep earliest unlock and local newSinceLastView', () => {
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

  it('unions sessions by id, sorts them, and recomputes the streak from the union', () => {
    const local = base({ sessions: [session('s2', '2026-09-21T09:00:00Z')] });
    const server = base({ sessions: [session('s1', '2026-09-20T09:00:00Z'), session('s2', '2026-09-21T09:00:00Z')] });
    const m = mergeSnapshots(local, server, { now: NOW });
    expect(m.sessions.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(m.streakDays).toBe(2);
    expect(m.updatedAt).toBe('2026-09-20T00:00:00.000Z');
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
});
