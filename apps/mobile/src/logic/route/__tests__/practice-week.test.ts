import type { HomeworkAssignment, InboxPlan, ReviewEntry } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { blendedMeta, curriculumMeta } from '../../homework/__tests__/curriculum-fixture';
import { practiceWeekOf } from '../practice-week';

/*
 * AMENDMENTS-ROUTE-CLASS-BLEND section 11 (BL-OD-11), row BL-9: the device's count of practice days this week, family
 * only. A Tuesday class from Monday 21 September 2026 for 4 weeks; the week under test is Monday 28 September to
 * Sunday 4 October, today Saturday 3 October.
 */

const inbox = (over: Partial<InboxPlan> = {}): InboxPlan => ({
  id: 'plan:c',
  spaceId: 'space:class',
  spaceKind: 'class',
  spaceName: 'Evening Class D',
  title: 'Term',
  items: [],
  publishedAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
  meta: blendedMeta({ refresh: [{ date: '2026-09-30', cellIds: ['cell:stage1-letters-a'] }] }),
  ...over,
});

const hw = (id: string, completedAt?: string): HomeworkAssignment => ({
  id,
  profileId: 'p',
  questId: id.split('#')[1] ?? 'q',
  episodeId: 'e',
  assignedBy: 'teacher',
  assignedAt: '2026-09-20T00:00:00.000Z',
  targetDate: '2026-09-29',
  ...(completedAt ? { completedAt } : {}),
});

const review = (kind: ReviewEntry['kind'], generatedAt: string): ReviewEntry => ({ id: `${kind}:${generatedAt}`, kind, generatedAt, scope: generatedAt.slice(0, 10), itemIds: [] });

const utcDay = (iso: string): string => iso.slice(0, 10);
const base = { planDay: '2026-10-03', today: '2026-10-03', localDay: utcDay };

describe('practiceWeekOf', () => {
  it('counts the distinct days this week with a finished practice item of a class plan with practice days', () => {
    const homework = [
      hw('plan:c#q1', '2026-09-29T08:00:00.000Z'),
      hw('plan:c#q2', '2026-09-29T19:00:00.000Z'),
      hw('plan:c#q3', '2026-10-02T08:00:00.000Z'),
      hw('plan:c#q4'),
      // Last week: not this week.
      hw('plan:c#q5', '2026-09-27T08:00:00.000Z'),
      // An own plan's or a family plan's item is not class practice.
      hw('route:mine#q6', '2026-10-01T08:00:00.000Z'),
      hw('plan:family#q7', '2026-10-01T08:00:00.000Z'),
    ];
    const family = inbox({ id: 'plan:family', spaceKind: 'family', meta: curriculumMeta() });
    expect(practiceWeekOf({ ...base, snapshot: { homework, reviews: [] }, plans: [inbox(), family] })).toEqual({ practicedDays: 2 });
  });

  it('counts a finished Refresh: a Daily Review or a Cell Check on a day the plan lists a Refresh for', () => {
    const reviews = [
      review('daily', '2026-09-30T08:00:00.000Z'),
      // A review on a day with no Refresh is not a Refresh.
      review('cell-check', '2026-10-01T08:00:00.000Z'),
      // Feedback is not a Refresh kind.
      review('feedback', '2026-09-30T09:00:00.000Z'),
    ];
    expect(practiceWeekOf({ ...base, snapshot: { homework: [hw('plan:c#q1', '2026-09-30T10:00:00.000Z')], reviews }, plans: [inbox()] })).toEqual({ practicedDays: 1 });
    expect(practiceWeekOf({ ...base, snapshot: { homework: [], reviews: [review('cell-check', '2026-09-30T08:00:00.000Z')] }, plans: [inbox()] })).toEqual({ practicedDays: 1 });
  });

  it('reads days on the learner local calendar, and never a day after today', () => {
    const homework = [hw('plan:c#q1', '2026-10-04T01:00:00.000Z')];
    // 01:00 UTC on Sunday is still Saturday in a zone 5 hours behind.
    const behind = (iso: string): string => new Date(Date.parse(iso) - 5 * 3600_000).toISOString().slice(0, 10);
    expect(practiceWeekOf({ ...base, localDay: behind, snapshot: { homework, reviews: [] }, plans: [inbox()] })).toEqual({ practicedDays: 1 });
    expect(practiceWeekOf({ ...base, snapshot: { homework, reviews: [] }, plans: [inbox()] })).toEqual({ practicedDays: 0 });
  });

  it('writes 0 while a class plan with practice days is in force and nothing is finished yet', () => {
    expect(practiceWeekOf({ ...base, snapshot: { homework: [], reviews: [] }, plans: [inbox()] })).toEqual({ practicedDays: 0 });
  });

  it('writes no field without a class plan with practice days in force, or while the inbox is unknown', () => {
    const snapshot = { homework: [hw('plan:c#q1', '2026-09-29T08:00:00.000Z')], reviews: [] };
    expect(practiceWeekOf({ ...base, snapshot, plans: undefined })).toBeUndefined();
    expect(practiceWeekOf({ ...base, snapshot, plans: [] })).toBeUndefined();
    expect(practiceWeekOf({ ...base, snapshot, plans: [inbox({ meta: curriculumMeta() })] })).toBeUndefined();
    expect(practiceWeekOf({ ...base, snapshot, plans: [inbox({ meta: null })] })).toBeUndefined();
    // A family space never holds a class plan with practice days.
    expect(practiceWeekOf({ ...base, snapshot, plans: [inbox({ spaceKind: 'family' })] })).toBeUndefined();
    // After the route ends (10-19).
    expect(practiceWeekOf({ ...base, planDay: '2026-10-25', today: '2026-10-25', snapshot, plans: [inbox()] })).toBeUndefined();
  });

  it('counts a day once across two class plans with practice days', () => {
    const second = inbox({ id: 'plan:d', spaceId: 'space:class-2' });
    const homework = [hw('plan:c#q1', '2026-09-29T08:00:00.000Z'), hw('plan:d#q1', '2026-09-29T09:00:00.000Z'), hw('plan:d#q2', '2026-10-01T09:00:00.000Z')];
    expect(practiceWeekOf({ ...base, snapshot: { homework, reviews: [] }, plans: [inbox(), second] })).toEqual({ practicedDays: 2 });
  });
});
