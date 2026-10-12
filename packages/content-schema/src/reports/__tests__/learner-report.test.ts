import { describe, expect, expectTypeOf, it } from 'vitest';
import { CATALOG_2026_10 } from '../../__tests__/fixtures/catalog-2026-10';
import type { ActivitySummary } from '../../schemas/report';
import { ReportSummarySchema, type ReportSummary } from '../../schemas/report-response';
import { learnerReport, REPORT_WORDS_VISIBLE, type LearnerReport, type LearnerReportInput } from '../learner-report';
import { GAP, LAST_SYNCED, LEGACY, NOW, STALE4, STEADY } from './fixtures/activity-2026-10';

/**
 * F-REPORT-001 section 3.5 (RP-2a): the learner report's states, stale line, data horizon, at a glance, headline,
 * figures with the up-only marker, calendar, growth line and More detail, as codes and numbers. Counts are the
 * section 3.15 behaviours on the frozen fixtures of section 5.
 */
type Input = Partial<LearnerReportInput> & Pick<LearnerReportInput, 'summary'>;
const report = (input: Input): LearnerReport =>
  learnerReport({ viewer: 'family', voice: 'third', period: 'week', now: NOW, catalog: CATALOG_2026_10, lastSyncedAt: null, ...input });

const DAY_MS = 86_400_000;
const ago = (days: number): string => new Date(NOW.getTime() - days * DAY_MS).toISOString();

/** A copy of `summary` with its activity changed. */
const withActivity = (summary: ReportSummary, activity: Partial<ActivitySummary>): ReportSummary => ({
  ...summary,
  activity: { ...(summary.activity as ActivitySummary), ...activity },
});

/** STEADY as a class reads it after joining on 10 October (RP-W2 `activityOf`): no day, month or `since` from before. */
const STEADY_FOR_CLASS: ReportSummary = (() => {
  const { selfRoute: _selfRoute, ...rest } = STEADY;
  const a = STEADY.activity;
  return {
    ...rest,
    planProgress: {},
    activity: {
      ...a,
      days: a.days.filter((row) => row.d >= '2026-10-10'),
      months: a.months.filter((row) => row.m > '2026-10'),
      total: { ...a.total, since: null },
      next: { q: 'quest:stage1-life-q2', plan: false },
    },
  };
})();

describe('fixtures', () => {
  it('parse as the report route body would carry them', () => {
    for (const summary of [STEADY, GAP, LEGACY, STALE4, STEADY_FOR_CLASS]) expect(ReportSummarySchema.parse(summary)).toEqual(summary);
  });
});

describe('the input has a slot for this learner only (section 3.5)', () => {
  it('names no class figure and no other learner', () => {
    expectTypeOf<keyof LearnerReportInput>().toEqualTypeOf<'summary' | 'viewer' | 'voice' | 'period' | 'at' | 'now' | 'catalog' | 'lastSyncedAt'>();
    expectTypeOf<LearnerReportInput['summary']>().toEqualTypeOf<ReportSummary | null>();
    expectTypeOf<LearnerReportInput['viewer']>().toEqualTypeOf<'family' | 'class' | 'device'>();
  });
});

describe('states (section 3.5 item 1, section 3.14)', () => {
  it('no_data: the server holds no summary (behaviour 12); nothing else is drawn', () => {
    expect(report({ summary: null })).toEqual({
      v: 1,
      state: 'no_data',
      viewer: 'family',
      voice: 'third',
      period: 'week',
      stale: null,
      horizon: null,
      glance: null,
      window: null,
      headline: null,
      figures: null,
      calendar: null,
      growth: null,
      detail: null,
    });
  });

  it('empty: a summary whose activity counts no practice day ever (also after a profile reset, behaviour 16)', () => {
    const fresh = withActivity(STEADY, { days: [], months: [], milestones: [], total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 } });
    const r = report({ summary: fresh, lastSyncedAt: LAST_SYNCED.steady });
    expect(r.state).toBe('empty');
    expect([r.glance, r.window, r.headline, r.figures, r.calendar, r.growth, r.detail, r.horizon]).toEqual([null, null, null, null, null, null, null, null]);
  });

  it('empty: a summary without activity that never had a quest, a card or an active day', () => {
    const r = report({ summary: { stage1: { questsDone: 0, questsTotal: 15, anchorAccuracy: null }, cardsUnlocked: 0, jamoRecognized: [], needsPractice: [], planProgress: {} } });
    expect(r.state).toBe('empty');
    expect(report({ summary: {} }).state).toBe('empty');
  });

  it('legacy: a summary without activity, from an older build (behaviour 7)', () => {
    expect(report({ summary: LEGACY }).state).toBe('legacy');
    expect(report({ summary: { lastActiveAt: '2026-10-01T00:00:00.000Z' } }).state).toBe('legacy');
    expect(report({ summary: { cardsUnlocked: 1 } }).state).toBe('legacy');
    expect(report({ summary: { journey: { v: 1, here: 'stage2', stages: [{ stage: 'stage2', state: 'open', done: 2, known: 0, total: 2 }] } } }).state).toBe('legacy');
  });

  it('ready: a summary with activity and at least one practice day', () => {
    expect(report({ summary: STEADY }).state).toBe('ready');
  });
});

