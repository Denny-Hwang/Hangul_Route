import { describe, expect, it } from 'vitest';
import { CATALOG_2026_10 } from '../../__tests__/fixtures/catalog-2026-10';
import type { ActivityDay, ActivitySummary, ReportPeriod } from '../../schemas/report';
import type { ReportSummary } from '../../schemas/report-response';
import {
  INSIGHT_CODES,
  INSIGHT_LINES_MAX,
  InsightLineSchema,
  PRACTICE_NEXT_CODES,
  PRACTICE_NEXT_RULES,
  WENT_WELL_CODES,
  WENT_WELL_RULES,
  practiceNext,
  wentWell,
  type InsightContext,
  type InsightLine,
} from '../insights';
import { learnerReport, type LearnerReportInput } from '../learner-report';
import { GAP, LEGACY, NOW, STALE4, STEADY } from './fixtures/activity-2026-10';

/**
 * F-REPORT-001 section 3.6 (RP-2b): "What went well" (W0-W10) and "What to practice next" (P0-P5), rule-based and
 * deterministic, as codes and params. Each rule fires and does not fire at its threshold; table order and the cap
 * of 3; P0 first and never past the data horizon; W0 only as the last resort and always present after practice;
 * `day` keeps the W-lines and P1; the getting-started rule; P4 from the app's own next; missing data skips a rule.
 */

type Input = Partial<LearnerReportInput> & Pick<LearnerReportInput, 'summary'>;
const ctxOf = (input: Input): InsightContext => {
  const full: LearnerReportInput = { viewer: 'family', voice: 'third', period: 'week', now: NOW, catalog: CATALOG_2026_10, lastSyncedAt: null, ...input };
  return { summary: full.summary, report: learnerReport(full), catalog: full.catalog };
};
const codes = (lines: readonly InsightLine[]): string[] => lines.map((line) => line.code);
const well = (input: Input): InsightLine[] => wentWell(ctxOf(input));
const next = (input: Input): InsightLine[] => practiceNext(ctxOf(input));

/** 15 October 2026 at 12:00 UTC; the learners below are in UTC, so today is the 15th. */
const NOW_UTC = new Date('2026-10-15T12:00:00.000Z');

type Row = Partial<Omit<ActivityDay, 'd'>>;
/** Practice days before the rows, so a learner is past the getting-started rule unless a test says otherwise. */
const EARLIER = 5;
/**
 * A UTC learner who practiced on `rows` (day key -> counts) and on 5 earlier days since 5 January, saved today
 * unless `asOf` says otherwise. No rows: a learner who never practiced.
 */
function learner(rows: Readonly<Record<string, Row>>, extra: Partial<ReportSummary> = {}, activity: Partial<ActivitySummary> = {}): ReportSummary {
  const days: ActivityDay[] = Object.entries(rows)
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([d, row]) => ({ d, min: 10, q: 0, c: 0, w: 0, j: [], ...row }));
  const months = new Map<string, { m: string; min: number; q: number; c: number; w: number; days: number }>();
  for (const row of days) {
    const m = row.d.slice(0, 7);
    const sum = months.get(m) ?? { m, min: 0, q: 0, c: 0, w: 0, days: 0 };
    sum.min += row.min;
    sum.q += row.q;
    sum.c += row.c;
    sum.w += row.w;
    sum.days += 1;
    months.set(m, sum);
  }
  const total = (key: 'min' | 'q' | 'c' | 'w'): number => days.reduce((n, row) => n + row[key], 0);
  return {
    lastActiveAt: '2026-10-15T09:00:00.000Z',
    jamoRecognized: [],
    needsPractice: [],
    planProgress: {},
    ...extra,
    activity: {
      v: 1,
      tz: 0,
      asOf: '2026-10-15',
      days,
      months: [...months.values()],
      total: days.length
        ? { since: '2026-01-05', min: total('min'), q: total('q'), c: total('c'), w: total('w'), days: days.length + EARLIER }
        : { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 },
      milestones: [],
      ...activity,
    },
  };
}
const at = (input: Input): Input => ({ now: NOW_UTC, ...input });

/** A level check taken on 13 October 2026 (UTC) with `secure` strands as given. */
const check = (secure: readonly string[], takenAt = '2026-10-13T10:00:00.000Z'): ReportSummary['placement'] => ({
  takenAt,
  level: { stage: 'stage1', band: 1 },
  oralStage: 'stage2',
  strands: {
    'hangul-recognition': secure.includes('hangul-recognition') ? 'secure' : 'not-tested',
    'sound-letter': secure.includes('sound-letter') ? 'secure' : 'not-tested',
    'syllable-reading': secure.includes('syllable-reading') ? 'secure' : 'not-tested',
    vocabulary: secure.includes('vocabulary') ? 'secure' : 'not-tested',
    sentences: secure.includes('sentences') ? 'secure' : 'not-tested',
  },
  beyondContent: false,
  overridden: false,
});

