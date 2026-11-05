import { CATALOG, generateCurriculum, toMeta, type CurriculumMeta, type Plan } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { classMeetingOf } from '../class-meeting';

/*
 * AMENDMENTS-ROUTE-CLASS-BLEND row BL-9: how a child's class meets, for the family's child card. Only the class's
 * own published plan with practice days that reaches the learner; its default practice weekdays, never a learner's own.
 */

const draft = generateCurriculum(
  {
    audience: 'class',
    level: { stage: 'stage1', band: 0 },
    startDate: '2026-10-13',
    weeks: 4,
    sessionsPerWeek: 4,
    sessionDays: ['tue', 'wed', 'fri', 'sun'],
    minutesPerSession: 10,
    unlockedStages: ['stage1'],
  },
  CATALOG,
);
const plain = toMeta(draft);
const blended = (personal: { perWeek: number; days?: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> }, lecture: Array<'mon' | 'tue' | 'thu'> = ['tue']): CurriculumMeta => ({
  ...plain,
  generatorVersion: 2,
  params: {
    ...plain.params,
    blend: { mode: 'overlap', lecture: { days: lecture, minutes: 30 }, personal: { minutes: 10, ...personal }, classDaysOff: [], keepAverage: false },
  },
});

const plan = (over: Partial<Plan> & { meta: Plan['meta'] }): Plan => ({
  id: 'plan:1',
  spaceId: 'space:class-a',
  authorAccountId: 'teacher',
  title: 'Term',
  items: [],
  targetLearnerIds: null,
  publishedAt: '2026-10-01T00:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

describe('classMeetingOf', () => {
  it("reads the class days, the practice count and the class's own practice weekdays, in week order", () => {
    const meeting = classMeetingOf([plan({ meta: blended({ perWeek: 3, days: ['sun', 'wed', 'fri'] }) })], 'learner:suni', '2026-10-20');
    expect(meeting).toEqual({ classDays: ['tue'], perWeek: 3, practiceDays: ['wed', 'fri', 'sun'] });
  });

  it('fills the practice weekdays from practiceDaysFor when the teacher kept the suggestion', () => {
    const meeting = classMeetingOf([plan({ meta: blended({ perWeek: 2 }, ['thu', 'mon']) })], 'learner:suni', '2026-10-20');
    expect(meeting?.classDays).toEqual(['mon', 'thu']);
    expect(meeting?.perWeek).toBe(2);
    expect(meeting?.practiceDays).toHaveLength(2);
    expect(meeting?.practiceDays.some((d) => d === 'mon' || d === 'thu')).toBe(false);
  });

  it('is null for a classic plan, a class-only curriculum, a draft, an archived plan, another learner or an ended route', () => {
    const live = blended({ perWeek: 3 });
    const learner = 'learner:suni';
    expect(classMeetingOf([plan({ meta: null })], learner, '2026-10-20')).toBeNull();
    expect(classMeetingOf([plan({ meta: plain })], learner, '2026-10-20')).toBeNull();
    expect(classMeetingOf([plan({ meta: live, publishedAt: null })], learner, '2026-10-20')).toBeNull();
    expect(classMeetingOf([plan({ meta: live, archivedAt: '2026-10-02T00:00:00.000Z' })], learner, '2026-10-20')).toBeNull();
    expect(classMeetingOf([plan({ meta: live, targetLearnerIds: ['learner:mina'] })], learner, '2026-10-20')).toBeNull();
    expect(classMeetingOf([plan({ meta: live, targetLearnerIds: [learner] })], learner, '2026-10-20')).not.toBeNull();
    // 4 cycles from Tuesday 13 October end on Monday 9 November.
    expect(classMeetingOf([plan({ meta: live })], learner, '2026-11-09')).not.toBeNull();
    expect(classMeetingOf([plan({ meta: live })], learner, '2026-11-10')).toBeNull();
    // A meta that does not parse is never read.
    expect(classMeetingOf([plan({ meta: { ...live, weeks: 'x' } as unknown as CurriculumMeta })], learner, '2026-10-20')).toBeNull();
  });

  it('takes the newest published plan when two reach the learner', () => {
    const older = plan({ id: 'plan:old', meta: blended({ perWeek: 1 }) });
    const newer = plan({ id: 'plan:new', meta: blended({ perWeek: 4 }), publishedAt: '2026-10-05T00:00:00.000Z' });
    expect(classMeetingOf([newer, older], 'learner:suni', '2026-10-20')?.perWeek).toBe(4);
    expect(classMeetingOf([older, newer], 'learner:suni', '2026-10-20')?.perWeek).toBe(4);
  });
});