describe('legacy: at a glance and More detail from today\'s summary, no invented period figure (behaviour 7)', () => {
  const r = report({ summary: LEGACY, viewer: 'class', lastSyncedAt: LAST_SYNCED.legacy });

  it('renders the two glance lines', () => {
    expect(r.glance).toEqual({ nowOn: { stage: 'stage1', n: 1 }, lastPractice: '2026-10-10T08:00:00.000Z' });
  });

  it('has no window, headline, figures, calendar or growth (tabs hidden)', () => {
    expect([r.horizon, r.window, r.headline, r.figures, r.calendar, r.growth]).toEqual([null, null, null, null, null, null]);
  });

  it('fills More detail from the legacy fields', () => {
    expect(r.detail).toEqual({
      lettersStrong: ['ㄱ', 'ㄴ', 'ㄷ'],
      lettersStrongMore: 0,
      lettersPractising: ['ㄹ'],
      lettersNew: null,
      totals: { quests: 3, cards: 2 },
      startingSpot: { stage: 'stage1', n: 1, band: 1, takenAt: '2026-10-10T09:00:00.000Z' },
      milestones: [],
      levelCheck: {
        takenAt: '2026-10-10T09:00:00.000Z',
        strands: [
          { strand: 'hangul-recognition', status: 'secure' },
          { strand: 'sound-letter', status: 'getting-there' },
          { strand: 'syllable-reading', status: 'not-yet' },
          { strand: 'vocabulary', status: 'not-tested' },
          { strand: 'sentences', status: 'not-tested' },
        ],
      },
      plan: { kind: 'class', plans: { done: 1, ready: 3 }, self: null },
    });
  });

  it('reads 0 totals when the legacy fields are missing too', () => {
    expect(report({ summary: { lastActiveAt: '2026-10-01T00:00:00.000Z' } }).detail).toMatchObject({ totals: { quests: 0, cards: 0 }, lettersStrong: [], lettersPractising: [] });
  });
});

describe('a steady week, read by a parent (behaviours 1 and 2)', () => {
  const r = report({ summary: STEADY, lastSyncedAt: LAST_SYNCED.steady });

  it('is ready, current and whole', () => {
    expect(r.state).toBe('ready');
    expect(r.stale).toBeNull();
    expect(r.horizon).toEqual({ asOf: '2026-10-15', partial: false });
    expect(r.window).toEqual({ period: 'week', from: '2026-10-09', to: '2026-10-15', at: null, step: 'current', totalsOnly: false, prev: { at: '2026-10-08' }, next: null });
  });

  it('says the learner practiced on 3 days', () => {
    expect(r.headline).toEqual({ code: 'practiced', days: 3, quests: 2, stage: null });
  });

  it('shows 3 days, 36 minutes, 2 quests; up only where the week grew, nothing for minutes (40 last week)', () => {
    expect(r.figures).toEqual({
      days: { count: 3, up: true },
      minutes: { count: 36 },
      quests: { count: 2 },
      cards: { count: 1 },
      letters: { count: 2, up: true },
      words: null,
    });
  });

  it('fills three calendar cells and leaves the rest as neutral outlines', () => {
    expect(r.calendar).toEqual([
      { day: '2026-10-09', kind: 'none', minutes: 0 },
      { day: '2026-10-10', kind: 'none', minutes: 0 },
      { day: '2026-10-11', kind: 'none', minutes: 0 },
      { day: '2026-10-12', kind: 'practiced', minutes: 12 },
      { day: '2026-10-13', kind: 'none', minutes: 0 },
      { day: '2026-10-14', kind: 'practiced', minutes: 9 },
      { day: '2026-10-15', kind: 'practiced', minutes: 15 },
    ]);
  });

  it('draws at a glance and More detail; letters in the order the catalogue teaches them', () => {
    expect(r.glance).toEqual({ nowOn: { stage: 'stage1', n: 1 }, lastPractice: '2026-10-15T09:30:00.000Z' });
    expect(r.detail).toMatchObject({
      lettersStrong: ['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ', 'ㅗ', 'ㅜ', 'ㅁ', 'ㅇ'],
      lettersPractising: ['ㅂ', 'ㅅ'],
      lettersNew: ['ㄱ', 'ㄴ'],
      totals: { quests: 7, cards: 5 },
      milestones: [],
      plan: { kind: 'family', plans: { done: 3, ready: 2 }, self: { done: 2, ready: 2 } },
    });
    expect(r.growth).toBeNull();
  });
});

