import { describe, expect, it } from 'vitest';
import { CATALOG_2026_10 } from '../../__tests__/fixtures/catalog-2026-10';
import { addDays } from '../../curriculum/dates';
import { REPORT_MONTHS_MAX, type ActivityDay, type ActivitySummary } from '../../schemas/report';
import type { ReportSummary } from '../../schemas/report-response';
import { learnerReport, type LearnerReport } from '../learner-report';
import { monthOf, rowsFromOf } from '../windows';

/**
 * F-REPORT-001 section 3.5 "Nothing is ever taken away" and OD-10 (RP-2a), as properties over random activity
 * streams: a past window's figures never change when later activity is added, and the growth line never goes
 * down, neither along its months nor from one day to the next.
 */

/** mulberry32: a small seeded generator, so every run draws the same streams. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface Event {
  d: string;
  min: number;
  q: number;
  c: number;
}

const START = '2025-06-01';
const LETTERS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅏ', 'ㅓ', 'ㅗ'];

/** A stream of practice events over `span` days from START; about 2 days in 5 have one. */
function stream(seed: number, span: number): Event[] {
  const next = rng(seed);
  const out: Event[] = [];
  for (let i = 0; i < span; i += 1) {
    if (next() < 0.4) out.push({ d: addDays(START, i), min: Math.floor(next() * 40), q: Math.floor(next() * 3), c: Math.floor(next() * 2) });
  }
  return out;
}

/** What a device holds on `asOf` (section 3.3.4 steps 1-7, in miniature): 35 day rows, 24 months, exact totals. */
function activityOn(events: readonly Event[], asOf: string): ActivitySummary {
  const seen = events.filter((e) => e.d <= asOf);
  const rowsFrom = rowsFromOf(asOf);
  const days: ActivityDay[] = seen
    .filter((e) => e.d >= rowsFrom)
    .map((e) => ({ d: e.d, min: e.min, q: e.q, c: e.c, w: 0, j: e.q > 0 ? [LETTERS[Number(e.d.slice(8)) % LETTERS.length] as string] : [] }));
  const byMonth = new Map<string, { m: string; min: number; q: number; c: number; w: number; days: number }>();
  for (const e of seen) {
    const row = byMonth.get(monthOf(e.d)) ?? { m: monthOf(e.d), min: 0, q: 0, c: 0, w: 0, days: 0 };
    row.min += e.min;
    row.q += e.q;
    row.c += e.c;
    row.days += 1;
    byMonth.set(row.m, row);
  }
  const sum = (key: 'min' | 'q' | 'c'): number => seen.reduce((total, e) => total + e[key], 0);
  return {
    v: 1,
    tz: 0,
    asOf,
    days,
    months: [...byMonth.values()].slice(-REPORT_MONTHS_MAX),
    total: { since: seen[0]?.d ?? null, min: sum('min'), q: sum('q'), c: sum('c'), w: 0, days: seen.length },
    milestones: [],
  };
}

const summaryOn = (events: readonly Event[], asOf: string): ReportSummary => ({
  lastActiveAt: `${asOf}T10:00:00.000Z`,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
  activity: activityOn(events, asOf),
});

const reportOn = (events: readonly Event[], asOf: string, period: 'day' | 'week' | 'month' | 'all', at?: string): LearnerReport =>
  learnerReport({
    summary: summaryOn(events, asOf),
    viewer: 'family',
    voice: 'third',
    period,
    at,
    now: new Date(`${asOf}T12:00:00.000Z`),
    catalog: CATALOG_2026_10,
    lastSyncedAt: null,
  });

/** The counts of a report's figures, without the up-only marker (it reads the window before). */
const counts = (r: LearnerReport): Record<string, number | null> =>
  Object.fromEntries(Object.entries(r.figures ?? {}).map(([key, f]) => [key, f === null ? null : f.count]));

const SPAN = 400;
const RUNS = 60;

describe('a past window never changes when later activity is added', () => {
  it('day and week windows within the saved rows', () => {
    let checked = 0;
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const events = stream(seed, SPAN);
      const later = addDays(START, SPAN - 1);
      const earlier = addDays(later, -(seed % 7));
      for (const back of [7, 14, 21]) {
        const at = addDays(earlier, -back);
        // Within the rows on both days: the week's first day is not before the later device's first row.
        if (addDays(at, -6) < rowsFromOf(later)) continue;
        for (const period of ['day', 'week'] as const) {
          const before = reportOn(events, earlier, period, at);
          const after = reportOn(events, later, period, at);
          expect(after.window?.at, `seed ${seed} ${period} at ${at}`).toBe(at);
          expect(counts(after), `seed ${seed} ${period} at ${at}`).toEqual(counts(before));
          expect(after.calendar).toEqual(before.calendar);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(RUNS);
  });

  it('a past month, from its month row', () => {
    let checked = 0;
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const events = stream(seed, SPAN);
      const later = addDays(START, SPAN - 1);
      const earlier = addDays(later, -20);
      const months = activityOn(events, earlier).months.map((row) => row.m).filter((m) => m < monthOf(earlier) && m > monthOf(addDays(later, -300)));
      for (const m of months) {
        const before = reportOn(events, earlier, 'month', `${m}-15`);
        const after = reportOn(events, later, 'month', `${m}-15`);
        expect(after.window?.at, `seed ${seed} ${m}`).toBe(`${m}-01`);
        expect(counts(after), `seed ${seed} ${m}`).toEqual(counts(before));
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(RUNS * 4);
  });
});

describe('the growth line only rises (OD-10)', () => {
  it('along its months, from the baseline', () => {
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const growth = reportOn(stream(seed, SPAN), addDays(START, SPAN - 1), 'all').growth;
      expect(growth).not.toBeNull();
      let quests = growth?.baseline.quests ?? 0;
      let cards = growth?.baseline.cards ?? 0;
      for (const point of growth?.months ?? []) {
        expect(point.quests).toBeGreaterThanOrEqual(quests);
        expect(point.cards).toBeGreaterThanOrEqual(cards);
        quests = point.quests;
        cards = point.cards;
      }
    }
  });

  it('from one day to the next, at every month it shows, even when old months leave the 24', () => {
    let checked = 0;
    for (let seed = 1; seed <= RUNS / 3; seed += 1) {
      const events = stream(seed, SPAN * 2);
      let previous = new Map<string, { quests: number; cards: number }>();
      for (let i = SPAN; i < SPAN * 2; i += 9) {
        const growth = reportOn(events, addDays(START, i), 'all').growth;
        const points = new Map((growth?.months ?? []).map((p) => [p.m, { quests: p.quests, cards: p.cards }]));
        for (const [m, point] of points) {
          const before = previous.get(m);
          if (before === undefined) continue;
          expect(point.quests, `seed ${seed} ${m}`).toBeGreaterThanOrEqual(before.quests);
          expect(point.cards, `seed ${seed} ${m}`).toBeGreaterThanOrEqual(before.cards);
          checked += 1;
        }
        previous = points;
      }
    }
    expect(checked).toBeGreaterThan(RUNS * 10);
  });
});
