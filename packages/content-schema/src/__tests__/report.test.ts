import { describe, expect, it } from 'vitest';
import { ZodArray, ZodCatch, ZodDefault, ZodEffects, ZodNullable, ZodObject, ZodOptional, ZodUnion, type ZodTypeAny } from 'zod';
import {
  ActivityDaySchema,
  ActivityMonthSchema,
  ActivityNextSchema,
  ActivitySummarySchema,
  ClassReportResponseSchema,
  ClassReportSchema,
  LearnerReportResponseSchema,
  ProgressSummarySchema,
  REPORT_DAY_LETTERS_MAX,
  REPORT_DAYS_MAX,
  REPORT_MILESTONES_MAX,
  REPORT_MONTHS_MAX,
  REPORT_PERIODS,
  ReportLetterSchema,
  ReportPeriodSchema,
  ReportStageKeySchema,
  ReportSummarySchema,
  TEACHER_VISIBLE_SUMMARY_KEYS,
  reportPeriodOf,
  type ActivitySummary,
} from '../index';

const day = { d: '2026-10-11', min: 12, q: 1, c: 1, w: 0, j: ['ㅂ', 'ㅅ'] };
const month = { m: '2026-10', min: 36, q: 2, c: 1, w: 0, days: 3 };
const activity: ActivitySummary = {
  v: 1,
  tz: 540,
  asOf: '2026-10-11',
  days: [day],
  months: [month],
  total: { since: '2026-09-02', min: 120, q: 8, c: 4, w: 0, days: 11 },
  milestones: [{ stage: 'stage1', on: '2026-10-09' }],
  next: { q: 'letters-q3', plan: false },
  revisit: 'letters-q2',
};
/** n distinct ascending days ending at 2026-10-11 (`activity.asOf`). */
const dayKeys = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ ...day, d: new Date(Date.UTC(2026, 9, 11 - (n - 1) + i)).toISOString().slice(0, 10) }));
const monthKeys = (n: number) => Array.from({ length: n }, (_, i) => ({ ...month, m: `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}` }));

const summary = {
  schemaVersion: 1 as const,
  lastActiveAt: '2026-10-11T09:00:00.000Z',
  streakDays: 2,
  stage1: { questsDone: 8, questsTotal: 15, anchorAccuracy: null },
  cardsUnlocked: 4,
  minutesLast7d: 36,
  jamoRecognized: ['ㄱ'],
  needsPractice: ['ㅂ'],
  planProgress: {},
};