describe('periods', () => {
  it('day: today only, no comparison and no calendar', () => {
    const r = report({ summary: STEADY, period: 'day' });
    expect(r.window).toMatchObject({ from: '2026-10-15', to: '2026-10-15', prev: { at: '2026-10-14' }, next: null });
    expect(r.figures).toEqual({ days: { count: 1 }, minutes: { count: 15 }, quests: { count: 1 }, cards: { count: 0 }, letters: { count: 1 }, words: null });
    expect(r.calendar).toBeNull();
    expect(r.headline).toEqual({ code: 'practiced', days: 1, quests: 1, stage: null });
  });

  it('day: a day without practice reads none_yet; a replayed quest counts its minutes, not a new quest (behaviour 3)', () => {
    expect(report({ summary: STEADY, period: 'day', at: '2026-10-13' }).headline).toEqual({ code: 'none_yet', days: 0, quests: 0, stage: null });
    const replay = withActivity(STEADY, { days: [...STEADY.activity.days.slice(0, -1), { d: '2026-10-15', min: 15, q: 0, c: 0, w: 0, j: [] }] });
    expect(report({ summary: replay, period: 'day' }).figures).toMatchObject({ minutes: { count: 15 }, quests: { count: 0 } });
  });

  it('month: the calendar month to date against all of last month (quests grew, minutes did not)', () => {
    const r = report({ summary: STEADY, period: 'month' });
    expect(r.window).toMatchObject({ from: '2026-10-01', to: '2026-10-15', at: null, step: 'current', totalsOnly: false, prev: { at: '2026-09-01' }, next: null });
    expect(r.figures).toEqual({ days: { count: 5 }, minutes: { count: 76 }, quests: { count: 4, up: true }, cards: { count: 2 }, letters: { count: 3 }, words: null });
    expect(r.calendar).toHaveLength(15);
    expect(r.calendar?.filter((cell) => cell.kind === 'practiced').map((cell) => cell.day)).toEqual(['2026-10-03', '2026-10-06', '2026-10-12', '2026-10-14', '2026-10-15']);
    expect(r.detail?.lettersNew).toEqual(['ㅇ', 'ㄱ', 'ㄴ']);
  });

  it('month: figures come from the month row, so a past month keeps them when it ages out of the day rows', () => {
    // On 2 October the day rows reach back to 29 August: September is drawn day by day.
    const early = withActivity(STEADY, { asOf: '2026-10-02', days: STEADY.activity.days.filter((row) => row.d <= '2026-10-02'), months: [STEADY.activity.months[0] as ActivitySummary['months'][number]] });
    const onSecond = report({ summary: early, period: 'month', at: '2026-09-20', now: new Date('2026-10-02T12:00:00.000Z') });
    expect(onSecond.window).toMatchObject({ from: '2026-09-01', to: '2026-09-30', totalsOnly: false });
    expect(onSecond.figures).toEqual({ days: { count: 6 }, minutes: { count: 95 }, quests: { count: 3 }, cards: { count: 3 }, letters: { count: 5 }, words: null });
    expect(onSecond.calendar).toHaveLength(30);
    // On 15 October September is older than the rows: the same counts, totals only.
    expect(report({ summary: STEADY, period: 'month', at: '2026-09-20' }).figures).toEqual({ days: { count: 6 }, minutes: { count: 95 }, quests: { count: 3 }, cards: { count: 3 }, letters: null, words: null });
    // A month row that rounds its minutes once reads as the device wrote it.
    const rounded = withActivity(STEADY, { months: [STEADY.activity.months[0] as ActivitySummary['months'][number], { m: '2026-10', min: 77, q: 4, c: 2, w: 0, days: 5 }] });
    expect(report({ summary: rounded, period: 'month' }).figures?.minutes).toEqual({ count: 77 });
  });

  it('month older than the day rows: totals only, from activity.months; no calendar and no letters', () => {
    const r = report({ summary: STEADY, period: 'month', at: '2026-09-20' });
    expect(r.window).toEqual({ period: 'month', from: '2026-09-01', to: '2026-09-30', at: '2026-09-01', step: 'previous', totalsOnly: true, prev: null, next: { at: null } });
    expect(r.figures).toEqual({ days: { count: 6 }, minutes: { count: 95 }, quests: { count: 3 }, cards: { count: 3 }, letters: null, words: null });
    expect(r.calendar).toBeNull();
    expect(r.detail?.lettersNew).toBeNull();
    expect(r.headline).toEqual({ code: 'practiced', days: 6, quests: 3, stage: null });
    expect(r.horizon).toEqual({ asOf: '2026-10-15', partial: false });
  });

  it('all: totals since the start, a growth line that only rises, no calendar and no stepper', () => {
    const r = report({ summary: STEADY, period: 'all' });
    expect(r.window).toEqual({ period: 'all', from: '2026-09-05', to: '2026-10-15', at: null, step: 'current', totalsOnly: false, prev: null, next: null });
    expect(r.figures).toEqual({ days: { count: 11 }, minutes: { count: 171 }, quests: { count: 7 }, cards: { count: 5 }, letters: { count: 8 }, words: null });
    expect(r.headline).toEqual({ code: 'practiced', days: 11, quests: 7, stage: null });
    expect(r.calendar).toBeNull();
    expect(r.growth).toEqual({
      since: '2026-09-05',
      baseline: { quests: 0, cards: 0 },
      months: [
        { m: '2026-09', quests: 3, cards: 3 },
        { m: '2026-10', quests: 7, cards: 5 },
      ],
    });
    expect(r.detail?.lettersNew).toBeNull();
  });

  it('an unknown period reads as week', () => {
    expect(report({ summary: STEADY, period: 'fortnight' as never }).period).toBe('week');
  });
});

