import { ProgressSnapshotSchema, type ProgressSnapshot, type QuestProgress } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { latchQuests, recordBestQuest } from '../quest-progress';

const NOW = '2026-10-10T12:00:00.000Z';

const run = (stars: 0 | 1 | 2 | 3, accuracy: number) => ({
  questId: 'quest:a',
  episodeId: 'episode:e',
  stars,
  accuracy,
  attempts: 1,
});

const saved = (over: Partial<QuestProgress> = {}): QuestProgress => ({
  questId: 'quest:a',
  episodeId: 'episode:e',
  startedAt: '2026-10-01T09:00:00.000Z',
  completedAt: '2026-10-01T09:05:00.000Z',
  stars: 2,
  attempts: 1,
  accuracy: 0.8,
  ...over,
});

describe('recordBestQuest', () => {
  it('stores the first finish as is', () => {
    expect(recordBestQuest(undefined, run(2, 0.8), NOW)).toEqual({
      questId: 'quest:a',
      episodeId: 'episode:e',
      startedAt: NOW,
      completedAt: NOW,
      stars: 2,
      attempts: 1,
      accuracy: 0.8,
    });
  });

  it('a replay with fewer stars keeps the stars and the accuracy that earned them', () => {
    const next = recordBestQuest(saved({ stars: 3, accuracy: 1 }), run(1, 0.3), NOW);
    expect(next.stars).toBe(3);
    expect(next.accuracy).toBe(1);
  });

  it('a replay with zero stars never lowers a saved star', () => {
    expect(recordBestQuest(saved({ stars: 1, accuracy: 0.3 }), run(0, 0), NOW).stars).toBe(1);
  });

  it('a replay with more stars raises the result', () => {
    const next = recordBestQuest(saved({ stars: 2, accuracy: 0.9 }), run(3, 0.96), NOW);
    expect(next.stars).toBe(3);
    expect(next.accuracy).toBe(0.96);
  });

  it('on equal stars the higher accuracy wins', () => {
    expect(recordBestQuest(saved({ accuracy: 0.7 }), run(2, 0.9), NOW).accuracy).toBe(0.9);
    expect(recordBestQuest(saved({ accuracy: 0.9 }), run(2, 0.7), NOW).accuracy).toBe(0.9);
  });

  it('on equal stars and accuracy nothing changes in the result', () => {
    const next = recordBestQuest(saved(), run(2, 0.8), NOW);
    expect(next.stars).toBe(2);
    expect(next.accuracy).toBe(0.8);
  });

  it('adds to attempts and keeps the earliest startedAt', () => {
    const next = recordBestQuest(saved({ attempts: 4 }), run(1, 0.3), NOW);
    expect(next.attempts).toBe(5);
    expect(next.startedAt).toBe('2026-10-01T09:00:00.000Z');
  });

  it('completedAt moves to the latest finish', () => {
    expect(recordBestQuest(saved(), run(1, 0.3), NOW).completedAt).toBe(NOW);
  });

  it('completedAt never moves back if the clock is behind the saved finish', () => {
    const future = '2027-01-01T00:00:00.000Z';
    expect(recordBestQuest(saved({ completedAt: future }), run(1, 0.3), NOW).completedAt).toBe(future);
  });

  it('repeating the same result leaves stars and accuracy unchanged', () => {
    const once = recordBestQuest(saved(), run(3, 1), NOW);
    const twice = recordBestQuest(once, run(3, 1), NOW);
    expect(twice.stars).toBe(3);
    expect(twice.accuracy).toBe(1);
  });

  it('legacy snapshot: a saved record with no completedAt keeps its stars on a lower replay', () => {
    const legacy: QuestProgress = {
      questId: 'quest:a',
      episodeId: 'episode:e',
      startedAt: '2026-09-01T09:00:00.000Z',
      stars: 3,
      attempts: 0,
      accuracy: 1,
    };
    const next = recordBestQuest(legacy, run(1, 0.3), NOW);
    expect(next.stars).toBe(3);
    expect(next.accuracy).toBe(1);
    expect(next.startedAt).toBe('2026-09-01T09:00:00.000Z');
    expect(next.completedAt).toBe(NOW);
    expect(next.attempts).toBe(1);
  });
});

