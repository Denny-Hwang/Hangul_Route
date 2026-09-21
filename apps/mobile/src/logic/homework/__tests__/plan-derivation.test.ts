import type { Episode, InboxPlan, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { deriveAssignments, planAssignmentId, planIdOf } from '../plan-derivation';

const quest = (id: string): Quest => ({ id, titleEn: id, estimatedMinutes: 4, steps: [
  { id: 's1', kind: 'intro', titleEn: 'a', durationSeconds: 5 },
  { id: 's2', kind: 'present', titleEn: 'b', durationSeconds: 5 },
  { id: 's3', kind: 'reward', titleEn: 'c', durationSeconds: 5 },
] as Quest['steps'] });
const episodes: Episode[] = [
  { id: 'episode:s1', stage: 'stage1', theme: 'letters', order: 1, titleEn: 'E1', hoyaIntroEn: 'hi', questIds: ['quest:a', 'quest:b'], rewardCardIds: [], estimatedMinutes: 10, status: 'shipped' },
  { id: 'episode:s2', stage: 'stage2', theme: 'life', order: 2, titleEn: 'E2', hoyaIntroEn: 'hi', questIds: ['quest:c'], rewardCardIds: [], estimatedMinutes: 10, status: 'shipped' },
];
const quests = [quest('quest:a'), quest('quest:b'), quest('quest:c')];
const snap = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({ profileId: 'profile:a', updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over });
const plan = (over: Partial<InboxPlan> = {}): InboxPlan => ({ id: 'plan:w3', spaceId: 'space:c', spaceKind: 'class', spaceName: 'A', title: 'Week 3', items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-28' }], publishedAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z', ...over });
const base = { profileId: 'profile:a', quests, episodes, unlockedStages: ['stage1'], today: '2026-09-21', learnerName: 'Suni' };

describe('plan derivation (F-PLAN-001 §3.3)', () => {
  it('builds ids that round-trip to the plan', () => {
    expect(planAssignmentId('plan:w3', 'quest:a')).toBe('plan:w3#quest:a');
    expect(planIdOf('plan:w3#quest:a')).toBe('plan:w3');
    expect(planIdOf('hw:parent-1')).toBeNull();
    expect(planIdOf('plan:broken')).toBeNull();
  });

  it('derives quest and episode items, skipping locked ones silently', () => {
    const p = plan({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-28', note: 'x' }, { kind: 'episode', id: 'episode:s1' }, { kind: 'episode', id: 'episode:s2' }, { kind: 'quest', id: 'quest:nope' }] });
    const result = deriveAssignments({ ...base, plans: [p], snapshot: snap() });
    expect(result.homework.map((h) => h.id)).toEqual(['plan:w3#quest:a', 'plan:w3#quest:b']);
    expect(result.homework[0]).toMatchObject({ assignedBy: 'teacher', assignedAt: '2026-09-20T00:00:00.000Z', targetDate: '2026-09-28', episodeId: 'episode:s1', profileId: 'profile:a' });
    expect(result.homework[1]?.targetDate).toBe('2026-09-21'); // no date on the episode item → today
    expect(result.notReady).toEqual({ 'plan:w3': 2 }); // quest:c is stage 2, quest:nope unknown
    expect(result).toMatchObject({ added: 2, removed: 0, completedNow: 0, changed: true });
  });

  it('is idempotent and carries completion from the snapshot', () => {
    const first = deriveAssignments({ ...base, plans: [plan()], snapshot: snap() });
    const again = deriveAssignments({ ...base, plans: [plan()], snapshot: snap({ homework: first.homework }) });
    expect(again).toMatchObject({ added: 0, removed: 0, completedNow: 0, changed: false });
    expect(again.homework).toEqual(first.homework);

    const done = snap({ homework: first.homework, quests: [{ questId: 'quest:a', episodeId: 'episode:s1', startedAt: 't', completedAt: '2026-09-22T10:00:00.000Z', stars: 3, attempts: 1, accuracy: 1 }] });
    const completed = deriveAssignments({ ...base, plans: [plan()], snapshot: done });
    expect(completed.homework[0]?.completedAt).toBe('2026-09-22T10:00:00.000Z');
    expect(completed).toMatchObject({ completedNow: 1, changed: true });
    // a quest finished before the plan existed is derived as done
    const fresh = deriveAssignments({ ...base, plans: [plan()], snapshot: snap({ quests: done.quests }) });
    expect(fresh.homework[0]?.completedAt).toBe('2026-09-22T10:00:00.000Z');
  });

  it('drops pending assignments of plans that left the inbox, keeps history and caregiver homework', () => {
    const first = deriveAssignments({ ...base, plans: [plan({ items: [{ kind: 'episode', id: 'episode:s1' }] })], snapshot: snap() });
    const withHistory = first.homework.map((h) => (h.questId === 'quest:a' ? { ...h, completedAt: 't' } : h));
    const parent = { id: 'hw:parent-1', profileId: 'profile:a', questId: 'quest:b', episodeId: 'episode:s1', assignedBy: 'parent' as const, assignedAt: 't', targetDate: '2026-09-21' };
    const result = deriveAssignments({ ...base, plans: [], snapshot: snap({ homework: [...withHistory, parent] }) });
    expect(result.homework.map((h) => h.id)).toEqual(['plan:w3#quest:a', 'hw:parent-1']);
    expect(result).toMatchObject({ removed: 1, changed: true });
    const family = deriveAssignments({ ...base, plans: [plan({ id: 'plan:fam', spaceKind: 'family' })], snapshot: snap() });
    expect(family.homework[0]?.assignedBy).toBe('parent');
  });
});
