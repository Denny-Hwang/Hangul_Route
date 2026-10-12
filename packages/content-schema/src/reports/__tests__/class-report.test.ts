import { describe, expect, expectTypeOf, it } from 'vitest';
import { CATALOG_2026_10 } from '../../__tests__/fixtures/catalog-2026-10';
import { ClassReportSchema, type ActivityDay, type ActivitySummary, type ClassReport, type ReportPeriod } from '../../schemas/report';
import type { ReportSummary } from '../../schemas/report-response';
import { classAtOf, classReport, type ClassReportInput, type ClassReportLearner, type ClassReportPlan } from '../class-report';
import { NOW, STEADY, GAP } from './fixtures/activity-2026-10';
import { CLASS_20, CLASS_PLANS } from './fixtures/class-2026-10';

/**
 * F-REPORT-001 section 3.7 (RP-2c): class statistics, aggregates only. The headline, the class line, letters the class
 * got strong on and letters to revisit (ordered by count, then by the order they are taught), day bands per period,
 * the typical time (null under 3), level-check strand counts (OD-5), homework rows (newest 3, archived and drafts
 * skipped), stage milestones as events (OD-4), the up-only marker (OD-11), and the hard rules of section 3.7.
 */

type Input = Partial<ClassReportInput> & Pick<ClassReportInput, 'learners'>;
const report = (input: Input): ClassReport => classReport({ plans: [], period: 'week', now: NOW, catalog: CATALOG_2026_10, ...input });
const class20 = (period: ReportPeriod, extra: Partial<ClassReportInput> = {}): ClassReport => report({ learners: CLASS_20, plans: CLASS_PLANS, period, ...extra });

/** 15 October 2026 at 12:00 UTC; the learners built below are in UTC, so today is the 15th. */
const NOW_UTC = new Date('2026-10-15T12:00:00.000Z');

/**
 * A UTC class member who practiced on `rows` (day key -> minutes or counts), saved today, synced an hour ago, and who
 * joined the class on the first day their class copy holds (none: `joinedAt` null).
 */
function member(rows: Readonly<Record<string, Partial<Omit<ActivityDay, 'd'>>>>, extra: Partial<ReportSummary> = {}, activity: Partial<ActivitySummary> = {}): ClassReportLearner {
  const days: ActivityDay[] = Object.entries(rows)
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([d, row]) => ({ d, min: 10, q: 0, c: 0, w: 0, j: [], ...row }));
  const total = (key: 'min' | 'q' | 'c'): number => days.reduce((n, row) => n + row[key], 0);
  const firsts = [days[0]?.d, activity.months?.[0] ? `${activity.months[0].m}-01` : undefined, ...(activity.milestones ?? []).map((row) => row.on)];
  const joined = firsts.filter((day): day is string => day !== undefined).sort()[0];
  return {
    joinedAt: joined === undefined ? null : `${joined}T12:00:00.000Z`,
    summary: {
      lastActiveAt: '2026-10-15T09:00:00.000Z',
      needsPractice: [],
      planProgress: {},
      ...extra,
      activity: {
        v: 1,
        tz: 0,
        asOf: '2026-10-15',
        days,
        months: [],
        total: { since: null, min: total('min'), q: total('q'), c: total('c'), w: 0, days: days.length },
        milestones: [],
        ...activity,
      },
    },
    lastSyncedAt: '2026-10-15T11:00:00.000Z',
  };
}

describe('the class of 20, this week (section 3.15 fixtures)', () => {
  const r = class20('week');

  it('parses with ClassReportSchema', () => {
    expect(ClassReportSchema.parse(r)).toEqual(r);
  });

  it('headline: practiced of all members; no up marker when the class practiced as much as last week', () => {
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 9, learners: 20 });
  });

  it('class line: members, with day-by-day data, on an older app, and last saved more than 7 days ago (never saved: neither)', () => {
    // The 3 members whose devices never saved are `learners - withActivity - olderApp`, never "last saved 7 days ago".
    expect(r.class).toEqual({ learners: 20, withActivity: 13, olderApp: 4, notSaved7d: 0 });
  });

  it('what went well: letters by number of learners then letter order; sums; Stage 1 finished 3 times this week', () => {
    expect(r.wentWell).toEqual({
      lettersNew: [
        { letter: 'ㄱ', learners: 6 },
        { letter: 'ㄴ', learners: 6 },
        { letter: 'ㄷ', learners: 3 },
        { letter: 'ㄹ', learners: 3 },
      ],
      questsNew: { count: 33 },
      cardsNew: 18,
      milestones: [{ stage: 'stage1', count: 3 }],
    });
  });

  it('letters to revisit together, from every summary (an older app too)', () => {
    expect(r.revisit).toEqual([
      { letter: 'ㅂ', learners: 10 },
      { letter: 'ㅅ', learners: 6 },
      { letter: 'ㄹ', learners: 4 },
    ]);
  });

  it('day bands: 0, 1-2, 3-4, 5-7 among learners with day-by-day data; none not saved this week', () => {
    expect(r.practice).toEqual({
      dayBands: [
        { band: '0', learners: 4 },
        { band: '1-2', learners: 0 },
        { band: '3-4', learners: 9 },
        { band: '5-7', learners: 0 },
      ],
      notSaved: 0,
    });
  });

  it('the bands and notSaved add up to withActivity, on every period with bands and on a past window', () => {
    for (const [period, at] of [['day', null], ['week', null], ['month', null], ['day', '2026-10-13'], ['week', '2026-10-08'], ['month', '2026-09-10']] as const) {
      const c = class20(period, { at });
      const sum = (c.practice.dayBands ?? []).reduce((n, band) => n + band.learners, 0) + (c.practice.notSaved ?? 0);
      expect(sum, `${period} ${at}`).toBe(c.class.withActivity);
    }
  });

  it('time: the total and the median of those who practiced; no up marker when it did not grow (40 -> 36)', () => {
    expect(r.time).toEqual({ minutesTotal: { count: 306 }, minutesMedian: 36 });
  });

  it('level check: counts per strand among learners who took one; no level distribution', () => {
    expect(r.levelCheck).toEqual([
      { strand: 'hangul-recognition', secure: 10, gettingThere: 0, notYet: 0, notTested: 0 },
      { strand: 'sound-letter', secure: 0, gettingThere: 10, notYet: 0, notTested: 0 },
      { strand: 'syllable-reading', secure: 0, gettingThere: 0, notYet: 10, notTested: 0 },
      { strand: 'vocabulary', secure: 0, gettingThere: 0, notYet: 0, notTested: 10 },
      { strand: 'sentences', secure: 0, gettingThere: 0, notYet: 0, notTested: 10 },
    ]);
  });

  it('homework: the newest 3 published plans; drafts and archived plans skipped; no per-learner rows', () => {
    expect(r.plans).toEqual([
      { planId: 'plan:class-week', title: 'This week: letters and sounds', assigned: 17, started: 14, finished: 4, itemsDone: 42 },
      { planId: 'plan:class-letters', title: 'First consonants', assigned: 6, started: 6, finished: 6, itemsDone: 24 },
      { planId: 'plan:class-old', title: 'Vowels review', assigned: 3, started: 3, finished: 3, itemsDone: 6 },
    ]);
  });
});