describe('looking back (OD-18)', () => {
  it('the first step back is "previous"; further steps are "earlier"', () => {
    const lastWeek = report({ summary: STEADY, at: '2026-10-08' });
    expect(lastWeek.window).toMatchObject({ from: '2026-10-02', to: '2026-10-08', at: '2026-10-08', step: 'previous', prev: { at: '2026-10-01' }, next: { at: null } });
    expect(lastWeek.headline).toEqual({ code: 'practiced', days: 2, quests: 2, stage: null });
    expect(report({ summary: STEADY, at: '2026-10-01' }).window).toMatchObject({ step: 'earlier', next: { at: '2026-10-08' } });
    expect(report({ summary: STEADY, period: 'day', at: '2026-10-14' }).window?.step).toBe('previous');
    expect(report({ summary: STEADY, period: 'day', at: '2026-10-12' }).window?.step).toBe('earlier');
  });

  it('a week at the edge of the day rows has no up marker: its previous week is not saved in full', () => {
    const edge = report({ summary: STEADY, at: '2026-09-17' });
    expect(edge.window).toMatchObject({ from: '2026-09-11', to: '2026-09-17', prev: null });
    expect(edge.figures).toEqual({ days: { count: 1 }, minutes: { count: 20 }, quests: { count: 1 }, cards: { count: 1 }, letters: { count: 2 }, words: null });
  });

  it('an at out of the limits or malformed reads as the current window', () => {
    for (const at of ['2026-09-10', '2026-10-16', '2026-02-30', 'last-week']) {
      expect(report({ summary: STEADY, at }).window).toMatchObject({ at: null, step: 'current', from: '2026-10-09' });
    }
  });

  it('a month step to a month with activity before this one', () => {
    expect(report({ summary: STEADY, period: 'month' }).window?.prev).toEqual({ at: '2026-09-01' });
    expect(report({ summary: GAP, period: 'month', lastSyncedAt: LAST_SYNCED.gap }).window?.prev).toEqual({ at: '2026-09-01' });
    const older = withActivity(STEADY, { months: [{ m: '2026-07', min: 9, q: 1, c: 0, w: 0, days: 1 }, ...STEADY.activity.months] });
    expect(report({ summary: older, period: 'month', at: '2026-07-04' }).window).toMatchObject({ at: '2026-07-01', step: 'earlier', prev: null, next: { at: '2026-09-01' } });
  });
});