describe('latchQuests, the quest latch writer (F-REPORT-001 section 3.3.1, M5)', () => {
  const snapshot = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
    profileId: 'p1',
    updatedAt: '2026-10-01T09:05:00.000Z',
    episodes: [],
    quests: [],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    ...over,
  });
  const done = (questId: string, completedAt: string | undefined): QuestProgress => saved({ questId, completedAt });

  it('backfills every completed quest without an entry from its completedAt, once', () => {
    const before = snapshot({ quests: [done('quest:a', '2026-10-01T09:05:00.000Z'), done('quest:b', '2026-10-03T10:00:00.000Z')] });
    const after = latchQuests(before);
    expect(after.questDoneAt).toEqual({ 'quest:a': '2026-10-01T09:05:00.000Z', 'quest:b': '2026-10-03T10:00:00.000Z' });
    // a second pass adds nothing and returns the same snapshot
    expect(latchQuests(after)).toBe(after);
  });

  it('never moves an entry later: a replay that moved completedAt keeps the first finish', () => {
    const before = snapshot({ quests: [done('quest:a', '2026-10-09T08:00:00.000Z')], questDoneAt: { 'quest:a': '2026-10-01T09:05:00.000Z' } });
    expect(latchQuests(before)).toBe(before);
  });

  it('keeps entries for quests it does not hold (another device or before a reset)', () => {
    const before = snapshot({ quests: [done('quest:b', '2026-10-03T10:00:00.000Z')], questDoneAt: { 'quest:a': '2026-10-01T09:05:00.000Z' } });
    expect(latchQuests(before).questDoneAt).toEqual({ 'quest:a': '2026-10-01T09:05:00.000Z', 'quest:b': '2026-10-03T10:00:00.000Z' });
  });

  it('always writes the key: an empty record when nothing is finished', () => {
    const before = snapshot({ quests: [done('quest:a', undefined)] });
    expect(latchQuests(before).questDoneAt).toEqual({});
    const held = snapshot({ questDoneAt: {} });
    expect(latchQuests(held)).toBe(held);
  });

  it('leaves updatedAt alone, so the backfill never reads as practice today (lastActiveAt)', () => {
    const before = snapshot({ quests: [done('quest:a', '2026-10-01T09:05:00.000Z')] });
    expect(latchQuests(before).updatedAt).toBe(before.updatedAt);
  });

  it('writes only what the Worker accepts: ids of 1-64 characters, times of 1-40 characters that parse', () => {
    const long = `quest:${'x'.repeat(59)}`;
    expect(long).toHaveLength(65);
    const before = snapshot({
      quests: [
        done(long, '2026-10-01T09:05:00.000Z'),
        done('', '2026-10-01T09:05:00.000Z'),
        done('quest:junk', 'soon'),
        done('quest:empty', ''),
        done('quest:offset', '2026-10-01T18:05:00.000+09:00'),
        done('quest:too-long', `2026-10-01T09:05:00.000Z${' '.repeat(17)}`),
      ],
    });
    const after = latchQuests(before);
    expect(after.questDoneAt).toEqual({ 'quest:offset': '2026-10-01T18:05:00.000+09:00' });
    expect(ProgressSnapshotSchema.safeParse(after).success).toBe(true);
  });

  it('a quest listed twice keeps the earlier finish, whatever the order', () => {
    const early = done('quest:a', '2026-10-01T09:05:00.000Z');
    const late = done('quest:a', '2026-10-05T09:05:00.000Z');
    expect(latchQuests(snapshot({ quests: [early, late] })).questDoneAt).toEqual({ 'quest:a': '2026-10-01T09:05:00.000Z' });
    expect(latchQuests(snapshot({ quests: [late, early] })).questDoneAt).toEqual({ 'quest:a': '2026-10-01T09:05:00.000Z' });
  });

  it('is never later than the quest\'s own finish: a merge that brought an earlier completedAt pulls the entry back', () => {
    // Device B backfilled a replay time; the sync merge then kept device A's earlier finish as completedAt.
    const before = snapshot({ quests: [done('quest:a', '2026-10-01T09:05:00.000Z')], questDoneAt: { 'quest:a': '2026-10-09T08:00:00.000Z' } });
    expect(latchQuests(before).questDoneAt).toEqual({ 'quest:a': '2026-10-01T09:05:00.000Z' });
    // instants, not strings: 18:00+09:00 is 09:00Z, earlier than 09:05Z
    const offset = snapshot({ quests: [done('quest:a', '2026-10-01T18:00:00.000+09:00')], questDoneAt: { 'quest:a': '2026-10-01T09:05:00.000Z' } });
    expect(latchQuests(offset).questDoneAt).toEqual({ 'quest:a': '2026-10-01T18:00:00.000+09:00' });
    // an entry that does not name an instant gives way to a real finish
    const junk = snapshot({ quests: [done('quest:a', '2026-10-01T09:05:00.000Z')], questDoneAt: { 'quest:a': 'soon' } });
    expect(latchQuests(junk).questDoneAt).toEqual({ 'quest:a': '2026-10-01T09:05:00.000Z' });
  });

  it('drops a held entry the Worker would refuse, so one bad entry never blocks every later sync', () => {
    const before = {
      ...snapshot({ quests: [done('quest:b', '2026-10-03T10:00:00.000Z')] }),
      questDoneAt: { 'quest:a': '2026-10-01T09:05:00.000Z', 'quest:n': 123, '': '2026-10-01T09:05:00.000Z', [`q${'x'.repeat(64)}`]: '2026-10-01T09:05:00.000Z', 'quest:long': 'x'.repeat(41), 'quest:empty': '' },
    } as unknown as ProgressSnapshot;
    const after = latchQuests(before);
    expect(after.questDoneAt).toEqual({ 'quest:a': '2026-10-01T09:05:00.000Z', 'quest:b': '2026-10-03T10:00:00.000Z' });
    expect(ProgressSnapshotSchema.safeParse(after).success).toBe(true);
    // a held entry within the bounds that is not a time is kept: the Worker accepts it and the merge ranks it last
    const odd = snapshot({ questDoneAt: { 'quest:x': 'soon' } });
    expect(latchQuests(odd)).toBe(odd);
  });

  it('a key that names an Object.prototype member is still a quest to latch', () => {
    const before = snapshot({ quests: [done('constructor', '2026-10-01T09:05:00.000Z')] });
    expect(latchQuests(before).questDoneAt).toEqual({ constructor: '2026-10-01T09:05:00.000Z' });
  });

  it('never throws on a malformed saved record: it is returned unchanged', () => {
    const noQuests = { ...snapshot(), quests: undefined } as unknown as ProgressSnapshot;
    expect(latchQuests(noQuests)).toBe(noQuests);
    const badQuest = { ...snapshot(), quests: [null] } as unknown as ProgressSnapshot;
    expect(latchQuests(badQuest)).toBe(badQuest);
  });

  it('a latch that is not a record is rebuilt from the quests', () => {
    for (const junk of [null, [], 'x', 3]) {
      const before = { ...snapshot({ quests: [done('quest:a', '2026-10-01T09:05:00.000Z')] }), questDoneAt: junk } as unknown as ProgressSnapshot;
      expect(latchQuests(before).questDoneAt).toEqual({ 'quest:a': '2026-10-01T09:05:00.000Z' });
    }
  });
});