describe('the code lists and rule tables', () => {
  it('went-well codes are W1-W10 in table order, then W0', () => {
    expect(WENT_WELL_RULES.map((rule) => rule.id)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W0']);
    expect(WENT_WELL_RULES.map((rule) => rule.code)).toEqual([...WENT_WELL_CODES]);
    expect(WENT_WELL_CODES).toEqual(['stage_done', 'letters_new', 'practice_days', 'minutes_up', 'quests_new', 'cards_new', 'level_secure', 'plan_done', 'streak', 'words_new', 'showed_up']);
  });

  it('practice-next codes are P0-P5 in table order', () => {
    expect(PRACTICE_NEXT_RULES.map((rule) => rule.id)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4', 'P5']);
    expect(PRACTICE_NEXT_RULES.flatMap((rule) => rule.codes)).toEqual([...PRACTICE_NEXT_CODES]);
    expect(PRACTICE_NEXT_CODES).toEqual(['rhythm', 'letters_revisit', 'strand_next', 'plan_open', 'next_in_plan', 'next_on_route', 'free_days_done', 'words_revisit']);
  });

  it('INSIGHT_CODES is both lists, each code once: one i18n key per code (report.insight.<code>)', () => {
    expect(INSIGHT_CODES).toEqual([...WENT_WELL_CODES, ...PRACTICE_NEXT_CODES]);
    expect(new Set(INSIGHT_CODES).size).toBe(INSIGHT_CODES.length);
  });

  it('periods of each rule (section 3.6 tables); a totals-only month keeps W0, W3, W5 and W6', () => {
    const periods = Object.fromEntries(WENT_WELL_RULES.map((rule) => [rule.id, rule.periods]));
    expect(periods).toEqual({
      W1: ['day', 'week', 'month', 'all'],
      W2: ['day', 'week', 'month', 'all'],
      W3: ['day', 'week', 'month', 'all'],
      W4: ['week', 'month'],
      W5: ['day', 'week', 'month', 'all'],
      W6: ['day', 'week', 'month', 'all'],
      W7: ['week', 'month', 'all'],
      W8: ['day', 'week', 'month', 'all'],
      W9: ['day', 'week'],
      W10: ['week', 'month', 'all'],
      W0: ['day', 'week', 'month', 'all'],
    });
    expect(WENT_WELL_RULES.filter((rule) => rule.totalsOnly).map((rule) => rule.id)).toEqual(['W3', 'W5', 'W6', 'W0']);
    expect(Object.fromEntries(PRACTICE_NEXT_RULES.map((rule) => [rule.id, rule.periods]))).toEqual({
      P0: ['week', 'month'],
      P1: ['day', 'week', 'month', 'all'],
      P2: ['week', 'month', 'all'],
      P3: ['week', 'month', 'all'],
      P4: ['week', 'month', 'all'],
      P5: ['week', 'month', 'all'],
    });
    expect(INSIGHT_LINES_MAX).toBe(3);
  });
});

describe('the frozen learners (section 3.15)', () => {
  it('Mina, a steady week: new letters, new quests and new cards, in table order, capped at 3 (behaviour 1)', () => {
    // The headline already reads "Mina practiced on 3 days this week.", so W3 does not say it again.
    expect(ctxOf({ summary: STEADY }).report.headline?.code).toBe('practiced');
    const lines = well({ summary: STEADY });
    expect(lines).toEqual([
      { code: 'letters_new', params: { letters: ['ㄱ', 'ㄴ'] } },
      { code: 'quests_new', params: { count: 2 } },
      { code: 'cards_new', params: { count: 1 } },
    ]);
  });

  it('Mina: no minutes line when this week (36) is below last week (40), and nothing says less (behaviour 2)', () => {
    expect(codes(wentWell({ ...ctxOf({ summary: STEADY }) }))).not.toContain('minutes_up');
  });

  it('Mina, practice next: the letters with the revisit quest, the strand, then the open plan items (behaviour 4)', () => {
    // 2 open items in the family plan and 2 in the self-route: no single plan holds all 4, so no plan link.
    expect(next({ summary: STEADY })).toEqual([
      { code: 'letters_revisit', params: { letters: ['ㅂ', 'ㅅ'], questId: 'quest:stage1-life-q2' }, links: { addToPlan: 'quest:stage1-life-q2' } },
      { code: 'strand_next', params: { strand: 'sound-letter' } },
      { code: 'plan_open', params: { count: 4, kind: 'family' } },
    ]);
  });

  it('Sora, saved 4 days ago: the headline names the stage, so the lines start below it; no rhythm line on a partial window (behaviour 13)', () => {
    expect(ctxOf({ summary: STALE4 }).report.headline?.code).toBe('stage_done');
    expect(well({ summary: STALE4 })).toEqual([
      { code: 'letters_new', params: { letters: ['ㄷ', 'ㄹ'] } },
      { code: 'practice_days', params: { days: 3 } },
      { code: 'quests_new', params: { count: 7 } },
    ]);
    expect(next({ summary: STALE4 })).toEqual([]);
  });

  it('Jun, a gap: no went-well line; the rhythm line reads the saved part of the window (sections 3.2 and 3.11)', () => {
    // Saved up to the 14th, today the 15th: no practice from the 9th to the 14th, so "No practice yet this week." and P0.
    expect(well({ summary: GAP })).toEqual([]);
    expect(next({ summary: GAP })).toEqual([
      { code: 'rhythm', params: {} },
      { code: 'letters_revisit', params: { letters: ['ㅂ'], questId: null } },
    ]);
  });

  it('Jun, last week (a whole saved window with no practice): the rhythm line comes first', () => {
    expect(codes(next({ summary: GAP, at: '2026-10-14' }))).toEqual(['rhythm', 'letters_revisit']);
    expect(next({ summary: GAP, at: '2026-10-14' })[0]).toEqual({ code: 'rhythm', params: {} });
  });

  it('Ari on an older build, read by the class: no day-by-day line; letters, strand and homework from today\'s summary (behaviour 7)', () => {
    expect(well({ summary: LEGACY, viewer: 'class' })).toEqual([]);
    expect(next({ summary: LEGACY, viewer: 'class' })).toEqual([
      { code: 'letters_revisit', params: { letters: ['ㄹ'], questId: null } },
      { code: 'strand_next', params: { strand: 'sound-letter' } },
      { code: 'plan_open', params: { count: 3, kind: 'class' }, links: { openPlan: 'plan:class-week' } },
    ]);
  });
});

describe('states', () => {
  it('no_data: no line at all', () => {
    expect(well({ summary: null })).toEqual([]);
    expect(next({ summary: null })).toEqual([]);
  });

  it('empty: no went-well line; practice next holds only the app\'s next (section 3.14)', () => {
    const fresh = learner({}, { needsPractice: ['ㅂ'], placement: check([]) }, { next: { q: 'quest:stage1-letters-q1', plan: false } });
    expect(ctxOf(at({ summary: fresh })).report.state).toBe('empty');
    expect(well(at({ summary: fresh }))).toEqual([]);
    expect(next(at({ summary: fresh }))).toEqual([{ code: 'next_on_route', params: { questId: 'quest:stage1-letters-q1' } }]);
    // `day` keeps only P1 (no daily nudging), and the empty page holds only P4: nothing on `day`.
    expect(next(at({ summary: fresh, period: 'day' }))).toEqual([]);
    expect(codes(next(at({ summary: fresh, period: 'month' })))).toEqual(['next_on_route']);
    expect(codes(next(at({ summary: fresh, period: 'all' })))).toEqual(['next_on_route']);
  });

  it('empty without activity: nothing', () => {
    expect(next({ summary: {} })).toEqual([]);
  });

  it('legacy: no went-well line, not even a finished plan (no window, so no practice in it; layer 3 shows the plan)', () => {
    const done = { ...LEGACY, planProgress: { 'plan:class-week': { done: 4, total: 4, notReady: 0 } } };
    expect(well({ summary: done, viewer: 'class' })).toEqual([]);
  });
});

describe('went well, rule by rule', () => {
  it('W1 stage_done: a milestone in the window (the newest when there are two), read under a headline that does not name it', () => {
    const s = learner({ '2026-10-14': {}, '2026-10-15': {} }, {}, { milestones: [{ stage: 'stage1', on: '2026-10-14' }, { stage: 'stage2', on: '2026-10-15' }] });
    const ctx = ctxOf(at({ summary: s }));
    const headline = ctx.report.headline;
    expect(headline?.code).toBe('stage_done');
    // A context whose headline does not name the stage (the rule reads the context it is given): W1 is the first line.
    const plain = { ...ctx, report: { ...ctx.report, headline: headline ? { ...headline, code: 'practiced' as const, stage: null } : null } };
    expect(wentWell(plain)[0]).toEqual({ code: 'stage_done', params: { stage: { stage: 'stage2', n: 2 } } });
    // No milestone in the window: no stage line under any headline.
    const old = learner({ '2026-10-01': {}, '2026-10-15': {} }, {}, { milestones: [{ stage: 'stage1', on: '2026-10-01' }] });
    expect(ctxOf(at({ summary: old })).report.headline?.code).toBe('practiced');
    expect(codes(well(at({ summary: old })))).not.toContain('stage_done');
  });

  it('W1 never repeats a `stage_done` headline (RP-2b2): the next rule moves up, as W3 does under `practiced`', () => {
    const s = learner({ '2026-10-14': {}, '2026-10-15': {} }, {}, { milestones: [{ stage: 'stage1', on: '2026-10-14' }, { stage: 'stage2', on: '2026-10-15' }] });
    const old = learner({ '2026-10-01': {}, '2026-10-15': {} }, {}, { milestones: [{ stage: 'stage1', on: '2026-10-01' }] });
    for (const [summary, period] of [[s, 'day'], [s, 'week'], [s, 'month'], [s, 'all'], [old, 'all']] as const) {
      const ctx = ctxOf(at({ summary, period }));
      expect(ctx.report.headline?.code, period).toBe('stage_done');
      expect(codes(wentWell(ctx)), period).not.toContain('stage_done');
    }
    // W3 names the practice days under a `stage_done` headline; W0 stays the last resort when nothing else fires.
    expect(well(at({ summary: s }))).toEqual([{ code: 'practice_days', params: { days: 2 } }]);
    expect(well(at({ summary: s, period: 'month' }))).toEqual([{ code: 'showed_up', params: { days: 2, period: 'month' } }]);
    expect(codes(well(at({ summary: learner({ '2026-10-15': { q: 1 } }, {}, { milestones: [{ stage: 'stage1', on: '2026-10-15' }] }), period: 'day' })))).toEqual(['practice_days', 'quests_new']);
  });

  it('W1 is unreachable from a learner report: the frozen learners, every period and viewer, never show a stage_done line', () => {
    const periods: readonly ReportPeriod[] = ['day', 'week', 'month', 'all'];
    for (const [name, summary] of [['steady', STEADY], ['gap', GAP], ['legacy', LEGACY], ['stale4', STALE4]] as const)
      for (const period of periods)
        for (const viewer of ['family', 'class', 'device'] as const) {
          const ctx = ctxOf({ summary, period, viewer });
          expect(codes(wentWell(ctx)), `${name} ${period} ${viewer}`).not.toContain('stage_done');
        }
  });

  it('W2 letters_new: at least one letter, up to 5 in the order learned', () => {
    const s = learner({ '2026-10-13': { j: ['ㄱ', 'ㄴ', 'ㄷ'] }, '2026-10-14': { j: ['ㄹ', 'ㅁ', 'ㅂ'] } });
    expect(well(at({ summary: s }))[0]).toEqual({ code: 'letters_new', params: { letters: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ'] } });
    expect(codes(well(at({ summary: learner({ '2026-10-14': {} }) })))).not.toContain('letters_new');
    // `all`: every day row the report holds.
    const older = learner({ '2026-09-20': { j: ['ㅏ'] }, '2026-10-14': {} });
    expect(well(at({ summary: older, period: 'all' }))).toContainEqual({ code: 'letters_new', params: { letters: ['ㅏ'] } });
  });

  it('W3 practice_days: >= 1 day, >= 2 week, >= 4 month, >= 5 all (under a headline that does not state the days)', () => {
    // A milestone on the 15th: the headline is `stage_done`, so W3 is the line that names the practice days.
    const stage = { milestones: [{ stage: 'stage1' as const, on: '2026-10-15' }] };
    const days = (n: number, period: ReportPeriod): boolean => {
      const rows = Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-10-${String(15 - i).padStart(2, '0')}`, {}]));
      return codes(well(at({ summary: learner(rows, {}, { ...stage, total: { since: '2026-01-01', min: 0, q: 0, c: 0, w: 0, days: 50 } }), period }))).includes('practice_days');
    };
    expect([days(1, 'day'), days(1, 'week'), days(2, 'week'), days(3, 'month'), days(4, 'month')]).toEqual([true, false, true, false, true]);
    // `all` counts every practice day ever (`total.days`).
    const all = (total: number): string[] => codes(well(at({ summary: learner({ '2026-10-15': {} }, {}, { ...stage, total: { since: '2026-01-01', min: 0, q: 0, c: 0, w: 0, days: total } }), period: 'all' })));
    expect([all(4).includes('practice_days'), all(5).includes('practice_days')]).toEqual([false, true]);
    expect(well(at({ summary: learner({ '2026-10-15': {} }, {}, { ...stage, total: { since: '2026-01-01', min: 0, q: 0, c: 0, w: 0, days: 5 } }), period: 'all' }))).toEqual([
      { code: 'practice_days', params: { days: 5 } },
    ]);
  });

  it('W3 never repeats a `practiced` headline (design pass #429): the next rule moves up, W0 stays the last resort', () => {
    const rows = { '2026-10-13': {}, '2026-10-14': {}, '2026-10-15': {} };
    for (const period of ['day', 'week', 'month', 'all'] as const) {
      const ctx = ctxOf(at({ summary: learner(rows), period }));
      expect(ctx.report.headline?.code, period).toBe('practiced');
      expect(codes(wentWell(ctx)), period).not.toContain('practice_days');
    }
    expect(well(at({ summary: learner({ '2026-10-12': {}, '2026-10-14': {} }) }))).toEqual([{ code: 'showed_up', params: { days: 2, period: 'week' } }]);
    expect(codes(well(at({ summary: learner({ '2026-10-12': {}, '2026-10-14': { q: 1 } }) })))).toEqual(['quests_new']);
  });

  it('W4 minutes_up: more minutes than the previous window, which had some (week and month), named by period', () => {
    const week = (prev: number, now: number): InsightLine[] => well(at({ summary: learner({ '2026-10-05': { min: prev }, '2026-10-14': { min: now } }) }));
    expect(week(10, 11)).toContainEqual({ code: 'minutes_up', params: { minutes: 11, period: 'week' } });
    expect(codes(week(10, 10))).not.toContain('minutes_up');
    expect(codes(week(0, 11))).not.toContain('minutes_up');
    const month = learner({ '2026-09-10': { min: 10 }, '2026-10-14': { min: 30 } });
    expect(well(at({ summary: month, period: 'month' }))).toContainEqual({ code: 'minutes_up', params: { minutes: 30, period: 'month' } });
    expect(codes(well(at({ summary: month, period: 'all' })))).not.toContain('minutes_up');
  });

  it('W5 quests_new and W6 cards_new: at least one', () => {
    expect(well(at({ summary: learner({ '2026-10-14': { q: 1, c: 2 } }) }))).toEqual([
      { code: 'quests_new', params: { count: 1 } },
      { code: 'cards_new', params: { count: 2 } },
    ]);
  });

  it('W7 level_secure: the newest check was taken in the window and has a secure strand; up to 2, fixed order', () => {
    const secure = check(['sentences', 'hangul-recognition', 'sound-letter']);
    expect(well(at({ summary: learner({ '2026-10-14': {} }, { placement: secure }) }))).toContainEqual({
      code: 'level_secure',
      params: { strands: ['hangul-recognition', 'sound-letter'] },
    });
    // Taken before the window, none secure, or on the day period.
    expect(codes(well(at({ summary: learner({ '2026-10-14': {} }, { placement: check(['vocabulary'], '2026-10-01T10:00:00.000Z') }) })))).not.toContain('level_secure');
    expect(codes(well(at({ summary: learner({ '2026-10-14': {} }, { placement: check([]) }) })))).not.toContain('level_secure');
    expect(codes(well(at({ summary: learner({ '2026-10-13': {} }, { placement: secure }), period: 'day', now: new Date('2026-10-13T12:00:00.000Z') })))).not.toContain('level_secure');
    // An unreadable time is never in a window.
    expect(codes(well(at({ summary: learner({ '2026-10-14': {} }, { placement: check(['vocabulary'], 'soon') }) })))).not.toContain('level_secure');
    // `all`: any time.
    expect(codes(well(at({ summary: learner({ '2026-10-14': {} }, { placement: check(['vocabulary'], '2025-01-01T00:00:00.000Z') }), period: 'all' })))).toContain('level_secure');
  });

  it('W7 reads the learner-local day of the check (a check late on the 8th in Los Angeles is the 8th, not in the week)', () => {
    const la = learner({ '2026-10-14': {} }, { placement: check(['vocabulary'], '2026-10-09T03:00:00.000Z') }, { tz: -420 });
    expect(codes(well(at({ summary: la })))).not.toContain('level_secure');
    const seoul = learner({ '2026-10-14': {} }, { placement: check(['vocabulary'], '2026-10-08T16:00:00.000Z') }, { tz: 540 });
    expect(codes(well(at({ summary: seoul })))).toContain('level_secure');
  });

  it('W8 plan_done: a plan of this viewer with done == total > 0; the class says homework, a family says plan', () => {
    const plans = { 'plan:a': { done: 2, total: 5, notReady: 0 }, 'plan:b': { done: 3, total: 3, notReady: 0 } };
    expect(well(at({ summary: learner({ '2026-10-14': {} }, { planProgress: plans }), viewer: 'class' }))).toContainEqual({ code: 'plan_done', params: { done: 3, kind: 'class' } });
    expect(well(at({ summary: learner({ '2026-10-14': {} }, { planProgress: plans }) }))).toContainEqual({ code: 'plan_done', params: { done: 3, kind: 'family' } });
    expect(codes(well(at({ summary: learner({ '2026-10-14': {} }, { planProgress: { 'plan:z': { done: 0, total: 0, notReady: 0 } } }) })))).not.toContain('plan_done');
    // Two plans done: the first by id, whatever order the record holds them in.
    const both = { 'plan:z': { done: 5, total: 5, notReady: 0 }, 'plan:m': { done: 1, total: 2, notReady: 0 }, 'plan:c': { done: 2, total: 2, notReady: 0 } };
    expect(well(at({ summary: learner({ '2026-10-14': {} }, { planProgress: both }) }))).toContainEqual({ code: 'plan_done', params: { done: 2, kind: 'family' } });
  });

  it('W8: the self-route counts for a family and the device (OD-9), never for a class', () => {
    const self = { done: 4, total: 4, notReady: 0, weeks: 2, endsOn: '2026-10-30' };
    const s = learner({ '2026-10-14': {} }, { selfRoute: self });
    expect(well(at({ summary: s }))).toContainEqual({ code: 'plan_done', params: { done: 4, kind: 'family' } });
    expect(well(at({ summary: s, viewer: 'device' }))).toContainEqual({ code: 'plan_done', params: { done: 4, kind: 'family' } });
    expect(codes(well(at({ summary: s, viewer: 'class' })))).not.toContain('plan_done');
    expect(codes(well(at({ summary: learner({ '2026-10-14': {} }, { selfRoute: { ...self, done: 3 } }) })))).not.toContain('plan_done');
  });

  it('W9 streak: a local run of 3 or more days ending at the last saved day (day and week)', () => {
    const run = (n: number, period: ReportPeriod = 'week'): InsightLine[] => {
      const rows = Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-10-${String(15 - i).padStart(2, '0')}`, { min: 0 }]));
      return well(at({ summary: learner(rows, {}, { total: { since: '2026-01-01', min: 0, q: 0, c: 0, w: 0, days: 40 } }), period }));
    };
    expect(run(3)).toContainEqual({ code: 'streak', params: { days: 3 } });
    expect(codes(run(2))).not.toContain('streak');
    expect(run(3, 'day')).toContainEqual({ code: 'streak', params: { days: 3 } });
    expect(codes(run(5, 'month'))).not.toContain('streak');
  });

  it('W9: never on a past window that ends before the last saved day', () => {
    const rows = { '2026-10-06': {}, '2026-10-07': {}, '2026-10-08': {}, '2026-10-13': {}, '2026-10-14': {}, '2026-10-15': {} };
    expect(well(at({ summary: learner(rows) }))).toContainEqual({ code: 'streak', params: { days: 3 } });
    expect(codes(well(at({ summary: learner(rows), at: '2026-10-08' })))).not.toContain('streak');
  });

  it('W10 words_new is hidden while words are hidden (section 3.10)', () => {
    expect(codes(well(at({ summary: learner({ '2026-10-14': { w: 9 } }) })))).not.toContain('words_new');
  });

  it('W0 showed_up: the last resort after practice, with the days and the period (behaviour 11)', () => {
    expect(well(at({ summary: learner({ '2026-10-14': {} }) }))).toEqual([{ code: 'showed_up', params: { days: 1, period: 'week' } }]);
    expect(codes(well(at({ summary: learner({ '2026-10-14': { q: 1 } }) })))).toEqual(['quests_new']);
  });

  it('a totals-only month keeps only W0, W3, W5 and W6', () => {
    // August 2026 is older than the 35 day rows: figures from its month row.
    const s = learner(
      { '2026-10-14': {} },
      { planProgress: { 'plan:a': { done: 1, total: 1, notReady: 0 } }, placement: check(['vocabulary'], '2026-08-05T00:00:00.000Z') },
      {
        months: [
          { m: '2026-07', min: 10, q: 0, c: 0, w: 0, days: 1 },
          { m: '2026-08', min: 50, q: 2, c: 1, w: 0, days: 4 },
          { m: '2026-10', min: 10, q: 0, c: 0, w: 0, days: 1 },
        ],
        milestones: [{ stage: 'stage1', on: '2026-08-05' }],
      },
    );
    const r = ctxOf(at({ summary: s, period: 'month', at: '2026-08-01' }));
    expect(r.report.window?.totalsOnly).toBe(true);
    expect(wentWell(r)).toEqual([
      { code: 'practice_days', params: { days: 4 } },
      { code: 'quests_new', params: { count: 2 } },
      { code: 'cards_new', params: { count: 1 } },
    ]);
    const quiet = learner({ '2026-10-14': {} }, {}, { months: [{ m: '2026-08', min: 5, q: 0, c: 0, w: 0, days: 1 }, { m: '2026-10', min: 10, q: 0, c: 0, w: 0, days: 1 }] });
    expect(wentWell(ctxOf(at({ summary: quiet, period: 'month', at: '2026-08-01' })))).toEqual([{ code: 'showed_up', params: { days: 1, period: 'month' } }]);
  });

  it('never empty after practice; no line without practice in the window (section 3.6)', () => {
    for (const period of ['day', 'week', 'month', 'all'] as const) {
      expect(well(at({ summary: learner({ '2026-10-15': {} }), period })).length, period).toBeGreaterThan(0);
    }
    expect(well(at({ summary: learner({ '2026-09-01': { q: 3 } }) }))).toEqual([]);
    // Not even a finished plan or self-route: "What went well" is hidden.
    const done = { planProgress: { 'plan:a': { done: 4, total: 4, notReady: 0 } }, selfRoute: { done: 2, total: 2, notReady: 0, weeks: 1, endsOn: '2026-10-30' } };
    for (const period of ['day', 'week', 'month'] as const) {
      expect(well(at({ summary: learner({ '2026-09-20': {} }, done), period })), period).toEqual([]);
    }
  });

  it('no went-well line on a day with no practice yet, even after a run of 3 days (the morning check-in, section 3.6)', () => {
    const s = learner({ '2026-10-12': {}, '2026-10-13': {}, '2026-10-14': {} }, { needsPractice: ['ㅂ'] });
    const ctx = ctxOf(at({ summary: s, period: 'day' }));
    expect(ctx.report.headline?.code).toBe('none_yet');
    expect(wentWell(ctx)).toEqual([]);
    expect(practiceNext(ctx)).toEqual([{ code: 'letters_revisit', params: { letters: ['ㅂ'], questId: null } }]);
    // The same run with practice today: 4 days in a row.
    expect(well(at({ summary: learner({ '2026-10-12': {}, '2026-10-13': {}, '2026-10-14': {}, '2026-10-15': {} }), period: 'day' }))).toContainEqual({ code: 'streak', params: { days: 4 } });
  });

  it('no went-well line in a week with no practice day, whatever else it holds (a level check, a milestone); P0 still first', () => {
    // A check taken on the 13th (an older build records no session for it) and a milestone merged in from another
    // device on the 14th; the last practice days were the 1st and 2nd.
    const s = learner({ '2026-10-01': {}, '2026-10-02': {} }, { placement: check(['vocabulary']), needsPractice: ['ㅂ'] }, { milestones: [{ stage: 'stage1', on: '2026-10-14' }] });
    const ctx = ctxOf(at({ summary: s }));
    expect(ctx.report.figures?.days.count).toBe(0);
    expect(wentWell(ctx)).toEqual([]);
    expect(codes(practiceNext(ctx))[0]).toBe('rhythm');
    expect(wentWell(ctxOf(at({ summary: learner({ '2026-10-01': {} }, { placement: check(['vocabulary']) }) })))).toEqual([]);
  });

  it('W8: today\'s plan counts speak only for the current window, never for a past one', () => {
    const done = { planProgress: { 'plan:a': { done: 4, total: 4, notReady: 0 } } };
    const s = learner({ '2026-10-06': {}, '2026-10-07': {}, '2026-10-15': {} }, done);
    expect(codes(well(at({ summary: s })))).toContain('plan_done');
    expect(codes(well(at({ summary: s, period: 'all' })))).toContain('plan_done');
    const lastWeek = ctxOf(at({ summary: s, at: '2026-10-08' }));
    expect(lastWeek.report.figures?.days.count).toBe(2);
    expect(codes(wentWell(lastWeek))).not.toContain('plan_done');
    expect(codes(well(at({ summary: s, period: 'day', at: '2026-10-07' })))).not.toContain('plan_done');
  });

  it('never more than 3 lines, in table order', () => {
    const s = learner(
      { '2026-10-13': { j: ['ㄱ'] }, '2026-10-14': { q: 2, c: 1 }, '2026-10-15': {} },
      { placement: check(['vocabulary']) },
      { milestones: [{ stage: 'stage1', on: '2026-10-14' }] },
    );
    // The headline names the stage, so W1 is skipped and W5 moves up into the third place.
    expect(codes(well(at({ summary: s })))).toEqual(['letters_new', 'practice_days', 'quests_new']);
  });
});

describe('practice next, rule by rule', () => {
  it('P0 rhythm: no practice in a whole saved week or month; first when it fires; never on day or all', () => {
    const s = learner({ '2026-09-01': {}, '2026-09-02': {} }, { needsPractice: ['ㅂ'] });
    expect(codes(next(at({ summary: s })))).toEqual(['rhythm', 'letters_revisit']);
    expect(codes(next(at({ summary: s, period: 'month' })))[0]).toBe('rhythm');
    expect(codes(next(at({ summary: s, period: 'day' })))).toEqual(['letters_revisit']);
    expect(codes(next(at({ summary: s, period: 'all' })))).toEqual(['letters_revisit']);
    expect(codes(next(at({ summary: learner({ '2026-10-15': {}, '2026-09-01': {} }) })))).not.toContain('rhythm');
  });

  it('P0: reads the saved part of a window that reaches past the last saved day; never a window wholly after it', () => {
    const s = learner({ '2026-09-01': {}, '2026-09-02': {} }, {}, { asOf: '2026-10-13' });
    expect(ctxOf(at({ summary: s })).report.horizon?.partial).toBe(true);
    expect(codes(next(at({ summary: s })))).toEqual(['rhythm']);
    // Practice in the saved part: no rhythm line (behaviour 13).
    expect(codes(next(at({ summary: learner({ '2026-10-12': {}, '2026-10-13': {} }, {}, { asOf: '2026-10-13' }) })))).not.toContain('rhythm');
    const after = learner({ '2026-09-01': {}, '2026-09-02': {} }, {}, { asOf: '2026-10-01' });
    expect(ctxOf(at({ summary: after })).report.headline?.code).toBe('none_saved');
    expect(next(at({ summary: after }))).toEqual([]);
  });

  it('P1 letters_revisit: up to 3 letters; the revisit quest only from activity.revisit; taught letters only', () => {
    const s = learner({ '2026-10-15': {} }, { needsPractice: ['ㅂ', 'ㅅ', 'ㅈ'] }, { revisit: 'quest:stage1-letters-q2' });
    expect(next(at({ summary: s }))[0]).toEqual({
      code: 'letters_revisit',
      params: { letters: ['ㅂ', 'ㅅ', 'ㅈ'], questId: 'quest:stage1-letters-q2' },
      links: { addToPlan: 'quest:stage1-letters-q2' },
    });
    expect(next(at({ summary: learner({ '2026-10-15': {} }, { needsPractice: ['ㅂ'] }) }))[0]).toEqual({ code: 'letters_revisit', params: { letters: ['ㅂ'], questId: null } });
    expect(codes(next(at({ summary: learner({ '2026-10-15': {} }, { needsPractice: ['sym:x', 'Mina'] }) })))).not.toContain('letters_revisit');
  });

  it('P2 strand_next: getting-there first, else not-yet, in the fixed strand order; nothing without a check', () => {
    const strands = (map: Record<string, string>): ReportSummary['placement'] => ({ ...(check([]) as NonNullable<ReportSummary['placement']>), strands: { ...(check([]) as NonNullable<ReportSummary['placement']>).strands, ...map } as NonNullable<ReportSummary['placement']>['strands'] });
    const line = (map: Record<string, string>): InsightLine | undefined => next(at({ summary: learner({ '2026-10-15': {} }, { placement: strands(map) }) }))[0];
    expect(line({ 'hangul-recognition': 'not-yet', sentences: 'getting-there' })).toEqual({ code: 'strand_next', params: { strand: 'sentences' } });
    expect(line({ vocabulary: 'not-yet', 'syllable-reading': 'not-yet' })).toEqual({ code: 'strand_next', params: { strand: 'syllable-reading' } });
    expect(line({ vocabulary: 'secure' })).toBeUndefined();
    expect(next(at({ summary: learner({ '2026-10-15': {} }) }))).toEqual([]);
  });

  it('P3 plan_open: open items of this viewer\'s plans; the plan link only when one plan has them', () => {
    const one = { 'plan:a': { done: 1, total: 3, notReady: 0 }, 'plan:b': { done: 2, total: 2, notReady: 0 } };
    expect(next(at({ summary: learner({ '2026-10-15': {} }, { planProgress: one }), viewer: 'class' }))).toEqual([
      { code: 'plan_open', params: { count: 2, kind: 'class' }, links: { openPlan: 'plan:a' } },
    ]);
    const two = { 'plan:a': { done: 1, total: 3, notReady: 0 }, 'plan:b': { done: 0, total: 2, notReady: 0 } };
    expect(next(at({ summary: learner({ '2026-10-15': {} }, { planProgress: two }), viewer: 'class' }))).toEqual([{ code: 'plan_open', params: { count: 4, kind: 'class' } }]);
  });

  it('P3: the self-route counts for a family (no plan link), never for a class', () => {
    const self = { done: 1, total: 4, notReady: 0, weeks: 2, endsOn: '2026-10-30' };
    expect(next(at({ summary: learner({ '2026-10-15': {} }, { selfRoute: self }) }))).toEqual([{ code: 'plan_open', params: { count: 3, kind: 'family' } }]);
    expect(next(at({ summary: learner({ '2026-10-15': {} }, { selfRoute: self }), viewer: 'class' }))).toEqual([]);
  });

  it('P3: one open plan and an open self-route: the count holds both and there is no plan link', () => {
    const self = { done: 0, total: 5, notReady: 0, weeks: 2, endsOn: '2026-10-30' };
    const plans = { 'plan:a': { done: 1, total: 3, notReady: 0 } };
    const s = learner({ '2026-10-15': {} }, { planProgress: plans, selfRoute: self });
    expect(next(at({ summary: s }))).toEqual([{ code: 'plan_open', params: { count: 7, kind: 'family' } }]);
    expect(next(at({ summary: s, viewer: 'device' }))).toEqual([{ code: 'plan_open', params: { count: 7, kind: 'family' } }]);
    // A finished self-route holds nothing open: the one plan holds every item, so the link stays.
    const finished = learner({ '2026-10-15': {} }, { planProgress: plans, selfRoute: { ...self, done: 5 } });
    expect(next(at({ summary: finished }))).toEqual([{ code: 'plan_open', params: { count: 2, kind: 'family' }, links: { openPlan: 'plan:a' } }]);
    // A class never reads the self-route: its one plan keeps the link.
    expect(next(at({ summary: s, viewer: 'class' }))).toEqual([{ code: 'plan_open', params: { count: 2, kind: 'class' }, links: { openPlan: 'plan:a' } }]);
  });

  it('the in-app report (device viewer) carries no action link: Add to a plan and Open the plan are console actions', () => {
    const s = learner({ '2026-10-15': {} }, { needsPractice: ['ㅂ'], planProgress: { 'plan:a': { done: 1, total: 3, notReady: 0 } } }, { revisit: 'quest:stage1-letters-q2' });
    expect(next(at({ summary: s, viewer: 'device' }))).toEqual([
      { code: 'letters_revisit', params: { letters: ['ㅂ'], questId: 'quest:stage1-letters-q2' } },
      { code: 'plan_open', params: { count: 2, kind: 'family' } },
    ]);
    // The same summary read by a family console viewer keeps both links.
    expect(next(at({ summary: s })).map((line) => ('links' in line ? line.links : undefined))).toEqual([{ addToPlan: 'quest:stage1-letters-q2' }, { openPlan: 'plan:a' }]);
  });

  it('P4: the app\'s own next, three codes (section 3.6, behaviour 14)', () => {
    const withNext = (n: ActivitySummary['next']): ReportSummary => learner({ '2026-10-14': {}, '2026-10-15': {} }, {}, { next: n });
    expect(next(at({ summary: withNext({ q: 'quest:stage1-letters-q1', plan: true }) }))).toEqual([{ code: 'next_in_plan', params: { questId: 'quest:stage1-letters-q1' } }]);
    expect(next(at({ summary: withNext({ q: 'quest:stage1-letters-q1', plan: false }) }))).toEqual([{ code: 'next_on_route', params: { questId: 'quest:stage1-letters-q1' } }]);
    expect(next(at({ summary: withNext({ end: true }) }))).toEqual([{ code: 'free_days_done', params: {} }]);
    expect(next(at({ summary: withNext({ end: true }), viewer: 'device' }))).toEqual([{ code: 'free_days_done', params: {} }]);
    expect(next(at({ summary: withNext(undefined) }))).toEqual([]);
  });

  it('P4 and P1: an id that is not a catalogue quest id is never named or linked', () => {
    const odd = learner({ '2026-10-14': {}, '2026-10-15': {} }, { needsPractice: ['ㅂ'] }, { next: { q: 'Mina', plan: false }, revisit: 'Mina' });
    expect(next(at({ summary: odd }))).toEqual([{ code: 'letters_revisit', params: { letters: ['ㅂ'], questId: null } }]);
    // A well-formed id this build's catalogue does not hold (a retired quest, or one from a newer build): no title to show.
    const unknown = learner({ '2026-10-14': {}, '2026-10-15': {} }, { needsPractice: ['ㅂ'] }, { next: { q: 'quest:stage1-letters-q99', plan: true }, revisit: 'quest:stage9-new-q1' });
    expect(next(at({ summary: unknown }))).toEqual([{ code: 'letters_revisit', params: { letters: ['ㅂ'], questId: null } }]);
    expect(next(at({ summary: unknown, period: 'day' }))).toEqual([{ code: 'letters_revisit', params: { letters: ['ㅂ'], questId: null } }]);
  });

  it('a legacy summary without plan counts or a level check: only what it holds', () => {
    expect(well({ summary: { lastActiveAt: '2026-10-10T08:00:00.000Z' } })).toEqual([]);
    expect(next({ summary: { lastActiveAt: '2026-10-10T08:00:00.000Z', needsPractice: ['ㄹ'] } })).toEqual([{ code: 'letters_revisit', params: { letters: ['ㄹ'], questId: null } }]);
  });

  it('P4: a class always reads the route\'s next and never the free-lessons line', () => {
    const withNext = (n: ActivitySummary['next']): ReportSummary => learner({ '2026-10-14': {}, '2026-10-15': {} }, {}, { next: n });
    expect(next(at({ summary: withNext({ q: 'quest:stage1-letters-q1', plan: true }), viewer: 'class' }))).toEqual([{ code: 'next_on_route', params: { questId: 'quest:stage1-letters-q1' } }]);
    expect(next(at({ summary: withNext({ end: true }), viewer: 'class' }))).toEqual([]);
  });

  it('P5 words_revisit stays hidden while words are hidden', () => {
    const s = { ...learner({ '2026-10-15': {} }), vocab: { collected: 9, strong: 1, topicsStarted: 1, topicsPracticed7d: 1, firstTryRate: 0.5, needsPractice: ['vocab:bap'] } };
    expect(practiceNext(ctxOf(at({ summary: s })))).toEqual([]);
  });

  it('day keeps only P1 (no daily nudging)', () => {
    const s = learner({ '2026-10-14': {}, '2026-10-15': {} }, { needsPractice: ['ㅂ'], placement: check([]), planProgress: { 'plan:a': { done: 0, total: 2, notReady: 0 } } }, { next: { q: 'quest:stage1-letters-q1', plan: false } });
    expect(codes(next(at({ summary: s, period: 'day' })))).toEqual(['letters_revisit']);
    expect(codes(next(at({ summary: s })))).toEqual(['letters_revisit', 'plan_open', 'next_on_route']);
  });

  it('getting started (fewer than 2 practice days ever): only the app\'s next', () => {
    const s = learner(
      { '2026-10-15': {} },
      { needsPractice: ['ㅂ'], planProgress: { 'plan:a': { done: 0, total: 2, notReady: 0 } } },
      { next: { q: 'quest:stage1-letters-q1', plan: true }, total: { since: '2026-10-15', min: 10, q: 0, c: 0, w: 0, days: 1 } },
    );
    expect(ctxOf(at({ summary: s })).report.headline?.code).toBe('getting_started');
    expect(next(at({ summary: s }))).toEqual([{ code: 'next_in_plan', params: { questId: 'quest:stage1-letters-q1' } }]);
    expect(next(at({ summary: { ...s, activity: { ...(s.activity as ActivitySummary), next: undefined } } }))).toEqual([]);
    // `day` keeps only P1 and getting started holds only P4: nothing on `day` (no daily nudging).
    expect(next(at({ summary: s, period: 'day' }))).toEqual([]);
    expect(codes(next(at({ summary: s, period: 'month' })))).toEqual(['next_in_plan']);
    // Went well is not affected.
    expect(well(at({ summary: s }))).toEqual([{ code: 'showed_up', params: { days: 1, period: 'week' } }]);
  });

  it('never more than 3 lines; rhythm first', () => {
    const s = learner(
      { '2026-09-01': {}, '2026-09-02': {} },
      { needsPractice: ['ㅂ'], placement: check([]), planProgress: { 'plan:a': { done: 0, total: 2, notReady: 0 } } },
      { next: { q: 'quest:stage1-letters-q1', plan: false } },
    );
    const strands = { ...(s.placement as NonNullable<ReportSummary['placement']>), strands: { ...(s.placement as NonNullable<ReportSummary['placement']>).strands, vocabulary: 'not-yet' as const } };
    expect(codes(next(at({ summary: { ...s, placement: strands } })))).toEqual(['rhythm', 'letters_revisit', 'strand_next']);
  });
});

describe('every line carries codes and numbers only (section 3.6)', () => {
  it('each line parses with InsightLineSchema; params hold no name or free text', () => {
    const lines = [
      ...well({ summary: STEADY }),
      ...next({ summary: STEADY }),
      ...well({ summary: STALE4 }),
      ...next({ summary: LEGACY, viewer: 'class' }),
      ...next({ summary: GAP, at: '2026-10-14' }),
      ...well(at({ summary: learner({ '2026-10-14': {} }) })),
      ...well(at({ summary: learner({ '2026-10-05': { min: 10 }, '2026-10-14': { min: 11 } }) })),
      ...well(at({ summary: learner({ '2026-10-14': {} }, { placement: check(['vocabulary']), planProgress: { 'plan:a': { done: 1, total: 1, notReady: 0 } } }) })),
      ...well(at({ summary: learner({ '2026-10-13': { min: 0 }, '2026-10-14': { min: 0 }, '2026-10-15': { min: 0 } }, {}, { total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 40 } }) })),
      ...next(at({ summary: learner({ '2026-10-14': {}, '2026-10-15': {} }, {}, { next: { end: true } }) })),
      ...next(at({ summary: learner({ '2026-10-14': {}, '2026-10-15': {} }, {}, { next: { q: 'quest:stage1-letters-q1', plan: true } }) })),
    ];
    expect(new Set(lines.map((line) => line.code)).size).toBeGreaterThanOrEqual(15);
    for (const line of lines) expect(InsightLineSchema.parse(line)).toEqual(line);
  });

  it('a name, a sentence or an unknown code fails the schema', () => {
    expect(InsightLineSchema.safeParse({ code: 'letters_new', params: { letters: ['Mina'] } }).success).toBe(false);
    expect(InsightLineSchema.safeParse({ code: 'showed_up', params: { days: 1, period: 'week', name: 'Mina' } }).success).toBe(false);
    expect(InsightLineSchema.safeParse({ code: 'rhythm', params: { text: 'Try harder' } }).success).toBe(false);
    expect(InsightLineSchema.safeParse({ code: 'top_learner', params: {} }).success).toBe(false);
  });

  it('nothing names a decline or another learner: no code or key says down, less, rank, average, top or best', () => {
    const banned = new Set(['down', 'less', 'fewer', 'drop', 'rank', 'average', 'avg', 'percent', 'top', 'best', 'worst', 'lowest', 'most', 'least', 'others', 'peers']);
    /** Words of a code or key: `minutes_up` -> minutes, up; `addToPlan` -> add, to, plan. */
    const words = (key: string): string[] => key.split(/_|(?=[A-Z])/).map((w) => w.toLowerCase());
    const keysOf = (value: unknown): string[] =>
      value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [...(/^\d+$/.test(k) ? [] : [k]), ...keysOf(v)]) : [];
    const all = [...INSIGHT_CODES, ...keysOf([...well({ summary: STEADY }), ...next({ summary: STEADY }), ...well({ summary: STALE4 })])];
    for (const key of all) for (const word of words(key)) expect(banned.has(word), key).toBe(false);
  });
});