describe('the data horizon (section 3.2, behaviour 13)', () => {
  const r = report({ summary: STALE4, lastSyncedAt: LAST_SYNCED.stale4 });

  it('fills 3 cells, dashes 4 as not saved yet and marks the window partial', () => {
    expect(r.horizon).toEqual({ asOf: '2026-10-11', partial: true });
    expect(r.calendar?.map((cell) => cell.kind)).toEqual(['practiced', 'practiced', 'practiced', 'not_saved', 'not_saved', 'not_saved', 'not_saved']);
    expect(r.calendar?.slice(3).every((cell) => cell.minutes === 0)).toBe(true);
  });

  it('counts saved days only, and leads with the stage finished in the window', () => {
    expect(r.figures).toEqual({ days: { count: 3 }, minutes: { count: 30 }, quests: { count: 7 }, cards: { count: 4 }, letters: { count: 2 }, words: null });
    expect(r.headline).toEqual({ code: 'stage_done', days: 3, quests: 7, stage: { stage: 'stage1', n: 1 } });
    expect(r.detail?.milestones).toEqual([{ stage: 'stage1', n: 1, on: '2026-10-10' }]);
    expect(r.stale).toBeNull();
  });

  it('a window wholly after asOf reads none_saved and counts nothing', () => {
    const today = report({ summary: STALE4, period: 'day' });
    expect(today.headline).toEqual({ code: 'none_saved', days: 0, quests: 0, stage: null });
    expect(today.horizon).toEqual({ asOf: '2026-10-11', partial: true });
    expect(today.figures).toMatchObject({ days: { count: 0 }, minutes: { count: 0 } });
  });

  it('a learner with a gap: no practice this week, one unsaved day; nothing is invented', () => {
    const gap = report({ summary: GAP, lastSyncedAt: LAST_SYNCED.gap });
    expect(gap.headline).toEqual({ code: 'none_yet', days: 0, quests: 0, stage: null });
    expect(gap.horizon).toEqual({ asOf: '2026-10-14', partial: true });
    expect(gap.calendar?.map((cell) => cell.kind)).toEqual(['none', 'none', 'none', 'none', 'none', 'none', 'not_saved']);
    expect(gap.figures).toEqual({ days: { count: 0 }, minutes: { count: 0 }, quests: { count: 0 }, cards: { count: 0 }, letters: { count: 0 }, words: null });
    const month = report({ summary: GAP, period: 'month', lastSyncedAt: LAST_SYNCED.gap });
    expect(month.figures?.days).toEqual({ count: 0 });
    expect(month.headline?.code).toBe('none_yet');
  });
});

describe('stale (section 3.5 item 2)', () => {
  it('by sync: last saved more than 7 days before now', () => {
    expect(report({ summary: STALE4, lastSyncedAt: ago(8) }).stale).toEqual({ lastSaved: '2026-10-07' });
    expect(report({ summary: STALE4, lastSyncedAt: ago(7) }).stale).toBeNull();
  });

  it('by asOf: the device\'s last day more than 7 days before the viewer\'s today; the older date is named', () => {
    const old = withActivity(STALE4, { asOf: '2026-10-07' });
    expect(report({ summary: old, lastSyncedAt: LAST_SYNCED.steady }).stale).toEqual({ lastSaved: '2026-10-07' });
    expect(report({ summary: withActivity(STALE4, { asOf: '2026-10-08' }), lastSyncedAt: LAST_SYNCED.steady }).stale).toBeNull();
    expect(report({ summary: old, lastSyncedAt: ago(30) }).stale).toEqual({ lastSaved: '2026-09-15' });
  });

  it('names the sync day in the learner\'s time zone', () => {
    // 20:00 UTC on 6 October is already 7 October in Seoul.
    expect(report({ summary: withActivity(GAP, {}), lastSyncedAt: '2026-10-06T20:00:00.000Z' }).stale).toEqual({ lastSaved: '2026-10-07' });
  });

  it('a legacy summary is stale by sync only; figures and glance still render', () => {
    const r = report({ summary: LEGACY, lastSyncedAt: ago(9) });
    expect(r.stale).toEqual({ lastSaved: '2026-10-06' });
    expect(r.glance).not.toBeNull();
    expect(report({ summary: LEGACY, lastSyncedAt: 'not a time' }).stale).toBeNull();
  });

  it('the device viewer has no sync time', () => {
    expect(report({ summary: STEADY, viewer: 'device', lastSyncedAt: null }).stale).toBeNull();
  });

  it('the device viewer is stale by asOf only (a report left open for days)', () => {
    const later = new Date(NOW.getTime() + 9 * DAY_MS);
    expect(report({ summary: STEADY, viewer: 'device', lastSyncedAt: null, now: later }).stale).toEqual({ lastSaved: '2026-10-15' });
  });
});

