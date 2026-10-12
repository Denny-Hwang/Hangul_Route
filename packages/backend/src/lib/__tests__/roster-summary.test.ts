import { ActivitySummarySchema, TEACHER_HIDDEN_SUMMARY_KEYS, TEACHER_VISIBLE_SUMMARY_KEYS, type ActivitySummary, type ProgressSummary } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { activityOf, rosterSummary, teacherVisibleSummary } from '../roster-summary';

const placement = {
  takenAt: '2026-10-10T10:05:00.000Z',
  level: { stage: 'stage1', band: 2 },
  oralStage: null,
  strands: { 'hangul-recognition': 'secure', 'sound-letter': 'secure', 'syllable-reading': 'getting-there', vocabulary: 'not-tested', sentences: 'not-tested' },
  beyondContent: false,
  overridden: false,
} as unknown as NonNullable<ProgressSummary['placement']>;

const journey: NonNullable<ProgressSummary['journey']> = {
  v: 1,
  here: 'stage1',
  stages: [
    { stage: 'stage1', state: 'open', done: 4, known: 2, total: 8 },
    { stage: 'stage3', state: 'later', done: 0, known: 0, total: 0 },
  ],
};

const full: ProgressSummary = {
  schemaVersion: 1,
  lastActiveAt: '2026-10-10T00:00:00.000Z',
  streakDays: 4,
  stage1: { questsDone: 5, questsTotal: 11, anchorAccuracy: 0.75 },
  cardsUnlocked: 7,
  minutesLast7d: 42,
  jamoRecognized: ['ㄱ', 'ㄴ'],
  needsPractice: ['ㅂ'],
  stage1Anchor: { met: false, checkedAt: '2026-10-09T00:00:00.000Z', tricky: ['ㅂ', 'ㅍ'] },
  placement,
  planProgress: {
    'plan:own-1': { done: 1, total: 3, notReady: 0 },
    'plan:own-2': { done: 2, total: 2, notReady: 1 },
    'plan:other-class': { done: 4, total: 9, notReady: 0 },
  },
  journey,
};

const own = new Set(['plan:own-1', 'plan:own-2', 'plan:own-unstarted']);

