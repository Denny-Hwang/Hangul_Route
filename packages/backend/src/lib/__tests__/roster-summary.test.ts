import { ActivitySummarySchema, TEACHER_FULL_SCOPE_EXTRA_KEYS, TEACHER_VISIBLE_SUMMARY_KEYS, type ActivitySummary, type ProgressSummary } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { activityOf, readsFullScope, rosterSummary, teacherVisibleSummary } from '../roster-summary';

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
/** [TV] What a family (full scope) reads beyond the teacher projection of `full`: the Hangul Check. */
const familyExtras = { stage1Anchor: full.stage1Anchor };

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
    expect(rosterSummary(withRoute, own, 'family')).toEqual({ ...teacherVisibleSummary(withRoute, own), ...familyExtras, selfRoute });
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
    expect(rosterSummary(full, own, 'family')).toEqual({ ...teacherVisibleSummary(full, own), ...familyExtras });
    expect(rosterSummary({ ...full, selfRoute: 'oops' }, own, 'family')).toEqual({ ...teacherVisibleSummary(full, own), ...familyExtras });
    expect(rosterSummary(null, own, 'family')).toBeNull();
  });
});

describe('rosterSummary: summary.routeGoal reaches the family space only (Learning Route section 9, LR-W1)', () => {
  const routeGoal = { stage: 'stage2', from: 'class' } as const;
  const withGoal = { ...full, routeGoal };

  it('adds routeGoal to the projection for a family space', () => {
    expect(rosterSummary(withGoal, own, 'family')).toEqual({ ...teacherVisibleSummary(withGoal, own), ...familyExtras, routeGoal });
  });

  it('removes it for a class and a school, which see exactly the teacher projection', () => {
    for (const kind of ['class', 'school'] as const) {
      const out = rosterSummary(withGoal, own, kind);
      expect(out).toEqual(teacherVisibleSummary(full, own));
      expect(out && 'routeGoal' in out).toBe(false);
    }
    expect(TEACHER_VISIBLE_SUMMARY_KEYS).not.toContain('routeGoal');
  });

  it('a class roster of a learner with both a goal and a self-route receives neither', () => {
    const both = { ...withGoal, selfRoute: { done: 7, total: 9, notReady: 0, weeks: 12, endsOn: '2027-01-09' } };
    const out = rosterSummary(both, own, 'class');
    expect(out && 'routeGoal' in out).toBe(false);
    expect(out && 'selfRoute' in out).toBe(false);
    expect(rosterSummary(both, own, 'family')).toMatchObject({ routeGoal, selfRoute: both.selfRoute });
  });

  it('copies only stage and from, never what a newer writer left under it', () => {
    const out = rosterSummary({ ...full, routeGoal: { ...routeGoal, sourceId: 'plan:secret', endsOn: '2027-01-09', learnerName: 'secret-name' } }, own, 'family');
    expect(out?.routeGoal).toEqual(routeGoal);
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it('adds nothing when the goal is missing or not an object', () => {
    for (const value of [undefined, null, 'stage2', ['stage2'], 7]) {
      const out = rosterSummary({ ...full, routeGoal: value }, own, 'family');
      expect(out).toEqual({ ...teacherVisibleSummary(full, own), ...familyExtras });
      expect(out && 'routeGoal' in out).toBe(false);
    }
  });

  it('keeps the self-route and the goal independent of each other for a family', () => {
    const selfRoute = { done: 1, total: 2, notReady: 0, weeks: 4, endsOn: '2026-11-07' };
    expect(rosterSummary({ ...full, selfRoute }, own, 'family')).not.toHaveProperty('routeGoal');
    expect(rosterSummary(withGoal, own, 'family')).not.toHaveProperty('selfRoute');
  });
});

describe('[TV] summary.vocab and the full scope (F-VOC-005 P-4b, AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 2)', () => {
  const own = new Set(['plan:own-1']);
  const vocab = { collected: 12, strong: 4, topicsStarted: 2, topicsPracticed7d: 1, firstTryRate: 0.75, needsPractice: ['vocab:sagwa-apple'] };
  const { firstTryRate: _rate, ...rosterVocab } = vocab;
  const selfRoute = { done: 7, total: 9, notReady: 0, weeks: 12, endsOn: '2027-01-09' };
  const routeGoal = { stage: 'stage2', from: 'class' } as const;
  const everything = { ...full, vocab, selfRoute, routeGoal };

  it('gives a family vocab without firstTryRate on the roster and with it on the learner report (detail)', () => {
    expect(rosterSummary({ ...full, vocab }, own, 'family')?.vocab).toEqual(rosterVocab);
    expect(rosterSummary({ ...full, vocab }, own, 'family', { detail: true })?.vocab).toEqual(vocab);
  });

  it('a base-scope class or school (no acknowledgement) reads exactly the teacher projection: no vocab, Hangul Check, self-route or goal', () => {
    for (const kind of ['class', 'school'] as const) {
      for (const scope of [undefined, 'base'] as const) {
        const out = rosterSummary(everything, own, kind, { scope, detail: true });
        expect(out).toEqual(teacherVisibleSummary(full, own));
        for (const key of TEACHER_FULL_SCOPE_EXTRA_KEYS) expect(out && key in out, `${kind} ${key}`).toBe(false);
      }
    }
  });

  it('a full-scope class or school reads what a family reads, with its own plans only', () => {
    for (const kind of ['class', 'school'] as const) {
      expect(rosterSummary(everything, own, kind, { scope: 'full' })).toEqual(rosterSummary(everything, own, 'family'));
      expect(rosterSummary(everything, own, kind, { scope: 'full', detail: true })?.vocab).toEqual(vocab);
      expect(rosterSummary(everything, own, kind, { scope: 'full' })).toMatchObject({ vocab: rosterVocab, stage1Anchor: full.stage1Anchor, selfRoute, routeGoal });
      expect(JSON.stringify(rosterSummary(everything, own, kind, { scope: 'full' }))).not.toContain('plan:other-class');
    }
  });

  it('a family is full scope whatever scope a caller passes', () => {
    expect(rosterSummary(everything, own, 'family', { scope: 'base' })).toEqual(rosterSummary(everything, own, 'family'));
    expect(readsFullScope({ kind: 'family' })).toBe(true);
    expect(readsFullScope({ kind: 'class' })).toBe(false);
    expect(readsFullScope({ kind: 'school', scope: 'full' })).toBe(true);
  });

  it('copies only the known vocab and Hangul Check keys, never what a newer writer left under them', () => {
    const stored = { ...full, vocab: { ...vocab, perWord: 'secret' }, stage1Anchor: { ...full.stage1Anchor, answers: 'secret' } };
    const out = rosterSummary(stored, own, 'class', { scope: 'full', detail: true });
    expect(JSON.stringify(out)).not.toContain('secret');
    expect(out?.vocab).toEqual(vocab);
    expect(out?.stage1Anchor).toEqual(full.stage1Anchor);
  });

  it('leaves vocab and the Hangul Check out when they are missing or not objects', () => {
    const { stage1Anchor: _anchor, ...noAnchor } = full;
    for (const value of [undefined, null, 'vocab', ['x']]) {
      const out = rosterSummary({ ...noAnchor, vocab: value }, own, 'family');
      expect(out && 'vocab' in out).toBe(false);
      expect(out && 'stage1Anchor' in out).toBe(false);
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
  /** A base-scope class or school reads every word count as 0 ([TV]: words travel with vocab, at full scope only). */
  const zeroW = <T extends { w: number }>(row: T): T => ({ ...row, w: 0 });

  it('gives a family the whole activity, word counts included, every level projected to its known keys', () => {
    const out = activityOf(activity, { kind: 'family', joinedAt });
    expect(out).toEqual(activity);
    expect(ActivitySummarySchema.safeParse(out).success).toBe(true);
  });

  it('[TV] couples word counts with the scope: 0 at base scope, as sent at full scope (F-VOC-005 P-4b)', () => {
    for (const kind of ['class', 'school'] as const) {
      const base = activityOf(activity, { kind, joinedAt });
      for (const row of [...base.days, ...base.months, base.total]) expect(row.w).toBe(0);
      expect(activityOf(activity, { kind, joinedAt, scope: 'base' })).toEqual(base);
      // full scope: the whole history, as a family reads it
      expect(activityOf(activity, { kind, joinedAt, scope: 'full' })).toEqual(activityOf(activity, { kind: 'family', joinedAt }));
    }
    expect(activityOf(activity, { kind: 'family', joinedAt }).total.w).toBe(15);
  });

  it('for a class or a school drops days and milestones before the local join day, and months up to and including the join month', () => {
    for (const kind of ['class', 'school'] as const) {
      const out = activityOf(activity, { kind, joinedAt });
      expect(out.days.map((d) => d.d)).toEqual(['2026-10-10', '2026-10-12']);
      expect(out.milestones).toEqual([{ stage: 'stage2', on: '2026-10-10' }]);
      expect(out.months).toEqual([]);
      // lifetime counts stay (they match the roster's totals); the first practice day may be before joining
      expect(out.total).toEqual({ ...zeroW(activity.total), since: null });
      // the app's next quest stays, but never whether a plan chose it (a family plan or a self-route is family-only)
      expect(out.next).toEqual({ q: 'letters-q3', plan: false });
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

  it('never tells a class or a school whether a plan chose the next quest; a family reads the flag as sent', () => {
    for (const plan of [true, false]) {
      const withPlan = { ...activity, next: { q: 'letters-q3', plan } };
      expect(activityOf(withPlan, { kind: 'class', joinedAt }).next).toEqual({ q: 'letters-q3', plan: false });
      expect(activityOf(withPlan, { kind: 'school', joinedAt }).next).toEqual({ q: 'letters-q3', plan: false });
      expect(activityOf(withPlan, { kind: 'family', joinedAt }).next).toEqual({ q: 'letters-q3', plan });
    }
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
    expect(out.days).toEqual([activity.days[3]]);
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