describe('headline order (section 3.5 item 5)', () => {
  it('getting_started replaces practiced and none_yet below 2 practice days ever', () => {
    const one = withActivity(STEADY, { days: [{ d: '2026-10-14', min: 5, q: 0, c: 0, w: 0, j: [] }], months: [{ m: '2026-10', min: 5, q: 0, c: 0, w: 0, days: 1 }], total: { since: '2026-10-14', min: 5, q: 0, c: 0, w: 0, days: 1 } });
    expect(report({ summary: one }).headline).toEqual({ code: 'getting_started', days: 1, quests: 0, stage: null });
    expect(report({ summary: one, period: 'day' }).headline?.code).toBe('getting_started');
    expect(report({ summary: one, period: 'all' }).headline?.code).toBe('getting_started');
  });

  it('getting_started never replaces none_saved or stage_done', () => {
    const one = withActivity(STALE4, { days: [{ d: '2026-10-10', min: 5, q: 1, c: 0, w: 0, j: [] }], months: [{ m: '2026-10', min: 5, q: 1, c: 0, w: 0, days: 1 }], total: { since: '2026-10-10', min: 5, q: 1, c: 0, w: 0, days: 1 } });
    expect(report({ summary: one }).headline?.code).toBe('stage_done');
    expect(report({ summary: one, period: 'day' }).headline?.code).toBe('none_saved');
  });

  it('one practice day this week, nothing new: practiced on 1 day (behaviour 11)', () => {
    const single = withActivity(STEADY, { days: [...STEADY.activity.days.slice(0, 6), { d: '2026-10-14', min: 9, q: 0, c: 0, w: 0, j: [] }] });
    expect(report({ summary: single }).headline).toEqual({ code: 'practiced', days: 1, quests: 0, stage: null });
  });

  it('all: the newest stage finished leads', () => {
    const two = withActivity(STALE4, { milestones: [{ stage: 'stage1', on: '2026-10-10' }, { stage: 'stage2', on: '2026-10-11' }] });
    expect(report({ summary: two, period: 'all' }).headline).toEqual({ code: 'stage_done', days: 11, quests: 15, stage: { stage: 'stage2', n: 2 } });
  });

  it('a milestone of a stage this build does not know is never shown', () => {
    const unknown = withActivity(STALE4, { milestones: [{ stage: 'stage9-x', on: '2026-10-10' }] });
    const r = report({ summary: unknown });
    expect(r.headline?.code).toBe('practiced');
    expect(r.detail?.milestones).toEqual([]);
  });
});

describe('the up-only marker (OD-11): never down, never equal, never against nothing', () => {
  it('a week that grew from 0 carries no marker', () => {
    const r = report({ summary: withActivity(STEADY, { days: STEADY.activity.days.filter((row) => row.d >= '2026-10-09') }) });
    expect(r.figures).toEqual({ days: { count: 3 }, minutes: { count: 36 }, quests: { count: 2 }, cards: { count: 1 }, letters: { count: 2 }, words: null });
  });

  it('a month whose previous month has no row (no activity, or a class that joined then) carries no marker', () => {
    expect(report({ summary: STALE4, period: 'month' }).figures).toEqual({
      days: { count: 11 },
      minutes: { count: 110 },
      quests: { count: 15 },
      cards: { count: 9 },
      letters: { count: 2 },
      words: null,
    });
  });

  it('a figure that dropped carries nothing (no "less", no arrow)', () => {
    // 3 days, 30 minutes, 7 quests, 4 cards against 7 days, 70 minutes, 7 quests, 4 cards the week before.
    const r = report({ summary: STALE4 });
    expect(r.figures).toEqual({ days: { count: 3 }, minutes: { count: 30 }, quests: { count: 7 }, cards: { count: 4 }, letters: { count: 2 }, words: null });
    // The week before grew against the one before it.
    expect(report({ summary: STALE4, at: '2026-10-08' }).figures).toMatchObject({ days: { count: 7, up: true }, minutes: { count: 70, up: true } });
  });
});

describe('a device clock ahead of the viewer', () => {
  it('a month the day rows do not reach and that has no month row reads as zeros, totals only', () => {
    const ahead = withActivity(GAP, { asOf: '2026-11-20', days: [], months: [] });
    const r = report({ summary: ahead, period: 'month' });
    expect(r.window).toMatchObject({ from: '2026-10-01', totalsOnly: true });
    expect(r.figures).toEqual({ days: { count: 0 }, minutes: { count: 0 }, quests: { count: 0 }, cards: { count: 0 }, letters: null, words: null });
    expect(r.calendar).toBeNull();
  });
});

describe('words stay hidden until F-VOC-005 P-4 (section 3.10)', () => {
  it('never shows a words figure, even when the rows carry words', () => {
    expect(REPORT_WORDS_VISIBLE).toBe(false);
    const words = withActivity(STEADY, { days: STEADY.activity.days.map((row) => ({ ...row, w: 3 })) });
    expect(report({ summary: words }).figures?.words).toBeNull();
  });
});