describe('teacherVisibleSummary (F-SPACE-002 T-1a, section 4.11)', () => {
  it('keeps exactly the allow-listed keys, with their values, and drops stage1Anchor and schemaVersion', () => {
    const out = teacherVisibleSummary(full, own);
    // `activity` (F-REPORT-001 RP-W2) is allow-listed too; its own projection is tested below.
    expect(Object.keys(out ?? {}).sort()).toEqual([...TEACHER_VISIBLE_SUMMARY_KEYS].filter((k) => k !== 'activity').sort());
    expect(out).toEqual({
      lastActiveAt: full.lastActiveAt,
      streakDays: 4,
      stage1: { questsDone: 5, questsTotal: 11, anchorAccuracy: 0.75 },
      cardsUnlocked: 7,
      minutesLast7d: 42,
      jamoRecognized: ['ㄱ', 'ㄴ'],
      needsPractice: ['ㅂ'],
      placement,
      planProgress: { 'plan:own-1': { done: 1, total: 3, notReady: 0 }, 'plan:own-2': { done: 2, total: 2, notReady: 1 } },
      journey,
    });
    expect(JSON.stringify(out)).not.toContain('tricky');
    expect(JSON.stringify(out)).not.toContain('plan:other-class');
  });

  it("filters planProgress to the viewing space's plan ids (none of its plans: empty)", () => {
    expect(teacherVisibleSummary(full, new Set())?.planProgress).toEqual({});
    expect(teacherVisibleSummary(full, new Set(['plan:other-class']))?.planProgress).toEqual({ 'plan:other-class': { done: 4, total: 9, notReady: 0 } });
  });

  it('drops keys a stored summary carries that are on no list (older or newer writers)', () => {
    const stored = { ...full, futureKey: 'secret-future', stage1: { ...full.stage1, perQuestAnswers: ['secret-answer'] } };
    const out = teacherVisibleSummary(stored, own);
    expect(out && 'futureKey' in out).toBe(false);
    expect(out?.stage1).toEqual({ questsDone: 5, questsTotal: 11, anchorAccuracy: 0.75 });
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it('copies only what a legacy summary has, and reads a missing or malformed planProgress as empty', () => {
    const legacy = { schemaVersion: 1, lastActiveAt: 't', stage1: 'not-an-object', planProgress: ['bad'] };
    expect(teacherVisibleSummary(legacy, own)).toEqual({ lastActiveAt: 't', planProgress: {} });
    expect(teacherVisibleSummary({ lastActiveAt: 't' }, own)).toEqual({ lastActiveAt: 't', planProgress: {} });
  });

  it('copies only the known journey keys, never what a newer writer left under it (F-ROUTE-001 R-8)', () => {
    const stored = {
      ...full,
      journey: { ...journey, learnerName: 'secret-name', stages: [{ ...journey.stages[0], questIds: ['secret-quest'] }, 'secret-junk'] },
    };
    const out = teacherVisibleSummary(stored, own);
    expect(out?.journey).toEqual({ v: 1, here: 'stage1', stages: [journey.stages[0]] });
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it('leaves out a journey that is not an object, and reads malformed stages as none', () => {
    const missing = teacherVisibleSummary({ ...full, journey: 'oops' }, own);
    expect(missing && 'journey' in missing).toBe(false);
    expect(teacherVisibleSummary({ ...full, journey: { v: 1, here: null, stages: 'oops' } }, own)?.journey).toEqual({ v: 1, here: null, stages: [] });
    const legacy = teacherVisibleSummary({ lastActiveAt: 't' }, own);
    expect(legacy && 'journey' in legacy).toBe(false);
  });

  it('answers null when there is no summary object', () => {
    expect(teacherVisibleSummary(null, own)).toBeNull();
    expect(teacherVisibleSummary(undefined, own)).toBeNull();
    expect(teacherVisibleSummary('summary', own)).toBeNull();
    expect(teacherVisibleSummary([full], own)).toBeNull();
  });
});

describe('rosterSummary (F-PLAN-002 section 3.10: the self-route reaches the family space only)', () => {
  const selfRoute = { done: 7, total: 9, notReady: 0, weeks: 12, endsOn: '2027-01-09' };
  const withRoute = { ...full, selfRoute };

  it('adds selfRoute to the projection for a family space', () => {
    expect(rosterSummary(withRoute, own, 'family')).toEqual({ ...teacherVisibleSummary(withRoute, own), selfRoute });
  });

  it('removes it for a class and a school, which see exactly the teacher projection', () => {
    for (const kind of ['class', 'school'] as const) {
      const out = rosterSummary(withRoute, own, kind);
      expect(out).toEqual(teacherVisibleSummary(withRoute, own));
      expect(out && 'selfRoute' in out).toBe(false);
    }
  });

  it('gives the journey to a class, a school and a family alike (F-ROUTE-001 OD-11)', () => {
    for (const kind of ['class', 'school', 'family'] as const) expect(rosterSummary(full, own, kind)?.journey).toEqual(journey);
  });

  it('copies only the known self-route keys, never what a newer writer left under it', () => {
    const out = rosterSummary({ ...full, selfRoute: { ...selfRoute, items: ['quest:a'], learnerName: 'Suni' } }, own, 'family');
    expect(out?.selfRoute).toEqual(selfRoute);
  });

  it('adds nothing when the summary has no route or a malformed one, and answers null without a summary', () => {
    expect(rosterSummary(full, own, 'family')).toEqual(teacherVisibleSummary(full, own));
    expect(rosterSummary({ ...full, selfRoute: 'oops' }, own, 'family')).toEqual(teacherVisibleSummary(full, own));
    expect(rosterSummary(null, own, 'family')).toBeNull();
  });
});

describe('summary.vocab never reaches a roster yet (F-VOC-005 section 3.8; the console line is P-4)', () => {
  const own = new Set(['plan:own-1']);
  const vocab = { collected: 12, strong: 4, topicsStarted: 2, topicsPracticed7d: 1, firstTryRate: 0.75, needsPractice: ['vocab:sagwa-apple'] };

  it('drops vocab for a class, a school and a family space', () => {
    for (const kind of ['class', 'school', 'family'] as const) {
      const out = rosterSummary({ ...full, vocab }, own, kind);
      expect(out && 'vocab' in out).toBe(false);
      expect(out).toEqual(rosterSummary(full, own, kind));
    }
  });
});

describe('activityOf and summary.activity on the roster (F-REPORT-001 section 3.8, RP-W2)', () => {
  /** Learner-local days at UTC+9; the learner joined the class on 2026-10-10 local time (01:30Z is 10:30 at +09:00). */
  const activity: ActivitySummary = {
    v: 1,
    tz: 540,
    asOf: '2026-10-12',
    days: [
      { d: '2026-09-20', min: 10, q: 1, c: 0, w: 3, j: ['ㄱ'] },
      { d: '2026-10-03', min: 15, q: 1, c: 1, w: 2, j: ['ㄴ'] },
      { d: '2026-10-10', min: 12, q: 0, c: 1, w: 4, j: [] },
      { d: '2026-10-12', min: 9, q: 1, c: 0, w: 1, j: ['ㅂ'] },
    ],
    months: [
      { m: '2026-08', min: 30, q: 2, c: 1, w: 5, days: 3 },
      { m: '2026-09', min: 10, q: 1, c: 0, w: 3, days: 1 },
      { m: '2026-10', min: 36, q: 2, c: 2, w: 7, days: 3 },
    ],
    total: { since: '2026-08-02', min: 76, q: 5, c: 3, w: 15, days: 7 },
    milestones: [
      { stage: 'stage1', on: '2026-10-03' },
      { stage: 'stage2', on: '2026-10-10' },
    ],
    next: { q: 'letters-q3', plan: true },
    revisit: 'letters-q2',
  };
  const joinedAt = '2026-10-10T01:30:00.000Z';
  const wordsHidden = (TEACHER_HIDDEN_SUMMARY_KEYS as readonly string[]).includes('vocab');
  const zeroW = <T extends { w: number }>(row: T): T => ({ ...row, w: wordsHidden ? 0 : row.w });

  it('gives a family the whole activity, every level projected to its known keys', () => {
    const out = activityOf(activity, { kind: 'family', joinedAt });
    expect(out).toEqual({
      ...activity,
      days: activity.days.map(zeroW),
      months: activity.months.map(zeroW),
      total: zeroW(activity.total),
    });
    expect(ActivitySummarySchema.safeParse(out).success).toBe(true);
  });

  it('zeroes every word count while vocab is on the hidden list (the coupling with F-VOC-005 P-4)', () => {
    expect(wordsHidden).toBe(true);
    for (const kind of ['family', 'class', 'school'] as const) {
      const out = activityOf(activity, { kind, joinedAt });
      for (const row of [...out.days, ...out.months, out.total]) expect(row.w).toBe(wordsHidden ? 0 : 7);
    }
  });

  it('for a class or a school drops days and milestones before the local join day, and months up to and including the join month', () => {
    for (const kind of ['class', 'school'] as const) {
      const out = activityOf(activity, { kind, joinedAt });
      expect(out.days.map((d) => d.d)).toEqual(['2026-10-10', '2026-10-12']);
      expect(out.milestones).toEqual([{ stage: 'stage2', on: '2026-10-10' }]);
      expect(out.months).toEqual([]);
      // lifetime counts stay (they match the roster's totals); the first practice day may be before joining
      expect(out.total).toEqual({ ...zeroW(activity.total), since: null });
      expect(out.next).toEqual(activity.next);
      expect(out.revisit).toBe('letters-q2');
      expect(out).toMatchObject({ v: 1, tz: 540, asOf: '2026-10-12' });
      expect(ActivitySummarySchema.safeParse(out).success).toBe(true);
    }
  });

  it('takes the join day in the learner\'s own time zone (activity.tz), not in UTC', () => {
    // 2026-10-03T16:00Z is still 2026-10-03 in UTC but already 2026-10-04 at +09:00: the 3rd is before joining
    const east = activityOf(activity, { kind: 'class', joinedAt: '2026-10-03T16:00:00.000Z' });
    expect(east.days.map((d) => d.d)).toEqual(['2026-10-10', '2026-10-12']);
    expect(east.milestones.map((m) => m.on)).toEqual(['2026-10-10']);
    // 2026-10-04T02:00Z is already 2026-10-04 in UTC but still 2026-10-03 at -05:00: the 3rd is the join day
    const west = activityOf({ ...activity, tz: -300 }, { kind: 'class', joinedAt: '2026-10-04T02:00:00.000Z' });
    expect(west.days.map((d) => d.d)).toEqual(['2026-10-03', '2026-10-10', '2026-10-12']);
    expect(west.milestones.map((m) => m.on)).toEqual(['2026-10-03', '2026-10-10']);
  });

  it('keeps every day from the join day on and every month after the join month', () => {
    const out = activityOf(activity, { kind: 'class', joinedAt: '2026-09-15T00:00:00.000Z' });
    expect(out.days.map((d) => d.d)).toEqual(['2026-09-20', '2026-10-03', '2026-10-10', '2026-10-12']);
    expect(out.months.map((m) => m.m)).toEqual(['2026-10']);
  });

  it('drops next.end for a class or a school (a family plan is not a teacher\'s business), keeps it for a family', () => {
    const freeEnd = { ...activity, next: { end: true as const } };
    expect(activityOf(freeEnd, { kind: 'class', joinedAt })).not.toHaveProperty('next');
    expect(activityOf(freeEnd, { kind: 'school', joinedAt })).not.toHaveProperty('next');
    expect(activityOf(freeEnd, { kind: 'family', joinedAt }).next).toEqual({ end: true });
    const noNext = { ...activity };
    delete noNext.next;
    delete noNext.revisit;
    const out = activityOf(noNext, { kind: 'family', joinedAt });
    expect(out).not.toHaveProperty('next');
    expect(out).not.toHaveProperty('revisit');
  });

  it('a class without a usable join time receives no history at all, only the lifetime counts', () => {
    for (const bad of [null, undefined, 'soon', '']) {
      const out = activityOf(activity, { kind: 'class', joinedAt: bad });
      expect(out.days).toEqual([]);
      expect(out.months).toEqual([]);
      expect(out.milestones).toEqual([]);
      expect(out.total).toEqual({ ...zeroW(activity.total), since: null });
    }
    // a family does not depend on the join time
    expect(activityOf(activity, { kind: 'family', joinedAt: null }).days).toHaveLength(4);
  });

  it('for a class reads the join day in UTC when a stored value has no usable tz, and drops rows without a day key', () => {
    const stored = { ...activity, tz: 'east', days: [{ min: 3, q: 0, c: 0, w: 0, j: [] }, ...activity.days], months: [{ min: 1 }, ...activity.months] };
    const out = activityOf(stored, { kind: 'class', joinedAt: '2026-10-03T16:00:00.000Z' });
    expect(out.days.map((d) => d.d)).toEqual(['2026-10-03', '2026-10-10', '2026-10-12']);
    expect(out.months).toEqual([]);
  });

  it('copies only the known keys at every level, never what a newer writer left under them', () => {
    const stored = {
      ...activity,
      learnerName: 'secret-name',
      days: [{ ...activity.days[3], questIds: ['secret-quest'] }, 'secret-junk'],
      months: [{ ...activity.months[2], secret: 1 }],
      total: { ...activity.total, perQuest: 'secret' },
      milestones: [{ ...activity.milestones[1], by: 'secret' }, 7],
      next: { q: 'letters-q3', plan: false, title: 'secret-title' },
    };
    const out = activityOf(stored, { kind: 'family', joinedAt });
    expect(JSON.stringify(out)).not.toContain('secret');
    expect(out.days).toEqual([zeroW(activity.days[3] as ActivitySummary['days'][number])]);
    expect(out.next).toEqual({ q: 'letters-q3', plan: false });
    expect(Object.keys(out).sort()).toEqual(['asOf', 'days', 'milestones', 'months', 'next', 'revisit', 'total', 'tz', 'v']);
  });

  it('reads malformed arrays as empty and a malformed total or next as absent', () => {
    const out = activityOf({ ...activity, days: 'oops', months: null, milestones: {}, total: 'oops', next: 'oops' }, { kind: 'family', joinedAt });
    expect(out.days).toEqual([]);
    expect(out.months).toEqual([]);
    expect(out.milestones).toEqual([]);
    expect(out).not.toHaveProperty('total');
    expect(out).not.toHaveProperty('next');
  });

  it('rosterSummary projects activity per viewer: whole for a family, clipped at joinedAt for a class and a school', () => {
    const withActivity = { ...full, activity };
    expect(rosterSummary(withActivity, own, 'family', { joinedAt })?.activity).toEqual(activityOf(activity, { kind: 'family', joinedAt }));
    for (const kind of ['class', 'school'] as const) {
      expect(rosterSummary(withActivity, own, kind, { joinedAt })?.activity).toEqual(activityOf(activity, { kind, joinedAt }));
    }
    // without a join time a class receives no day-by-day history
    expect(rosterSummary(withActivity, own, 'class')?.activity?.days).toEqual([]);
    expect(teacherVisibleSummary(withActivity, own)?.activity?.days).toEqual([]);
    expect(teacherVisibleSummary(withActivity, own, { kind: 'class', joinedAt })?.activity).toEqual(activityOf(activity, { kind: 'class', joinedAt }));
  });

  it('leaves activity out when the summary has none or a value that is not an object (the legacy state)', () => {
    for (const value of [undefined, null, 'activity', ['x'], 7]) {
      const out = rosterSummary({ ...full, activity: value }, own, 'class', { joinedAt });
      expect(out && 'activity' in out).toBe(false);
      expect(out).toEqual(teacherVisibleSummary(full, own));
    }
  });
});
