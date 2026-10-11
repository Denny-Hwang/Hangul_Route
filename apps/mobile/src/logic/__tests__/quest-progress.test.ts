import type { QuestProgress } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { recordBestQuest } from '../quest-progress';

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