describe('a class reads only what it may (behaviour 15)', () => {
  const r = report({ summary: STEADY_FOR_CLASS, viewer: 'class', period: 'month', lastSyncedAt: LAST_SYNCED.steady });

  it('a day practiced at home before joining is an empty cell, counted nowhere', () => {
    expect(r.calendar?.find((cell) => cell.day === '2026-10-03')).toEqual({ day: '2026-10-03', kind: 'none', minutes: 0 });
    expect(r.figures).toEqual({ days: { count: 3 }, minutes: { count: 36 }, quests: { count: 2 }, cards: { count: 1 }, letters: { count: 2 }, words: null });
  });

  it('the lifetime totals still match the roster', () => {
    expect(r.detail?.totals).toEqual({ quests: 7, cards: 5 });
    const all = report({ summary: STEADY_FOR_CLASS, viewer: 'class', period: 'all' });
    expect(all.figures).toMatchObject({ days: { count: 11 }, quests: { count: 7 } });
    expect(all.window).toMatchObject({ from: '2026-10-12' });
    // No "since" for a class: the first practice day may lie before the learner joined.
    expect(all.growth).toEqual({ since: null, baseline: { quests: 7, cards: 5 }, months: [] });
  });

  it('a class that sees no day, month or milestone yet starts the all window today', () => {
    const joinedToday = withActivity(STEADY_FOR_CLASS, { days: [], months: [], milestones: [] });
    const all = report({ summary: joinedToday, viewer: 'class', period: 'all' });
    expect(all.window).toMatchObject({ from: '2026-10-15', to: '2026-10-15' });
    expect(all.figures?.days).toEqual({ count: 11 });
  });

  it('compares no week the class saw only in part: a learner who joined on Monday 5 October', () => {
    const joinedMonday = withActivity(STEADY_FOR_CLASS, { days: STEADY.activity.days.filter((row) => row.d >= '2026-10-05') });
    const week = report({ summary: joinedMonday, viewer: 'class' });
    // 3 days and 36 minutes against the 1 day (20 minutes) the class saw of the week before: no "more than last week".
    expect(week.figures).toEqual({ days: { count: 3 }, minutes: { count: 36 }, quests: { count: 2 }, cards: { count: 1 }, letters: { count: 2 }, words: null });
    // The stepper stops at the week that holds the first day the class sees.
    expect(week.window?.prev).toEqual({ at: '2026-10-08' });
    expect(report({ summary: joinedMonday, viewer: 'class', at: '2026-10-08' }).window).toMatchObject({ at: '2026-10-08', prev: null });
    expect(report({ summary: joinedMonday, viewer: 'class', at: '2026-10-01' }).window).toMatchObject({ at: null });
    // A family reads the same weeks whole, and compares them.
    expect(report({ summary: STEADY }).figures?.days).toEqual({ count: 3, up: true });
  });

  it('the plan block holds this class\'s plans only, never a self-route', () => {
    expect(r.detail?.plan).toBeNull();
    const withHomework = { ...STEADY_FOR_CLASS, planProgress: { 'plan:class-a': { done: 2, total: 2, notReady: 3 } } };
    expect(report({ summary: withHomework, viewer: 'class' }).detail?.plan).toEqual({ kind: 'class', plans: { done: 2, ready: 0 }, self: null });
    expect(report({ summary: { ...withHomework, selfRoute: STEADY.selfRoute }, viewer: 'class' }).detail?.plan?.self).toBeNull();
  });
});

