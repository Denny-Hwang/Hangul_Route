import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { mergeWithStored } from '../stored-merge';

// [AU] AMENDMENTS-AUDIT-2026-11 row AU-11 (audit FUNC-1): two tabs write the same learner's snapshot.

const NOW = new Date('2026-11-16T12:00:00.000Z');
const snap = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
  profileId: 'profile:a',
  updatedAt: '2026-11-16T09:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
  questDoneAt: {},
  ...over,
});
const quest = (questId: string, stars: 0 | 1 | 2 | 3, attempts = 1, completedAt = '2026-11-16T09:00:00.000Z') => ({
  questId,
  episodeId: 'episode:x',
  startedAt: '2026-11-16T08:00:00.000Z',
  completedAt,
  stars,
  attempts,
  accuracy: stars / 3,
});
const card = (cardId: string, newSinceLastView = true) => ({ cardId, unlockedAt: '2026-11-16T09:00:00.000Z', newSinceLastView });
const hw = (id: string, completedAt?: string) => ({
  id,
  profileId: 'profile:a',
  questId: `quest:${id}`,
  episodeId: 'episode:x',
  assignedBy: 'system' as const,
  assignedAt: '2026-11-10T00:00:00.000Z',
  targetDate: '2026-11-17',
  ...(completedAt ? { completedAt } : {}),
});

describe('mergeWithStored (row AU-11)', () => {
  const base = snap({ quests: [quest('q1', 2, 3)], cards: [card('card:a')], homework: [hw('h1'), hw('h2')] });

  it('keeps the quest, the card and the latch each tab earned since the copy both started from', () => {
    const ours = snap({ ...base, quests: [...base.quests, quest('q2', 3)], cards: [...base.cards, card('card:b')], questDoneAt: { q2: '2026-11-16T10:00:00.000Z' } });
    const theirs = snap({ ...base, quests: [...base.quests, quest('q3', 1)], cards: [...base.cards, card('card:c')], questDoneAt: { q3: '2026-11-16T10:30:00.000Z' } });
    const merged = mergeWithStored(base, ours, theirs, { now: NOW });
    expect(merged.quests.map((q) => q.questId)).toEqual(['q1', 'q2', 'q3']);
    expect(merged.cards.map((c) => c.cardId)).toEqual(['card:a', 'card:b', 'card:c']);
    expect(merged.questDoneAt).toEqual({ q2: '2026-11-16T10:00:00.000Z', q3: '2026-11-16T10:30:00.000Z' });
  });

  it('stars never go down, whichever tab holds the better run, and an attempt already in the shared copy counts once', () => {
    const ours = snap({ ...base, quests: [quest('q1', 3, 4)] });
    const theirs = snap({ ...base, quests: [quest('q1', 1, 5)] });
    for (const merged of [mergeWithStored(base, ours, theirs, { now: NOW }), mergeWithStored(base, theirs, ours, { now: NOW })]) {
      expect(merged.quests).toHaveLength(1);
      expect(merged.quests[0]?.stars).toBe(3);
      // 3 in the shared copy, 1 more here, 2 more there.
      expect(merged.quests[0]?.attempts).toBe(6);
    }
  });

  it('a card seen in either tab is seen', () => {
    const ours = snap({ ...base, cards: [card('card:a', false)] });
    const theirs = snap({ ...base, cards: [card('card:a'), card('card:b')] });
    expect(mergeWithStored(base, ours, theirs, { now: NOW }).cards).toEqual([card('card:a', false), card('card:b')]);
  });

  it('a homework item this tab took out on purpose (the plan reconcile) stays out; one finished in the other tab stays finished', () => {
    const ours = snap({ ...base, homework: [hw('h2')], cards: [...base.cards, card('card:b')] });
    const theirs = snap({ ...base, homework: [hw('h1'), hw('h2', '2026-11-16T11:00:00.000Z')] });
    expect(mergeWithStored(base, ours, theirs, { now: NOW }).homework).toEqual([hw('h2', '2026-11-16T11:00:00.000Z')]);
  });

  it('a homework item the other tab took out stays out, and one either tab added is kept', () => {
    const ours = snap({ ...base, homework: [hw('h1'), hw('h2'), hw('h3')] });
    const theirs = snap({ ...base, homework: [hw('h1'), hw('h4')] });
    expect(mergeWithStored(base, ours, theirs, { now: NOW }).homework.map((h) => h.id)).toEqual(['h1', 'h3', 'h4']);
  });

  it('with no shared copy it is still a union, with attempts at the higher count rather than the sum', () => {
    const ours = snap({ quests: [quest('q1', 2, 3), quest('q2', 3, 1)], homework: [hw('h1')] });
    const theirs = snap({ quests: [quest('q1', 3, 2), quest('q3', 1, 4)], cards: [card('card:a')], homework: [hw('h2')] });
    const merged = mergeWithStored(null, ours, theirs, { now: NOW });
    expect(merged.quests.map((q) => [q.questId, q.stars, q.attempts])).toEqual([
      ['q1', 3, 3],
      ['q2', 3, 1],
      ['q3', 1, 4],
    ]);
    expect(merged.cards.map((c) => c.cardId)).toEqual(['card:a']);
    expect(merged.homework.map((h) => h.id)).toEqual(['h1', 'h2']);
  });

  it('a replay finished here after the shared copy keeps its new finish time (Home reads "done today" from it)', () => {
    const ours = snap({ ...base, quests: [quest('q1', 2, 4, '2026-11-16T11:30:00.000Z')] });
    const theirs = snap({ ...base, cards: [...base.cards, card('card:b')] });
    expect(mergeWithStored(base, ours, theirs, { now: NOW }).quests[0]?.completedAt).toBe('2026-11-16T11:30:00.000Z');
  });
});