describe('ActivitySummarySchema (F-REPORT-001 section 3.3.3)', () => {
  it('parses a full activity and keeps every field', () => {
    expect(ActivitySummarySchema.parse(activity)).toEqual(activity);
  });

  it('next and revisit are optional (absent before F-ENT-003 E3-4 and at rest)', () => {
    const { next: _next, revisit: _revisit, ...bare } = activity;
    const parsed = ActivitySummarySchema.parse(bare);
    expect(parsed).not.toHaveProperty('next');
    expect(parsed).not.toHaveProperty('revisit');
    expect(ActivitySummarySchema.parse({ ...activity, total: { ...activity.total, since: null } }).total.since).toBeNull();
  });

  it('holds the bounds: 35 days, 24 months, 16 milestones, 12 letters a day', () => {
    expect([REPORT_DAYS_MAX, REPORT_MONTHS_MAX, REPORT_MILESTONES_MAX, REPORT_DAY_LETTERS_MAX]).toEqual([35, 24, 16, 12]);
    expect(ActivitySummarySchema.safeParse({ ...activity, days: dayKeys(35) }).success).toBe(true);
    expect(ActivitySummarySchema.safeParse({ ...activity, days: dayKeys(36) }).success).toBe(false);
    expect(ActivitySummarySchema.safeParse({ ...activity, months: monthKeys(24) }).success).toBe(true);
    expect(ActivitySummarySchema.safeParse({ ...activity, months: monthKeys(25) }).success).toBe(false);
    const milestones = (n: number) => Array.from({ length: n }, () => activity.milestones[0]);
    expect(ActivitySummarySchema.safeParse({ ...activity, milestones: milestones(16) }).success).toBe(true);
    expect(ActivitySummarySchema.safeParse({ ...activity, milestones: milestones(17) }).success).toBe(false);
    const letters = (n: number) => Array.from({ length: n }, () => 'ㄱ');
    expect(ActivityDaySchema.safeParse({ ...day, j: letters(12) }).success).toBe(true);
    expect(ActivityDaySchema.safeParse({ ...day, j: letters(13) }).success).toBe(false);
    expect(ActivityDaySchema.safeParse({ ...day, j: ['x'.repeat(17)] }).success).toBe(false);
    expect(ActivityDaySchema.safeParse({ ...day, j: ['ㄱ'.repeat(3)] }).success).toBe(false);
    expect(ActivityMonthSchema.safeParse({ ...month, days: 32 }).success).toBe(false);
  });

  it('holds the count bounds: whole, non-negative, at most 100000', () => {
    for (const min of [-1, 1.5, 100_001]) expect(ActivityDaySchema.safeParse({ ...day, min }).success).toBe(false);
    expect(ActivityDaySchema.safeParse({ ...day, min: 100_000 }).success).toBe(true);
    expect(ActivitySummarySchema.safeParse({ ...activity, total: { ...activity.total, days: -1 } }).success).toBe(false);
  });

  it('checks day and month key formats', () => {
    for (const d of ['2026-10-1', '20261011', '2026/10/11', '2026-10-11T00:00']) expect(ActivityDaySchema.safeParse({ ...day, d }).success).toBe(false);
    for (const m of ['2026-1', '2026-10-01', '202610']) expect(ActivityMonthSchema.safeParse({ ...month, m }).success).toBe(false);
    expect(ActivitySummarySchema.safeParse({ ...activity, asOf: '2026-10' }).success).toBe(false);
    expect(ActivitySummarySchema.safeParse({ ...activity, milestones: [{ stage: 'stage1', on: 'yesterday' }] }).success).toBe(false);
  });

  it('rejects a day key that is not a real calendar day, and a month outside 01-12', () => {
    for (const d of ['2026-19-45', '2026-02-30', '2026-00-10', '2026-04-31', '0000-01-01']) expect(ActivityDaySchema.safeParse({ ...day, d }).success).toBe(false);
    expect(ActivityDaySchema.safeParse({ ...day, d: '2028-02-29' }).success).toBe(true);
    for (const m of ['2026-00', '2026-13']) expect(ActivityMonthSchema.safeParse({ ...month, m }).success).toBe(false);
    expect(ActivitySummarySchema.safeParse({ ...activity, total: { ...activity.total, since: '2026-02-30' } }).success).toBe(false);
  });

  it('letters are jamo and stages are stage keys: no free text (section 3.10)', () => {
    for (const ok of ['ㄱ', 'ㅏ', 'ㄲ', 'ㅘ', 'ㆎ', 'ㄱㅏ']) expect(ReportLetterSchema.safeParse(ok).success).toBe(true);
    for (const bad of ['', 'a', '가', 'hi', 'ㄱㄴㄷ', ' ㄱ', 'ㄱ ']) expect(ReportLetterSchema.safeParse(bad).success).toBe(false);
    expect(ActivityDaySchema.safeParse({ ...day, j: ['call me'] }).success).toBe(false);
    for (const ok of ['stage1', 'stage-7']) expect(ReportStageKeySchema.safeParse(ok).success).toBe(true);
    for (const bad of ['', 'Stage 1', 'x'.repeat(33), 'stage1!']) expect(ReportStageKeySchema.safeParse(bad).success).toBe(false);
    expect(ActivitySummarySchema.safeParse({ ...activity, milestones: [{ stage: 'hello world', on: '2026-10-09' }] }).success).toBe(false);
  });

  it('days and months are ascending with no repeats, and none after asOf', () => {
    const [a, b] = dayKeys(2) as [typeof day, typeof day];
    expect(ActivitySummarySchema.safeParse({ ...activity, days: [a, b] }).success).toBe(true);
    expect(ActivitySummarySchema.safeParse({ ...activity, days: [b, a] }).success).toBe(false);
    expect(ActivitySummarySchema.safeParse({ ...activity, days: [a, a] }).success).toBe(false);
    expect(ActivitySummarySchema.safeParse({ ...activity, days: [{ ...day, d: '2026-10-12' }] }).success).toBe(false);
    const sep = { ...month, m: '2026-09' };
    expect(ActivitySummarySchema.safeParse({ ...activity, months: [sep, month] }).success).toBe(true);
    expect(ActivitySummarySchema.safeParse({ ...activity, months: [month, sep] }).success).toBe(false);
    expect(ActivitySummarySchema.safeParse({ ...activity, months: [month, month] }).success).toBe(false);
    expect(ActivitySummarySchema.safeParse({ ...activity, months: [{ ...month, m: '2026-11' }] }).success).toBe(false);
  });

  it('bounds the offset to -840..840 minutes and v to 1', () => {
    expect(ActivitySummarySchema.safeParse({ ...activity, tz: -840 }).success).toBe(true);
    expect(ActivitySummarySchema.safeParse({ ...activity, tz: 840 }).success).toBe(true);
    for (const tz of [-841, 841, 30.5]) expect(ActivitySummarySchema.safeParse({ ...activity, tz }).success).toBe(false);
    expect(ActivitySummarySchema.safeParse({ ...activity, v: 2 }).success).toBe(false);
  });

  it('next is a strict union: a quest with its plan flag, or the free-days end', () => {
    expect(ActivityNextSchema.parse({ q: 'letters-q3', plan: true })).toEqual({ q: 'letters-q3', plan: true });
    expect(ActivityNextSchema.parse({ end: true })).toEqual({ end: true });
    for (const bad of [{ q: 'letters-q3' }, { q: '', plan: true }, { q: 'x'.repeat(65), plan: true }, { end: false }, { q: 'letters-q3', plan: true, end: true }, { end: true, extra: 1 }, {}]) {
      expect(ActivityNextSchema.safeParse(bad).success).toBe(false);
    }
    expect(ActivitySummarySchema.safeParse({ ...activity, revisit: '' }).success).toBe(false);
  });
});