describe('More detail (section 3.5 item 10)', () => {
  it('names at most 24 strong letters, catalogue order first, then the rest by code point, and counts the others', () => {
    const many = [...'ㅎㅍㅌㅋㅊㅈㅅㅂㅁㄹㄷㄴㄱㅣㅡㅜㅗㅕㅓㅑㅏ', 'ㅛ', 'ㅠ', 'ㄲ', 'ㄸ', 'ㄴ/final'];
    const r = report({ summary: { ...LEGACY, jamoRecognized: many } });
    expect(r.detail?.lettersStrong).toEqual([
      'ㅏ', 'ㅓ', 'ㄱ', 'ㄴ', 'ㅗ', 'ㅜ', 'ㅁ', 'ㅡ', 'ㅣ', 'ㄷ', 'ㄹ', 'ㅈ', 'ㅊ', 'ㅂ', 'ㅅ', 'ㅋ', 'ㅌ', 'ㄴ/final', 'ㅍ', 'ㅑ', 'ㅕ', 'ㅎ', 'ㅛ', 'ㅠ',
    ]);
    expect(r.detail?.lettersStrongMore).toBe(2);
  });

  it('lists every milestone in all and the window\'s in the others, ascending', () => {
    const two = withActivity(STALE4, { milestones: [{ stage: 'stage2', on: '2026-10-11' }, { stage: 'stage1', on: '2026-09-30' }] });
    expect(report({ summary: two, period: 'all' }).detail?.milestones).toEqual([
      { stage: 'stage1', n: 1, on: '2026-09-30' },
      { stage: 'stage2', n: 2, on: '2026-10-11' },
    ]);
    expect(report({ summary: two }).detail?.milestones).toEqual([{ stage: 'stage2', n: 2, on: '2026-10-11' }]);
  });

  it('two stages finished on one day are listed in stage order', () => {
    const sameDay = withActivity(STALE4, { milestones: [{ stage: 'stage2', on: '2026-10-10' }, { stage: 'stage1', on: '2026-10-10' }] });
    expect(report({ summary: sameDay }).detail?.milestones.map((row) => row.stage)).toEqual(['stage1', 'stage2']);
    expect(report({ summary: sameDay }).headline?.stage).toEqual({ stage: 'stage2', n: 2 });
  });

  it('a summary without letter lists still counts and lists nothing', () => {
    const { jamoRecognized: _strong, needsPractice: _practising, ...bare } = STEADY;
    const r = report({ summary: bare, period: 'all' });
    expect(r.figures?.letters).toEqual({ count: 0 });
    expect(r.detail).toMatchObject({ lettersStrong: [], lettersStrongMore: 0, lettersPractising: [] });
  });

  it('never reads oralStage, and has no level check without a placement', () => {
    const r = report({ summary: STEADY });
    expect(JSON.stringify(r)).not.toContain('oral');
    expect(report({ summary: GAP }).detail).toMatchObject({ startingSpot: null, levelCheck: null, plan: null });
  });

  it('the device viewer reads every plan and the self-route; items not ready are left out', () => {
    const device = report({ summary: { ...STEADY, planProgress: { 'plan:a': { done: 1, total: 3, notReady: 2 }, 'plan:b': { done: 0, total: 0, notReady: 4 } } }, viewer: 'device' });
    expect(device.detail?.plan).toEqual({ kind: 'device', plans: { done: 1, ready: 2 }, self: { done: 2, ready: 2 } });
    const selfOnly = report({ summary: { ...STEADY, planProgress: {} }, viewer: 'device' });
    expect(selfOnly.detail?.plan).toEqual({ kind: 'device', plans: null, self: { done: 2, ready: 2 } });
    const emptySelf = report({ summary: { ...STEADY, planProgress: {}, selfRoute: { done: 0, total: 0, notReady: 3, weeks: 1, endsOn: '2026-10-20' } } });
    expect(emptySelf.detail?.plan).toBeNull();
  });

  it('a journey stage this build does not know has no Now on line', () => {
    expect(report({ summary: { ...LEGACY, journey: { v: 1, here: 'stage9', stages: [] } } }).glance?.nowOn).toBeNull();
    expect(report({ summary: { ...LEGACY, journey: { v: 1, here: null, stages: [] } } }).glance?.nowOn).toBeNull();
    expect(report({ summary: { cardsUnlocked: 1 } }).glance).toEqual({ nowOn: null, lastPractice: null });
  });
});

describe('an invalid clock (a malformed server time)', () => {
  it('never throws: today is the device\'s last saved day and there is no stale line', () => {
    const r = report({ summary: STALE4, now: new Date(''), lastSyncedAt: '2026-09-01T00:00:00.000Z' });
    expect(r.state).toBe('ready');
    expect(r.stale).toBeNull();
    expect(r.window).toMatchObject({ from: '2026-10-05', to: '2026-10-11' });
    expect(r.horizon).toEqual({ asOf: '2026-10-11', partial: false });
    expect(report({ summary: LEGACY, now: new Date('nope'), lastSyncedAt: '2026-09-01T00:00:00.000Z' }).stale).toBeNull();
  });
});

describe('voice (OD-17)', () => {
  it('second person only for the device viewer', () => {
    expect(report({ summary: STEADY, viewer: 'device', voice: 'second' }).voice).toBe('second');
    expect(report({ summary: STEADY, viewer: 'family', voice: 'second' }).voice).toBe('third');
    expect(report({ summary: STEADY, viewer: 'class', voice: 'second' }).voice).toBe('third');
  });
});

describe('codes and numbers only (OD-6: no percentage anywhere)', () => {
  const BANNED_KEY = /percent|pct|ratio|rate|accuracy|average|mean|rank|top|best|most|least|lowest|other/i;

  function scan(node: unknown, path: string, keys: string[], numbers: [string, number][]): void {
    if (typeof node === 'number') numbers.push([path, node]);
    else if (Array.isArray(node)) node.forEach((item, i) => scan(item, `${path}[${i}]`, keys, numbers));
    else if (node !== null && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        keys.push(key);
        scan(value, `${path}.${key}`, keys, numbers);
      }
    }
  }

  it('has no percentage, ratio or comparison key, and every number is a whole count', () => {
    for (const summary of [STEADY, GAP, LEGACY, STALE4, STEADY_FOR_CLASS, null]) {
      for (const period of ['day', 'week', 'month', 'all'] as const) {
        for (const viewer of ['family', 'class', 'device'] as const) {
          const keys: string[] = [];
          const numbers: [string, number][] = [];
          scan(report({ summary, period, viewer, lastSyncedAt: LAST_SYNCED.steady }), 'report', keys, numbers);
          expect(keys.filter((key) => BANNED_KEY.test(key))).toEqual([]);
          for (const [path, n] of numbers) expect(Number.isInteger(n) && n >= 0, `${path} = ${n}`).toBe(true);
        }
      }
    }
  });
});
