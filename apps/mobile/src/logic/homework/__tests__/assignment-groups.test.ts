import type { HomeworkAssignment } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { assignedByLabel, dueLabel, groupAssignments } from '../assignment-groups';

const hw = (id: string, targetDate: string, extra: Partial<HomeworkAssignment> = {}): HomeworkAssignment => ({
  id,
  profileId: 'profile:a',
  questId: 'quest:x',
  episodeId: 'episode:x',
  assignedBy: 'parent',
  assignedAt: `${targetDate}T08:00:00.000Z`,
  targetDate,
  ...extra,
});

describe('groupAssignments', () => {
  const today = '2026-09-19';
  it('splits into today / upcoming / done', () => {
    const g = groupAssignments(
      [
        hw('late', '2026-09-17'),
        hw('now', '2026-09-19'),
        hw('soon', '2026-09-21'),
        hw('finished', '2026-09-18', { completedAt: '2026-09-18T10:00:00.000Z' }),
      ],
      today,
    );
    expect(g.today.map((a) => a.id)).toEqual(['late', 'now']);
    expect(g.upcoming.map((a) => a.id)).toEqual(['soon']);
    expect(g.done.map((a) => a.id)).toEqual(['finished']);
  });
  it('orders today by assignedAt, upcoming by targetDate, done newest first', () => {
    const g = groupAssignments(
      [
        hw('b', '2026-09-19', { assignedAt: '2026-09-19T09:00:00.000Z' }),
        hw('a', '2026-09-19', { assignedAt: '2026-09-19T07:00:00.000Z' }),
        hw('far', '2026-09-25'),
        hw('near', '2026-09-20'),
        hw('old', '2026-09-10', { completedAt: '2026-09-10T10:00:00.000Z' }),
        hw('new', '2026-09-12', { completedAt: '2026-09-12T10:00:00.000Z' }),
      ],
      today,
    );
    expect(g.today.map((a) => a.id)).toEqual(['a', 'b']);
    expect(g.upcoming.map((a) => a.id)).toEqual(['near', 'far']);
    expect(g.done.map((a) => a.id)).toEqual(['new', 'old']);
  });
  it('handles an empty list', () => {
    expect(groupAssignments([], today)).toEqual({ today: [], upcoming: [], done: [] });
  });
});

describe('dueLabel', () => {
  it('reads Today / Tomorrow / In N days, never a raw date', () => {
    expect(dueLabel('2026-09-19', '2026-09-19')).toBe('Today');
    expect(dueLabel('2026-09-17', '2026-09-19')).toBe('Today');
    expect(dueLabel('2026-09-20', '2026-09-19')).toBe('Tomorrow');
    expect(dueLabel('2026-09-22', '2026-09-19')).toBe('In 3 days');
  });
});

describe('assignedByLabel', () => {
  it('maps every source to child-readable English', () => {
    expect(assignedByLabel('parent')).toBe('From home');
    expect(assignedByLabel('teacher')).toBe('From class');
    expect(assignedByLabel('system')).toBe('From Hoya');
  });
});