describe('the class of 20 by period', () => {
  it('month: calendar month to date from month rows; bands 0, 1-4, 5-9, 10+; no comparison with a month the class saw only in part', () => {
    const r = class20('month');
    expect(ClassReportSchema.parse(r)).toEqual(r);
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 9, learners: 20 });
    expect(r.practice.dayBands).toEqual([
      { band: '0', learners: 4 },
      { band: '1-4', learners: 0 },
      { band: '5-9', learners: 6 },
      { band: '10+', learners: 3 },
    ]);
    expect(r.time).toEqual({ minutesTotal: { count: 786 }, minutesMedian: 76 });
    expect(r.wentWell.questsNew).toEqual({ count: 69 });
    expect(r.wentWell.cardsNew).toBe(39);
    expect(r.wentWell.lettersNew).toEqual([
      { letter: 'ㄱ', learners: 6 },
      { letter: 'ㄴ', learners: 6 },
      { letter: 'ㅇ', learners: 6 },
      { letter: 'ㄷ', learners: 3 },
      { letter: 'ㄹ', learners: 3 },
    ]);
  });

  it('day: practiced and not yet; a learner whose device has not saved today is in neither band', () => {
    const r = class20('day');
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 6, learners: 20 });
    // Jun (saved yesterday) and Sora (saved 4 days ago): today is not saved on their devices, so not "Not yet".
    expect(r.practice.dayBands).toEqual([
      { band: 'practiced', learners: 6 },
      { band: 'not_yet', learners: 0 },
    ]);
    expect(r.time).toEqual({ minutesTotal: { count: 90 }, minutesMedian: 15 });
    expect(r.wentWell.milestones).toEqual([]);
  });

  it('all: learners who ever practiced, lifetime sums, no bands, every milestone; a tie goes to the letter taught first', () => {
    const r = class20('all');
    expect(ClassReportSchema.parse(r)).toEqual(r);
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 13, learners: 20 });
    expect(r.practice).toEqual({});
    expect(r.time).toEqual({ minutesTotal: { count: 1476 }, minutesMedian: 110 });
    expect(r.wentWell.questsNew).toEqual({ count: 95 });
    expect(r.wentWell.cardsNew).toBe(65);
    expect(r.wentWell.milestones).toEqual([{ stage: 'stage1', count: 3 }]);
    // ㅏ and ㅓ are taught before ㄴ, though ㄴ comes first by code point.
    expect(r.wentWell.lettersNew).toEqual([
      { letter: 'ㄱ', learners: 10 },
      { letter: 'ㅏ', learners: 6 },
      { letter: 'ㅓ', learners: 6 },
      { letter: 'ㄴ', learners: 6 },
      { letter: 'ㅗ', learners: 6 },
    ]);
  });

  it('an unknown period reads as week', () => {
    expect(class20('year' as ReportPeriod)).toEqual(class20('week'));
  });

  it('a past week (`at`): every learner reads the same days', () => {
    const r = class20('week', { at: '2026-10-08' });
    // 2 to 8 October: Mina 2 days (40 minutes), Sora 7 days (70 minutes); Jun nothing.
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 9, learners: 20 });
    // Against 25 September to 1 October, among learners the class saw all of that week (all joined on 1 September):
    // Mina 15 minutes each, Jun none, Sora 10 minutes on 1 October.
    expect(r.time.minutesTotal).toEqual({ count: 450, up: true });
    expect(r.practice.dayBands).toEqual([
      { band: '0', learners: 4 },
      { band: '1-2', learners: 6 },
      { band: '3-4', learners: 0 },
      { band: '5-7', learners: 3 },
    ]);
  });
});