describe('ProgressSummary.activity is tolerant (assumption a)', () => {
  it('an old summary parses without activity', () => {
    expect(ProgressSummarySchema.parse(summary)).not.toHaveProperty('activity');
  });

  it('a malformed or oversized activity is dropped, never a failure', () => {
    for (const bad of [{ ...activity, days: dayKeys(36) }, { ...activity, next: { end: false } }, { ...activity, days: [day, day] }, { ...activity, days: [{ ...day, j: ['free text'] }] }, 42]) {
      const parsed = ProgressSummarySchema.safeParse({ ...summary, activity: bad });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.activity).toBeUndefined();
    }
  });

  it('keeps a valid activity', () => {
    expect(ProgressSummarySchema.parse({ ...summary, activity }).activity).toEqual(activity);
  });
});

describe('report periods', () => {
  it('lists day, week, month and all', () => {
    expect([...REPORT_PERIODS]).toEqual(['day', 'week', 'month', 'all']);
    expect(ReportPeriodSchema.options).toEqual(['day', 'week', 'month', 'all']);
  });

  it('reads anything else as week (section 3.1)', () => {
    for (const p of REPORT_PERIODS) expect(reportPeriodOf(p)).toBe(p);
    for (const raw of [undefined, null, '', 'year', 'WEEK', 7, ['day']]) expect(reportPeriodOf(raw)).toBe('week');
  });
});

