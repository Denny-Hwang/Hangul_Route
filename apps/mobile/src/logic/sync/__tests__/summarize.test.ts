import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { planProgressOf, summarize } from '../summarize';

const NOW = new Date('2026-09-21T12:00:00.000Z');
const snap: ProgressSnapshot = {
  profileId: 'profile:a',
  updatedAt: '2026-09-20T00:00:00.000Z',
  episodes: [],
  quests: [
    { questId: 'q1', episodeId: 'e', startedAt: 't', completedAt: 't', stars: 3, attempts: 1, accuracy: 1 },
    { questId: 'q2', episodeId: 'e', startedAt: 't', completedAt: 't', stars: 1, accuracy: 0.4, attempts: 3 },
    { questId: 'q3', episodeId: 'e', startedAt: 't', stars: 0, accuracy: 0, attempts: 0 },
    { questId: 'stage2', episodeId: 'e2', startedAt: 't', completedAt: 't', stars: 2, accuracy: 0.7, attempts: 1 },
  ],
  cards: [{ cardId: 'c1', unlockedAt: 't', newSinceLastView: true }],
  sessions: [
    { id: 's-old', profileId: 'profile:a', startedAt: '2026-09-01T00:00:00Z', durationSeconds: 600, episodesTouched: [] },
    { id: 's-new', profileId: 'profile:a', startedAt: '2026-09-20T10:00:00Z', durationSeconds: 900, episodesTouched: [] },
    { id: 's-latest', profileId: 'profile:a', startedAt: '2026-09-21T10:00:00Z', durationSeconds: 300, episodesTouched: [] },
  ],
  homework: [],
  reviews: [],
  streakDays: 2,
};

describe('summarize (F-SYNC-001 §3.4)', () => {
  const summary = summarize({
    snapshot: snap,
    now: NOW,
    stage1QuestIds: ['q1', 'q2', 'q3'],
    questJamo: { q1: ['ㄱ', 'ㄴ'], q2: ['ㄴ', 'ㄷ'], stage2: ['ㅁ'] },
  });

  it('counts only completed Stage 1 quests and averages their accuracy', () => {
    expect(summary.stage1).toEqual({ questsDone: 2, questsTotal: 3, anchorAccuracy: 0.7 });
  });
  it('sums minutes from the last 7 days only', () => {
    expect(summary.minutesLast7d).toBe(20);
  });
  it('lists recognized jamo (≥ 0.8) and practice jamo (< 0.6) minus recognized ones', () => {
    expect(summary.jamoRecognized).toEqual(['ㄱ', 'ㄴ']);
    expect(summary.needsPractice).toEqual(['ㄷ']);
  });
  it('takes the latest activity timestamp and passes through cards / streak', () => {
    expect(summary.lastActiveAt).toBe('2026-09-21T10:00:00Z');
    expect(summary.cardsUnlocked).toBe(1);
    expect(summary.streakDays).toBe(2);
    expect(summary.planProgress).toEqual({});
  });
  it('empty snapshot → null anchor accuracy and zeros', () => {
    const empty = summarize({ snapshot: { ...snap, quests: [], sessions: [], cards: [] }, now: NOW, stage1QuestIds: ['q1'], questJamo: {} });
    expect(empty.stage1.anchorAccuracy).toBeNull();
    expect(empty.minutesLast7d).toBe(0);
    expect(empty.lastActiveAt).toBe(snap.updatedAt);
  });
});

describe('plan progress (F-PLAN-001 §3.3)', () => {
  it('counts plan-derived assignments per plan and reports skipped items', () => {
    const withPlans: ProgressSnapshot = {
      ...snap,
      homework: [
        { id: 'plan:w3#q1', profileId: 'profile:a', questId: 'q1', episodeId: 'e', assignedBy: 'teacher', assignedAt: 't', targetDate: '2026-09-21', completedAt: 't' },
        { id: 'plan:w3#q2', profileId: 'profile:a', questId: 'q2', episodeId: 'e', assignedBy: 'teacher', assignedAt: 't', targetDate: '2026-09-21' },
        { id: 'plan:fam#q1', profileId: 'profile:a', questId: 'q1', episodeId: 'e', assignedBy: 'parent', assignedAt: 't', targetDate: '2026-09-21' },
        { id: 'hw:parent-1', profileId: 'profile:a', questId: 'q3', episodeId: 'e', assignedBy: 'parent', assignedAt: 't', targetDate: '2026-09-21' },
      ],
    };
    expect(planProgressOf(withPlans, { 'plan:w3': 1, 'plan:other': 2, 'plan:zero': 0 })).toEqual({
      'plan:w3': { done: 1, total: 2, notReady: 1 },
      'plan:fam': { done: 0, total: 1, notReady: 0 },
      'plan:other': { done: 0, total: 0, notReady: 2 },
    });
    const full = summarize({ snapshot: withPlans, now: NOW, stage1QuestIds: ['q1'], questJamo: {}, planNotReady: { 'plan:w3': 1 } });
    expect(full.planProgress['plan:w3']).toEqual({ done: 1, total: 2, notReady: 1 });
    expect(summarize({ snapshot: snap, now: NOW, stage1QuestIds: [], questJamo: {} }).planProgress).toEqual({});
  });
});
