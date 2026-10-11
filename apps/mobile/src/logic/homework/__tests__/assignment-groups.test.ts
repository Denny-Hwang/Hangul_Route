import type { HomeworkAssignment } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { assignedByLabel, dueLabel, dueTodayCount, groupAssignments, homeworkWindow, showsTodayCount, TODAY_LIST_MAX, UPCOMING_WINDOW_DAYS } from '../assignment-groups';

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
        hw('near-later', '2026-09-20', { assignedAt: '2026-09-20T09:00:00.000Z' }),
        hw('near', '2026-09-20'),
        hw('old', '2026-09-10', { completedAt: '2026-09-10T10:00:00.000Z' }),
        hw('new', '2026-09-12', { completedAt: '2026-09-12T10:00:00.000Z' }),
      ],
      today,
    );
    expect(g.today.map((a) => a.id)).toEqual(['a', 'b']);
    expect(g.upcoming.map((a) => a.id)).toEqual(['near', 'near-later', 'far']);
    expect(g.done.map((a) => a.id)).toEqual(['new', 'old']);
  });
  it('handles an empty list', () => {
    expect(groupAssignments([], today)).toEqual({ today: [], upcoming: [], done: [] });
  });
  it('orders today by precedence: class, family, own plan, then the earlier date (F-PLAN-002 section 3.10)', () => {
    const g = groupAssignments(
      [
        hw('route:mine#quest:x', '2026-09-18', { assignedBy: 'system' }),
        hw('home', '2026-09-19', { assignedBy: 'parent' }),
        hw('home-older', '2026-09-17', { assignedBy: 'parent' }),
        hw('class', '2026-09-19', { assignedBy: 'teacher' }),
      ],
      today,
    );
    expect(g.today.map((a) => a.id)).toEqual(['class', 'home-older', 'home', 'route:mine#quest:x']);
  });
});

describe('homeworkWindow: the week window of the list (F-PLAN-002 section 3.6)', () => {
  const today = '2026-09-19';
  it('shows at most three Today rows and flags that more are waiting', () => {
    expect(TODAY_LIST_MAX).toBe(3);
    const many = groupAssignments(['a', 'b', 'c', 'd', 'e'].map((id, i) => hw(id, '2026-09-19', { assignedAt: `2026-09-19T0${i}:00:00.000Z` })), today);
    const w = homeworkWindow(many, today);
    expect(w.today.map((a) => a.id)).toEqual(['a', 'b', 'c']);
    expect(w.moreToday).toBe(true);
    const three = homeworkWindow(groupAssignments(['a', 'b', 'c'].map((id) => hw(id, today)), today), today);
    expect(three.today).toHaveLength(3);
    expect(three.moreToday).toBe(false);
  });
  it('keeps the next seven days under Coming up and the rest for the one collapsed row', () => {
    expect(UPCOMING_WINDOW_DAYS).toBe(7);
    const g = groupAssignments([hw('tomorrow', '2026-09-20'), hw('day7', '2026-09-26'), hw('day8', '2026-09-27'), hw('far', '2026-11-01')], today);
    const w = homeworkWindow(g, today);
    expect(w.comingUp.map((a) => a.id)).toEqual(['tomorrow', 'day7']);
    expect(w.later.map((a) => a.id)).toEqual(['day8', 'far']);
  });
  it('keeps one class row and one home row in view when both are due (F-TCH-001 section 3.5 stacking, F-PLAN-002 section 3.10)', () => {
    const list = [
      hw('class-1', '2026-09-15', { assignedBy: 'teacher' }),
      hw('class-2', '2026-09-16', { assignedBy: 'teacher' }),
      hw('class-3', '2026-09-17', { assignedBy: 'teacher' }),
      hw('home', today, { assignedBy: 'parent' }),
      hw('route:mine#quest:x', today, { assignedBy: 'system' }),
    ];
    const w = homeworkWindow(groupAssignments(list, today), today);
    expect(w.today.map((a) => a.id)).toEqual(['class-1', 'class-2', 'home']);
    expect(w.moreToday).toBe(true);
    const noHome = homeworkWindow(groupAssignments(list.filter((a) => a.id !== 'home'), today), today);
    expect(noHome.today.map((a) => a.id)).toEqual(['class-1', 'class-2', 'class-3']);
  });
  it('is empty for an empty list', () => {
    expect(homeworkWindow(groupAssignments([], today), today)).toEqual({ today: [], moreToday: false, comingUp: [], later: [] });
  });
});

describe('dueTodayCount (the Home homework line, F-PLAN-002 section 3.6)', () => {
  it('counts only what is due today or earlier and not done, never future items', () => {
    const list = [
      hw('late', '2026-09-17'),
      hw('now', '2026-09-19'),
      hw('soon', '2026-09-21'),
      hw('far', '2026-12-01'),
      hw('finished', '2026-09-18', { completedAt: '2026-09-18T10:00:00.000Z' }),
    ];
    expect(dueTodayCount(list, '2026-09-19')).toBe(2);
    expect(dueTodayCount(undefined, '2026-09-19')).toBe(0);
  });
  it('is shown as a number only up to the Today list cap; past it the words carry no number', () => {
    expect(showsTodayCount(0)).toBe(true);
    expect(showsTodayCount(TODAY_LIST_MAX)).toBe(true);
    expect(showsTodayCount(TODAY_LIST_MAX + 1)).toBe(false);
    expect(showsTodayCount(15)).toBe(false);
  });
});

const homeworkMessages = getMessages('en').learner.homework;

describe('dueLabel', () => {
  const due = homeworkMessages.due;
  it('reads Today / Tomorrow / In N days, never a raw date', () => {
    expect(dueLabel('2026-09-19', '2026-09-19', due)).toBe('Today');
    expect(dueLabel('2026-09-17', '2026-09-19', due)).toBe('Today');
    expect(dueLabel('2026-09-20', '2026-09-19', due)).toBe('Tomorrow');
    expect(dueLabel('2026-09-22', '2026-09-19', due)).toBe('In 3 days');
  });
  it('takes its words from the message subtree it is given', () => {
    const es = { today: 'Hoy', tomorrow: 'Mañana', inDays: (n: number) => `En ${n} días` };
    expect(dueLabel('2026-09-19', '2026-09-19', es)).toBe('Hoy');
    expect(dueLabel('2026-09-22', '2026-09-19', es)).toBe('En 3 días');
  });
});

describe('assignedByLabel', () => {
  it('maps every source to child-readable English', () => {
    expect(assignedByLabel({ id: 'hw:1', assignedBy: 'parent' }, homeworkMessages.from)).toBe('From home');
    expect(assignedByLabel({ id: 'plan:c#quest:a', assignedBy: 'teacher' }, homeworkMessages.from)).toBe('From class');
    expect(assignedByLabel({ id: 'hw:2', assignedBy: 'system' }, homeworkMessages.from)).toBe('From Hoya');
  });
  it('labels the learner own weekly plan by its route: id (F-PLAN-002 section 3.6)', () => {
    expect(assignedByLabel({ id: 'route:mine#quest:a', assignedBy: 'system' }, homeworkMessages.from)).toBe('Your plan');
  });
});