const space = {
  id: 'space:fam-1',
  kind: 'family' as const,
  name: 'Kim family',
  parentSpaceId: null,
  settings: { consentMode: 'parent' as const, anonymizeRoster: false },
  archivedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const learner = {
  id: 'profile:mina',
  displayName: 'Mina',
  avatar: 'hoya-orange',
  joinedAt: '2026-09-02T00:00:00.000Z',
  lastActiveAt: '2026-10-11T09:00:00.000Z',
};
const projected = {
  lastActiveAt: summary.lastActiveAt,
  streakDays: 2,
  stage1: summary.stage1,
  cardsUnlocked: 4,
  minutesLast7d: 36,
  jamoRecognized: ['ㄱ'],
  needsPractice: ['ㅂ'],
  planProgress: { 'plan:a': { done: 1, total: 3, notReady: 0 } },
};

describe('LearnerReportResponseSchema (section 3.8)', () => {
  const body = { space, learner, summary: projected, lastSyncedAt: '2026-10-11T09:01:00.000Z', serverTime: '2026-10-12T00:00:00.000Z' };

  it('parses the route body', () => {
    expect(LearnerReportResponseSchema.parse(body)).toEqual(body);
  });

  it('accepts a learner with no stored summary and no sync yet', () => {
    const parsed = LearnerReportResponseSchema.parse({ ...body, summary: null, lastSyncedAt: null });
    expect(parsed.summary).toBeNull();
    expect(parsed.lastSyncedAt).toBeNull();
  });

  it('carries no ageGroup (data minimisation) and drops one a server might send', () => {
    expect(Object.keys(LearnerReportResponseSchema.shape.learner.shape)).not.toContain('ageGroup');
    const parsed = LearnerReportResponseSchema.parse({ ...body, learner: { ...learner, ageGroup: '5-7' } });
    expect(parsed.learner).not.toHaveProperty('ageGroup');
  });

  it('never carries the snapshot payload or the hidden summary keys', () => {
    const parsed = LearnerReportResponseSchema.parse({ ...body, payload: { quests: [] }, summary: { ...projected, schemaVersion: 1, stage1Anchor: { met: true, checkedAt: 'x', tricky: [] }, vocab: {} } });
    expect(parsed).not.toHaveProperty('payload');
    expect(parsed.summary).not.toHaveProperty('schemaVersion');
    expect(parsed.summary).not.toHaveProperty('stage1Anchor');
    expect(parsed.summary).not.toHaveProperty('vocab');
  });

  it('reads exactly the roster allow-list (activity on it since RP-W2) plus the family self-route', () => {
    expect(TEACHER_VISIBLE_SUMMARY_KEYS).toContain('activity');
    expect(Object.keys(ReportSummarySchema.shape).sort()).toEqual([...TEACHER_VISIBLE_SUMMARY_KEYS, 'selfRoute'].sort());
  });

  it('reads a legacy projection with missing keys, and the family and activity fields when present', () => {
    expect(ReportSummarySchema.parse({ planProgress: {} })).toEqual({ planProgress: {} });
    const selfRoute = { done: 1, total: 4, notReady: 0, weeks: 4, endsOn: '2026-11-01' };
    expect(ReportSummarySchema.parse({ ...projected, selfRoute, activity })).toEqual({ ...projected, selfRoute, activity });
  });

  it('drops a malformed activity or self-route from the projection instead of failing the page', () => {
    const parsed = ReportSummarySchema.parse({ ...projected, activity: { v: 9 }, selfRoute: 'x' });
    expect(parsed.activity).toBeUndefined();
    expect(parsed.selfRoute).toBeUndefined();
  });

  it('rejects a body without the learner or the space', () => {
    const { learner: _l, ...noLearner } = body;
    expect(LearnerReportResponseSchema.safeParse(noLearner).success).toBe(false);
    expect(LearnerReportResponseSchema.safeParse({ ...body, space: { ...space, kind: 'club' } }).success).toBe(false);
  });
});

const classReport = {
  v: 1 as const,
  period: 'week' as const,
  headline: { code: 'class_practiced' as const, practiced: 2, learners: 12, up: true as const },
  class: { learners: 12, withActivity: 10, olderApp: 2, notSaved7d: 3 },
  wentWell: {
    lettersNew: [{ letter: 'ㅂ', learners: 3 }],
    questsNew: { count: 5, up: true as const },
    cardsNew: 2,
    milestones: [{ stage: 'stage1', count: 1 }],
  },
  revisit: [{ letter: 'ㅅ', learners: 4 }],
  practice: {
    dayBands: [
      { band: '0' as const, learners: 10 },
      { band: '1-2' as const, learners: 1 },
      { band: '3-4' as const, learners: 1 },
      { band: '5-7' as const, learners: 0 },
    ],
  },
  time: { minutesTotal: { count: 51 }, minutesMedian: null },
  levelCheck: [{ strand: 'sound-letter' as const, secure: 1, gettingThere: 2, notYet: 0, notTested: 1 }],
  plans: [{ planId: 'plan:a', title: 'Week 3', assigned: 12, started: 5, finished: 2, itemsDone: 14 }],
};

/** Every key anywhere in a value (arrays and objects). */
function deepKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const v of value) deepKeys(v, out);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      deepKeys(v, out);
    }
  }
  return out;
}