describe('behaviours', () => {
  it('behaviour 5: a class of 12 where 2 practiced: "2 of 12", no median, the total only', () => {
    const steady: ClassReportLearner = CLASS_20[0] as ClassReportLearner;
    const quiet: ClassReportLearner = CLASS_20[6] as ClassReportLearner;
    const r = report({ learners: [steady, steady, ...Array.from({ length: 10 }, () => quiet)] });
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 2, learners: 12 });
    expect(r.time).toEqual({ minutesTotal: { count: 72 }, minutesMedian: null });
  });

  it('the median needs 3 who practiced; an even count rounds the mean of the middle two', () => {
    const at = (min: number): ClassReportLearner => member({ '2026-10-14': { min } });
    expect(report({ learners: [at(10), at(20)], now: NOW_UTC }).time.minutesMedian).toBeNull();
    expect(report({ learners: [at(10), at(20), at(40)], now: NOW_UTC }).time.minutesMedian).toBe(20);
    expect(report({ learners: [at(10), at(20), at(25), at(40)], now: NOW_UTC }).time.minutesMedian).toBe(23);
  });

  it('no learners yet: zeros, no lines, no plans rows from summaries', () => {
    const r = report({ learners: [], plans: CLASS_PLANS });
    expect(ClassReportSchema.parse(r)).toEqual(r);
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 0, learners: 0 });
    expect(r.class).toEqual({ learners: 0, withActivity: 0, olderApp: 0, notSaved7d: 0 });
    expect(r.levelCheck).toEqual([]);
    expect(r.revisit).toEqual([]);
    expect(r.time).toEqual({ minutesTotal: { count: 0 }, minutesMedian: null });
    expect(r.plans.map((p) => [p.planId, p.assigned])).toEqual([
      ['plan:class-week', 0],
      ['plan:class-letters', 0],
      ['plan:class-old', 0],
    ]);
  });

  it('all on an older app: revisit letters and level-check counts still render; day-by-day blocks hold nothing', () => {
    const legacy = CLASS_20[10] as ClassReportLearner;
    const r = report({ learners: [legacy, legacy] });
    expect(r.class).toEqual({ learners: 2, withActivity: 0, olderApp: 2, notSaved7d: 0 });
    expect(r.revisit).toEqual([{ letter: 'ㄹ', learners: 2 }]);
    expect(r.levelCheck).toHaveLength(5);
    expect(r.practice.dayBands).toEqual([
      { band: '0', learners: 0 },
      { band: '1-2', learners: 0 },
      { band: '3-4', learners: 0 },
      { band: '5-7', learners: 0 },
    ]);
  });
});