/** Every key a schema declares, through wrappers, arrays, unions and refinements. */
function schemaKeys(schema: ZodTypeAny, out: string[] = []): string[] {
  if (schema instanceof ZodObject) {
    for (const [k, v] of Object.entries(schema.shape as Record<string, ZodTypeAny>)) {
      out.push(k);
      schemaKeys(v, out);
    }
  } else if (schema instanceof ZodOptional || schema instanceof ZodNullable) schemaKeys(schema.unwrap() as ZodTypeAny, out);
  else if (schema instanceof ZodArray) schemaKeys(schema.element as ZodTypeAny, out);
  else if (schema instanceof ZodEffects) schemaKeys(schema.innerType() as ZodTypeAny, out);
  else if (schema instanceof ZodDefault || schema instanceof ZodCatch) schemaKeys(schema._def.innerType as ZodTypeAny, out);
  else if (schema instanceof ZodUnion) for (const option of schema.options as ZodTypeAny[]) schemaKeys(option, out);
  return out;
}

describe('ClassReportSchema and ClassReportResponseSchema (sections 3.7, 3.8)', () => {
  it('parses a class report and its response body', () => {
    expect(ClassReportSchema.parse(classReport)).toEqual(classReport);
    const body = { space: { ...space, id: 'space:class-1', kind: 'class' as const }, period: 'week' as const, serverTime: '2026-10-12T00:00:00.000Z', report: classReport };
    expect(ClassReportResponseSchema.parse(body)).toEqual(body);
  });

  const bands = (names: string[]) => names.map((band) => ({ band, learners: 1 }));
  const withBands = (period: string, names: string[] | undefined) =>
    ClassReportSchema.safeParse({ ...classReport, period, practice: names === undefined ? {} : { dayBands: bands(names) } }).success;

  it('accepts the bands of each period, and none for all', () => {
    expect(withBands('week', ['0', '1-2', '3-4', '5-7'])).toBe(true);
    expect(withBands('month', ['0', '1-4', '5-9', '10+'])).toBe(true);
    expect(withBands('day', ['practiced', 'not_yet'])).toBe(true);
    const all = ClassReportSchema.parse({ ...classReport, period: 'all', practice: {} });
    expect(all.practice).not.toHaveProperty('dayBands');
    expect(withBands('week', ['top'])).toBe(false);
  });

  it('rejects a band from another period, and any band on all', () => {
    expect(withBands('week', ['0', '10+'])).toBe(false);
    expect(withBands('week', ['practiced'])).toBe(false);
    expect(withBands('month', ['1-2'])).toBe(false);
    expect(withBands('month', ['not_yet'])).toBe(false);
    expect(withBands('day', ['0'])).toBe(false);
    expect(withBands('day', ['5-7'])).toBe(false);
    expect(withBands('all', ['0'])).toBe(false);
    expect(withBands('all', [])).toBe(false);
  });

  it('takes a plan id with the plan grammar and no tighter bound, and letters only as jamo', () => {
    const long = `plan:${'a'.repeat(70)}`;
    expect(ClassReportSchema.safeParse({ ...classReport, plans: [{ ...classReport.plans[0], planId: long }] }).success).toBe(true);
    expect(ClassReportSchema.safeParse({ ...classReport, plans: [{ ...classReport.plans[0], planId: 'Week 3' }] }).success).toBe(false);
    expect(ClassReportSchema.safeParse({ ...classReport, revisit: [{ letter: 'hello', learners: 1 }] }).success).toBe(false);
    expect(ClassReportSchema.safeParse({ ...classReport, wentWell: { ...classReport.wentWell, milestones: [{ stage: 'Stage One', count: 1 }] } }).success).toBe(false);
  });

  it('carries a median only as a count or null, and up only as true', () => {
    expect(ClassReportSchema.parse({ ...classReport, time: { minutesTotal: { count: 51 }, minutesMedian: 14 } }).time.minutesMedian).toBe(14);
    expect(ClassReportSchema.safeParse({ ...classReport, time: { minutesTotal: { count: 51, up: false }, minutesMedian: null } }).success).toBe(false);
    expect(ClassReportSchema.safeParse({ ...classReport, time: { minutesTotal: { count: 51 }, minutesMedian: 1.5 } }).success).toBe(false);
    expect(ClassReportSchema.safeParse({ ...classReport, headline: { ...classReport.headline, up: false } }).success).toBe(false);
  });

  it('caps letters at 5 and plans at 3', () => {
    const letters = Array.from({ length: 6 }, () => ({ letter: 'ㄱ', learners: 1 }));
    expect(ClassReportSchema.safeParse({ ...classReport, revisit: letters }).success).toBe(false);
    expect(ClassReportSchema.safeParse({ ...classReport, wentWell: { ...classReport.wentWell, lettersNew: letters } }).success).toBe(false);
    expect(ClassReportSchema.safeParse({ ...classReport, plans: Array.from({ length: 4 }, () => classReport.plans[0]) }).success).toBe(false);
  });

  it('drops any learner identifier or ranking field a server might add (hard rules of section 3.7)', () => {
    const tampered = {
      ...classReport,
      learnerIds: ['profile:mina'],
      top: 'Mina',
      class: { ...classReport.class, best: 'Mina' },
      wentWell: { ...classReport.wentWell, lettersNew: [{ letter: 'ㅂ', learners: 3, displayName: 'Mina' }] },
      plans: [{ ...classReport.plans[0], avatar: 'hoya-orange' }],
    };
    const keys = deepKeys(ClassReportSchema.parse(tampered));
    for (const banned of ['id', 'learnerIds', 'displayName', 'avatar', 'top', 'most', 'least', 'best', 'lowest']) expect(keys).not.toContain(banned);
  });

  it('declares no learner identifier and no ranking field anywhere in its shape', () => {
    const keys = schemaKeys(ClassReportSchema);
    // The walker reaches every block, optional and nested ones included.
    for (const declared of ['headline', 'notSaved7d', 'lettersNew', 'letter', 'dayBands', 'band', 'minutesMedian', 'notTested', 'planId', 'itemsDone']) expect(keys).toContain(declared);
    for (const banned of ['id', 'learnerId', 'displayName', 'avatar', 'name', 'top', 'most', 'least', 'best', 'lowest']) expect(keys).not.toContain(banned);
  });
});