describe('the up-only marker (OD-11): against the class\'s own previous window, never down', () => {
  it('marks practiced, minutes and new quests when each grew', () => {
    const r = report({
      now: NOW_UTC,
      learners: [
        member({ '2026-09-15': {}, '2026-10-05': { min: 10, q: 1 }, '2026-10-14': { min: 20, q: 2 } }),
        member({ '2026-09-15': {}, '2026-10-13': { min: 15 } }),
      ],
    });
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 2, learners: 2, up: true });
    expect(r.time.minutesTotal).toEqual({ count: 35, up: true });
    expect(r.wentWell.questsNew).toEqual({ count: 2, up: true });
  });

  it('nothing when equal or less, and nothing when the previous window had none', () => {
    const less = report({ now: NOW_UTC, learners: [member({ '2026-09-15': {}, '2026-10-05': { min: 30, q: 2 }, '2026-10-14': { min: 20, q: 1 } })] });
    expect([less.headline.up, less.time.minutesTotal.up, less.wentWell.questsNew.up]).toEqual([undefined, undefined, undefined]);
    const none = report({ now: NOW_UTC, learners: [member({ '2026-09-20': {}, '2026-10-14': { q: 1 } })] });
    expect([none.headline.up, none.time.minutesTotal.up, none.wentWell.questsNew.up]).toEqual([undefined, undefined, undefined]);
  });

  it('a learner whose previous window the class did not wholly see is left out of the comparison on both sides', () => {
    // A learner known last week (30 minutes, then 10) and a newcomer whose first day here is this week (50).
    const known = member({ '2026-09-15': {}, '2026-10-05': { min: 30 }, '2026-10-14': { min: 10 } });
    const newcomer = member({ '2026-10-13': { min: 50 } });
    const r = report({ now: NOW_UTC, learners: [known, newcomer] });
    expect(r.time.minutesTotal).toEqual({ count: 60 });
    expect(r.headline.up).toBeUndefined();
  });

  it('a month compares with the previous month row, or with day rows that hold it whole', () => {
    const rows = member({ '2026-09-20': { min: 10 }, '2026-10-03': { min: 20 } }, {}, { months: [{ m: '2026-09', min: 10, q: 0, c: 0, w: 0, days: 1 }, { m: '2026-10', min: 20, q: 0, c: 0, w: 0, days: 1 }] });
    expect(report({ now: NOW_UTC, period: 'month', learners: [rows] }).time.minutesTotal).toEqual({ count: 20, up: true });
    // No month rows, but on 3 September the day rows reach back past 1 August: August is known whole.
    const whole = member({ '2026-07-31': {}, '2026-08-05': { min: 10 }, '2026-09-02': { min: 20 } }, {}, { asOf: '2026-09-03' });
    expect(report({ now: new Date('2026-09-03T12:00:00.000Z'), period: 'month', learners: [whole] }).time.minutesTotal).toEqual({ count: 20, up: true });
    // On 28 September they no longer do: no comparison.
    const later = member({ '2026-08-25': {}, '2026-09-02': { min: 20 } }, {}, { asOf: '2026-09-28' });
    expect(report({ now: new Date('2026-09-28T12:00:00.000Z'), period: 'month', learners: [later] }).time.minutesTotal).toEqual({ count: 20 });
  });

  it('a month: a member with no row for last month, who was in the class before it, counts as 0 then (back this month)', () => {
    const aug = { m: '2026-08', min: 10, q: 1, c: 0, w: 0, days: 1 };
    const both = member({ '2026-10-03': { min: 30, q: 2 } }, {}, { months: [aug, { m: '2026-09', min: 10, q: 1, c: 0, w: 0, days: 1 }, { m: '2026-10', min: 30, q: 2, c: 0, w: 0, days: 1 }] });
    const back = (): ClassReportLearner => member({ '2026-10-03': { min: 20, q: 1 } }, {}, { months: [aug, { m: '2026-10', min: 20, q: 1, c: 0, w: 0, days: 1 }] });
    const r = report({ now: NOW_UTC, period: 'month', learners: [both, back(), back()] });
    // October: 3 practiced, 70 minutes, 4 quests; September: 1 practiced (10 minutes, 1 quest), 0 for the other two.
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 3, learners: 3, up: true });
    expect(r.time.minutesTotal).toEqual({ count: 70, up: true });
    expect(r.wentWell.questsNew).toEqual({ count: 4, up: true });
  });

  it('a month: a member whose first row is in last month (joined then) sits out the comparison', () => {
    const known = member({ '2026-10-03': { min: 10 } }, {}, { months: [{ m: '2026-08', min: 40, q: 0, c: 0, w: 0, days: 2 }, { m: '2026-09', min: 30, q: 0, c: 0, w: 0, days: 2 }, { m: '2026-10', min: 10, q: 0, c: 0, w: 0, days: 1 }] });
    // The class copy starts on 20 September (no September row: the join month), so September is not known whole.
    const joined = member({ '2026-09-20': { min: 5 }, '2026-10-04': { min: 60 } }, {}, { months: [{ m: '2026-10', min: 60, q: 0, c: 0, w: 0, days: 1 }] });
    const r = report({ now: NOW_UTC, period: 'month', learners: [known, joined] });
    // Compared: the known member only, 10 minutes against 30. With the newcomer it would read 70 against 35.
    expect(r.time.minutesTotal).toEqual({ count: 70 });
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 2, learners: 2 });
  });

  it('a month: a month older than the newest 24 month rows the device keeps is not known as empty', () => {
    // 24 rows, November 2024 to October 2026, and a stage finished in June 2024 (the class copy starts there).
    const months = Array.from({ length: 24 }, (_, i) => {
      const index = 2024 * 12 + 10 + i;
      return { m: `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`, min: 5, q: 0, c: 0, w: 0, days: 1 };
    });
    expect([months[0]?.m, months[23]?.m]).toEqual(['2024-11', '2026-10']);
    const milestones = [{ stage: 'stage1', on: '2024-06-01' }];
    const full = member({ '2026-10-02': { min: 5 } }, {}, { months, milestones });
    const bands = (r: ClassReport): number => (r.practice.dayBands ?? []).reduce((n, b) => n + b.learners, 0);
    // October 2024 has no row and is older than the oldest kept one: its row may have been dropped, so it is unknown.
    expect(bands(report({ now: NOW_UTC, period: 'month', at: '2024-10-10', learners: [full] }))).toBe(0);
    // With 23 rows nothing was dropped: no October 2024 row means no practice then.
    const fewer = member({ '2026-10-02': { min: 5 } }, {}, { months: months.slice(1), milestones });
    const r = report({ now: NOW_UTC, period: 'month', at: '2024-10-10', learners: [fewer] });
    expect(r.practice.dayBands?.[0]).toEqual({ band: '0', learners: 1 });
  });

  it('day and all never carry the marker', () => {
    const grew = member({ '2026-10-14': { min: 10 }, '2026-10-15': { min: 40 } });
    expect(report({ now: NOW_UTC, period: 'day', learners: [grew] }).time.minutesTotal).toEqual({ count: 40 });
    expect(report({ now: NOW_UTC, period: 'all', learners: [grew] }).time.minutesTotal).toEqual({ count: 50 });
  });
});

describe('not saved is never "did not practice"', () => {
  const bands = (r: ClassReport): Record<string, number> => Object.fromEntries((r.practice.dayBands ?? []).map((b) => [b.band, b.learners]));

  it('a member who joined after a past week is in no band for it, and counts no figure there', () => {
    const steady = member({ '2026-09-15': {}, '2026-10-06': { min: 20 } });
    const newcomer = member({ '2026-10-13': { min: 50, j: ['ㄱ'] } }, {}, { milestones: [{ stage: 'stage1', on: '2026-10-13' }] });
    const r = report({ now: NOW_UTC, at: '2026-10-08', learners: [steady, newcomer] });
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 1, learners: 2 });
    expect(bands(r)).toEqual({ '0': 0, '1-2': 1, '3-4': 0, '5-7': 0 });
    expect(r.time.minutesTotal).toEqual({ count: 20 });
    expect(r.wentWell.lettersNew).toEqual([]);
    expect(r.wentWell.milestones).toEqual([]);
    // This week the newcomer counts.
    expect(bands(report({ now: NOW_UTC, learners: [steady, newcomer] }))).toEqual({ '0': 1, '1-2': 1, '3-4': 0, '5-7': 0 });
  });

  it('a device whose last saved day is before the window is in no band for it (and counts as not saved in 7 days)', () => {
    const fresh = member({ '2026-10-14': {} });
    const stale = member({ '2026-09-28': {}, '2026-10-01': {} }, {}, { asOf: '2026-10-01' });
    const r = report({ now: NOW_UTC, learners: [fresh, stale] });
    expect(bands(r)).toEqual({ '0': 0, '1-2': 1, '3-4': 0, '5-7': 0 });
    expect(r.class.notSaved7d).toBe(1);
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 1, learners: 2 });
    // A week that reaches past the last saved day reads its saved part: Jun's quiet saved days are "Not yet".
    const partial = member({ '2026-09-28': {} }, {}, { asOf: '2026-10-13' });
    expect(bands(report({ now: NOW_UTC, learners: [partial] }))).toEqual({ '0': 1, '1-2': 0, '3-4': 0, '5-7': 0 });
  });

  it('a past day older than a learner\'s day rows: that learner sits out', () => {
    // In the class since July. asOf 15 October: day rows from 11 September.
    const current = member({ '2026-09-15': {}, '2026-10-14': {} }, {}, { months: [{ m: '2026-07', min: 10, q: 0, c: 0, w: 0, days: 1 }] });
    // Saved on 20 September: day rows from 17 August.
    const early = member({ '2026-08-20': {}, '2026-09-10': {} }, {}, { asOf: '2026-09-20' });
    expect(bands(report({ now: NOW_UTC, period: 'day', at: '2026-09-10', learners: [current, early] }))).toEqual({ practiced: 1, not_yet: 0 });
    // Both hold 12 September in their day rows, with no practice: "Not yet" for both.
    expect(bands(report({ now: NOW_UTC, period: 'day', at: '2026-09-12', learners: [current, early] }))).toEqual({ practiced: 0, not_yet: 2 });
    // A day before the first day the class copy holds: the member sits out.
    expect(bands(report({ now: NOW_UTC, period: 'day', at: '2026-09-12', learners: [member({ '2026-09-15': {} })] }))).toEqual({ practiced: 0, not_yet: 0 });
  });

  it('`all` reads lifetime totals: practice from before the learner joined counts, letters and milestones do not', () => {
    // The class copy: total kept (20 days, 300 minutes, 9 quests, 4 cards), day rows from the join day only.
    const joined = member({ '2026-10-10': { min: 10, j: ['ㄴ'] } }, {}, { total: { since: null, min: 300, q: 9, c: 4, w: 0, days: 20 } });
    const r = report({ now: NOW_UTC, period: 'all', learners: [joined] });
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 1, learners: 1 });
    expect(r.time.minutesTotal).toEqual({ count: 300 });
    expect(r.wentWell.questsNew).toEqual({ count: 9 });
    expect(r.wentWell.cardsNew).toBe(4);
    expect(r.wentWell.lettersNew).toEqual([{ letter: 'ㄴ', learners: 1 }]);
  });
});

describe('the class stepper limits (section 3.2): `at` outside them reads as the current window', () => {
  it('classAtOf: day and week within the 35 day rows of the widest offsets; month within 24 months; all never', () => {
    // NOW_UTC 15 October 12:00 UTC: the westernmost today is 14 October, the easternmost 16 October.
    expect(classAtOf('week', '2026-10-08', NOW_UTC)).toBe('2026-10-08');
    expect(classAtOf('day', '2026-09-10', NOW_UTC)).toBe('2026-09-10');
    expect(classAtOf('day', '2026-09-09', NOW_UTC)).toBeNull();
    expect(classAtOf('week', '2026-10-16', NOW_UTC)).toBe('2026-10-16');
    expect(classAtOf('week', '2026-10-17', NOW_UTC)).toBeNull();
    expect(classAtOf('week', '2020-01-07', NOW_UTC)).toBeNull();
    expect(classAtOf('month', '2024-10-20', NOW_UTC)).toBe('2024-10-01');
    expect(classAtOf('month', '2024-09-30', NOW_UTC)).toBeNull();
    expect(classAtOf('all', '2026-10-08', NOW_UTC)).toBeNull();
    expect(classAtOf('year' as ReportPeriod, '2026-10-08', NOW_UTC)).toBe('2026-10-08');
    for (const bad of [null, undefined, '', '2026-02-30', 'last-week']) expect(classAtOf('week', bad, NOW_UTC)).toBeNull();
    expect(classAtOf('week', '2026-10-08', new Date('nonsense'))).toBeNull();
  });

  it('an out-of-range week or month reads as the current one', () => {
    expect(class20('week', { at: '2020-01-07' })).toEqual(class20('week'));
    expect(class20('month', { at: '2023-05-10' })).toEqual(class20('month'));
    expect(class20('day', { at: '2026-08-01' })).toEqual(class20('day'));
  });
});

describe('details', () => {
  it('not saved in 7 days: by the last sync, by the device\'s last day, or never synced; an unreadable sync is not stale', () => {
    const oldSync = { ...member({ '2026-10-14': {} }), lastSyncedAt: '2026-10-07T11:00:00.000Z' };
    const oldAsOf = member({ '2026-10-01': {} }, {}, { asOf: '2026-10-07' });
    const fresh = member({ '2026-10-14': {} });
    const unreadable = { ...fresh, lastSyncedAt: 'yesterday' };
    const never = { summary: STEADY, lastSyncedAt: null, joinedAt: null };
    // A device that never saved a summary is not "last saved more than 7 days ago".
    const r = report({ now: NOW_UTC, learners: [oldSync, oldAsOf, fresh, unreadable, never, { summary: null, lastSyncedAt: null, joinedAt: null }] });
    expect(r.class).toEqual({ learners: 6, withActivity: 5, olderApp: 0, notSaved7d: 2 });
  });

  it('an invalid clock never breaks the report: each learner\'s today is their last saved day and nothing is stale', () => {
    const r = report({ now: new Date('nonsense'), learners: [member({ '2026-10-15': { min: 7 } }), { summary: GAP, lastSyncedAt: '2020-01-01T00:00:00.000Z', joinedAt: null }] });
    expect(r.class.notSaved7d).toBe(0);
    expect(r.time.minutesTotal.count).toBe(7);
  });

  it('a totals-only month (older than the day rows) reads month rows only, no letters', () => {
    const old = member({ '2026-10-14': { j: ['ㄱ'] } }, {}, { months: [{ m: '2026-08', min: 50, q: 2, c: 1, w: 0, days: 4 }, { m: '2026-10', min: 10, q: 0, c: 0, w: 0, days: 1 }] });
    const noRow = member({ '2026-10-14': {} });
    // Older than the day rows but without an August row: nothing counted for August.
    const quietAugust = member({ '2026-10-14': {} }, {}, { months: [{ m: '2026-07', min: 30, q: 1, c: 0, w: 0, days: 2 }, { m: '2026-10', min: 10, q: 0, c: 0, w: 0, days: 1 }] });
    const r = report({ now: NOW_UTC, period: 'month', at: '2026-08-10', learners: [old, noRow, quietAugust] });
    expect(r.time.minutesTotal).toEqual({ count: 50 });
    expect(r.headline.practiced).toBe(1);
    expect(r.wentWell.lettersNew).toEqual([]);
  });

  it('a learner counts once per letter; only taught letters and known stages are counted; ties by code point last', () => {
    const odd = member(
      { '2026-10-13': { j: ['ㄱ'] }, '2026-10-14': { j: ['ㄱ', 'ㆍ'] } },
      { needsPractice: ['ㅂ', 'ㅂ', 'sym:x', 'ㆎ', 'ㆍ'] },
      { milestones: [{ stage: 'stage9', on: '2026-10-14' }, { stage: 'stage2', on: '2026-10-14' }, { stage: 'stage1', on: '2026-10-13' }] },
    );
    const r = report({ now: NOW_UTC, learners: [odd] });
    expect(r.wentWell.lettersNew).toEqual([
      { letter: 'ㄱ', learners: 1 },
      { letter: 'ㆍ', learners: 1 },
    ]);
    // Letters the catalogue does not teach come after the taught ones, by code point.
    expect(r.revisit).toEqual([
      { letter: 'ㅂ', learners: 1 },
      { letter: 'ㆍ', learners: 1 },
      { letter: 'ㆎ', learners: 1 },
    ]);
    expect(r.wentWell.milestones).toEqual([
      { stage: 'stage1', count: 1 },
      { stage: 'stage2', count: 1 },
    ]);
  });

  it('a summary with no letters to revisit and no level check adds nothing there', () => {
    const r = report({ learners: [{ summary: { lastActiveAt: '2026-10-10T08:00:00.000Z' }, lastSyncedAt: null, joinedAt: null }] });
    expect([r.revisit, r.levelCheck, r.class.olderApp]).toEqual([[], [], 1]);
  });

  it('untaught letters tie by code point, whatever order they come in', () => {
    const odd = (letters: string[]): ClassReportLearner => member({}, { needsPractice: letters });
    expect(report({ learners: [odd(['ㆎ', 'ㆍ', 'ㆌ'])] }).revisit.map((row) => row.letter)).toEqual(['ㆌ', 'ㆍ', 'ㆎ']);
    expect(report({ learners: [odd(['ㆌ', 'ㆍ', 'ㆎ'])] }).revisit.map((row) => row.letter)).toEqual(['ㆌ', 'ㆍ', 'ㆎ']);
  });

  it('at most 5 letters in each block', () => {
    const many = member({ '2026-10-14': { j: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ'] } });
    expect(report({ now: NOW_UTC, learners: [many] }).wentWell.lettersNew).toHaveLength(5);
  });

  it('homework: a plan with no items for a learner is not assigned to them; ties in time go by id', () => {
    const plan = (id: string): ClassReportPlan => ({ id, title: id.slice(5).toUpperCase(), publishedAt: '2026-10-01T00:00:00.000Z', archivedAt: null, createdAt: '2026-10-01T00:00:00.000Z' });
    const plans = [plan('plan:c'), plan('plan:b'), plan('plan:d'), plan('plan:a')];
    expect(report({ learners: [], plans }).plans.map((row) => row.planId)).toEqual(['plan:a', 'plan:b', 'plan:c']);
    expect(report({ learners: [], plans: [...plans].reverse() }).plans.map((row) => row.planId)).toEqual(['plan:a', 'plan:b', 'plan:c']);
    const r = report({ now: NOW_UTC, plans, learners: [member({}, { planProgress: { 'plan:a': { done: 0, total: 0, notReady: 2 }, 'plan:b': { done: 0, total: 3, notReady: 0 } } })] });
    expect(r.plans).toEqual([
      { planId: 'plan:a', title: 'A', assigned: 0, started: 0, finished: 0, itemsDone: 0 },
      { planId: 'plan:b', title: 'B', assigned: 1, started: 0, finished: 0, itemsDone: 0 },
      { planId: 'plan:c', title: 'C', assigned: 0, started: 0, finished: 0, itemsDone: 0 },
    ]);
  });
});

describe('the join day: where the class\'s view of a member begins', () => {
  const bands = (r: ClassReport): Record<string, number> => Object.fromEntries((r.practice.dayBands ?? []).map((b) => [b.band, b.learners]));
  const longAgo = '2026-09-01T12:00:00.000Z';

  it('two quiet members who joined long ago read 0 this week, whether their device saved today or yesterday', () => {
    const today = { ...member({}), joinedAt: longAgo };
    const yesterday = { ...member({}, {}, { asOf: '2026-10-14' }), joinedAt: longAgo };
    const r = report({ now: NOW_UTC, learners: [today, yesterday] });
    expect(r.practice).toEqual({ dayBands: [{ band: '0', learners: 2 }, { band: '1-2', learners: 0 }, { band: '3-4', learners: 0 }, { band: '5-7', learners: 0 }], notSaved: 0 });
    // On `day`, today is not saved yet on the second device: not "Not yet".
    expect(report({ now: NOW_UTC, period: 'day', learners: [today, yesterday] }).practice).toEqual({
      dayBands: [{ band: 'practiced', learners: 0 }, { band: 'not_yet', learners: 1 }],
      notSaved: 1,
    });
  });

  it('a past week: a member in the class then reads 0 though their first row is later; one who joined after it is not saved', () => {
    const quietThen = { ...member({ '2026-10-13': { min: 20 } }), joinedAt: longAgo };
    const joinedLater = { ...member({ '2026-10-13': { min: 20 } }), joinedAt: '2026-10-10T12:00:00.000Z' };
    const r = report({ now: NOW_UTC, at: '2026-10-08', learners: [quietThen, joinedLater] });
    expect(r.practice).toEqual({ dayBands: [{ band: '0', learners: 1 }, { band: '1-2', learners: 0 }, { band: '3-4', learners: 0 }, { band: '5-7', learners: 0 }], notSaved: 1 });
    expect(r.headline).toEqual({ code: 'class_practiced', practiced: 0, learners: 2 });
  });

  it('the join day is the learner-local one (at activity.tz); an unreadable join time falls back to the first day the copy holds', () => {
    // Joined at 03:00 UTC on 9 October: 8 October in Los Angeles, so the week to 8 October is known (0) there.
    const la = { ...member({ '2026-10-13': {} }, {}, { tz: -420 }), joinedAt: '2026-10-09T03:00:00.000Z' };
    const utc = { ...member({ '2026-10-13': {} }), joinedAt: '2026-10-09T03:00:00.000Z' };
    expect(report({ now: NOW_UTC, at: '2026-10-08', learners: [la] }).practice.notSaved).toBe(0);
    expect(report({ now: NOW_UTC, at: '2026-10-08', learners: [utc] }).practice.notSaved).toBe(1);
    // 'soon' does not parse: the first row (13 October) stands in, so the week to 8 October is not saved.
    const soon = { ...member({ '2026-10-13': {} }), joinedAt: 'soon' };
    expect(report({ now: NOW_UTC, at: '2026-10-08', learners: [soon] }).practice.notSaved).toBe(1);
  });

  it('a day or month not begun in a member\'s offset is not saved for them, never their previous day under its name', () => {
    // 03:00 UTC on 15 October: today is the 14th in Los Angeles (tz -420), the 15th in Seoul.
    const early = new Date('2026-10-15T03:00:00.000Z');
    const la = { ...member({ '2026-10-14': { min: 25 } }, {}, { tz: -420, asOf: '2026-10-14' }), joinedAt: longAgo };
    const seoul = { ...member({ '2026-10-15': { min: 5 } }, {}, { tz: 540 }), joinedAt: longAgo };
    const day = report({ now: early, period: 'day', at: '2026-10-15', learners: [la, seoul] });
    expect(day.practice).toEqual({ dayBands: [{ band: 'practiced', learners: 1 }, { band: 'not_yet', learners: 0 }], notSaved: 1 });
    expect(day.time.minutesTotal).toEqual({ count: 5 });
    expect(report({ now: early, period: 'week', at: '2026-10-15', learners: [la, seoul] }).practice.notSaved).toBe(1);
    // The current window (no `at`) is each member's own today.
    expect(report({ now: early, period: 'day', learners: [la, seoul] }).time.minutesTotal).toEqual({ count: 30 });
    // 1 November in Seoul, still 31 October in Los Angeles: November has not begun there.
    const nov = new Date('2026-11-01T03:00:00.000Z');
    const month = report({ now: nov, period: 'month', at: '2026-11-01', learners: [la] });
    expect(month.practice.notSaved).toBe(1);
    expect(report({ now: nov, period: 'month', at: '2026-10-20', learners: [la] }).practice.notSaved).toBe(0);
  });
});

describe('homework order', () => {
  it('newest published first: a plan drafted weeks ago and published today comes first; then newest created, then id', () => {
    const plan = (id: string, createdAt: string, publishedAt: string): ClassReportPlan => ({ id, title: id.slice(5), publishedAt, archivedAt: null, createdAt });
    const plans = [
      plan('plan:old-draft', '2026-09-01T08:00:00.000Z', '2026-10-15T08:00:00.000Z'),
      plan('plan:week', '2026-10-05T08:00:00.000Z', '2026-10-05T09:00:00.000Z'),
      plan('plan:letters', '2026-09-20T08:00:00.000Z', '2026-09-20T09:00:00.000Z'),
      plan('plan:twin-b', '2026-09-10T08:00:00.000Z', '2026-09-20T09:00:00.000Z'),
    ];
    expect(report({ learners: [], plans }).plans.map((row) => row.planId)).toEqual(['plan:old-draft', 'plan:week', 'plan:letters']);
    expect(report({ learners: [], plans: [...plans].reverse() }).plans.map((row) => row.planId)).toEqual(['plan:old-draft', 'plan:week', 'plan:letters']);
  });
});

describe('hard rules (section 3.7)', () => {
  const reports = (['day', 'week', 'month', 'all'] as const).map((period) => class20(period));

  /** Every key of a value, at every depth (array indices left out). */
  const keysOf = (value: unknown): string[] =>
    value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [...(/^\d+$/.test(k) ? [] : [k]), ...keysOf(v)]) : [];
  /** Every array of a value, at every depth. */
  const arraysOf = (value: unknown): unknown[][] =>
    Array.isArray(value) ? [value, ...value.flatMap(arraysOf)] : value && typeof value === 'object' ? Object.values(value).flatMap(arraysOf) : [];
  /** Every number of a value, at every depth. */
  const numbersOf = (value: unknown): number[] =>
    typeof value === 'number' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(numbersOf) : [];

  it('no learner id, name or avatar anywhere', () => {
    for (const r of reports) {
      const keys = keysOf(r);
      for (const banned of ['id', 'learnerId', 'profileId', 'displayName', 'name', 'avatar', 'initials']) expect(keys, banned).not.toContain(banned);
      expect(JSON.stringify(r)).not.toMatch(/profile:/);
    }
  });

  it('no per-learner array: no array as long as the class', () => {
    for (const r of reports) for (const array of arraysOf(r)) expect(array.length).not.toBe(CLASS_20.length);
  });

  it('no top, most, least, best, lowest, rank or average field', () => {
    const banned = new Set(['top', 'most', 'least', 'best', 'worst', 'lowest', 'highest', 'rank', 'average', 'avg', 'mean', 'max', 'min', 'percent', 'rate', 'accuracy']);
    const words = (key: string): string[] => key.split(/_|(?=[A-Z])/).map((w) => w.toLowerCase());
    for (const r of reports) for (const key of keysOf(r)) for (const word of words(key)) expect(banned.has(word), key).toBe(false);
  });

  it('no standing distribution by stage or level (OD-4): where learners are on the route changes nothing', () => {
    const moved = CLASS_20.map((learner) =>
      learner.summary
        ? { ...learner, summary: { ...learner.summary, journey: { v: 1 as const, here: 'stage3', stages: [{ stage: 'stage3', state: 'open', done: 9, known: 0, total: 9 }] } } }
        : learner,
    );
    expect(report({ learners: moved, plans: CLASS_PLANS })).toEqual(class20('week'));
    for (const r of reports) expect(keysOf(r)).not.toEqual(expect.arrayContaining(['here']));
  });

  it('no percentage (OD-6): every number is a whole count', () => {
    for (const r of reports) for (const n of numbersOf(r)) expect(Number.isInteger(n), String(n)).toBe(true);
  });

  it('nothing is ordered by any learner: the order of the members changes nothing', () => {
    for (const period of ['day', 'week', 'month', 'all'] as const) {
      expect(report({ learners: [...CLASS_20].reverse(), plans: [...CLASS_PLANS].reverse(), period })).toEqual(class20(period));
    }
  });

  it('the input has no slot for an id, a name or a space kind', () => {
    expectTypeOf<keyof ClassReportLearner>().toEqualTypeOf<'summary' | 'lastSyncedAt' | 'joinedAt'>();
    expectTypeOf<keyof ClassReportInput>().toEqualTypeOf<'learners' | 'plans' | 'period' | 'at' | 'now' | 'catalog'>();
  });

  it('the level check never reads oralStage', () => {
    const oral = CLASS_20.map((learner) =>
      learner.summary?.placement ? { ...learner, summary: { ...learner.summary, placement: { ...learner.summary.placement, oralStage: null } } } : learner,
    );
    expect(report({ learners: oral, plans: CLASS_PLANS })).toEqual(class20('week'));
  });
});
