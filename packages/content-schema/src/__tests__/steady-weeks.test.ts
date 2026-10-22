import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CURR_002_SNAPSHOT_KEYS,
  ProgressSnapshotSchema,
  SteadyWeeksSchema,
  WeekMondaySchema,
  boundToNow,
  latestLocalDay,
  mergeLatchRecord,
  readSnapshotCopy,
} from '../index';

/*
 * `steadyWeeks` (F-CURR-002 section 4.8, row CM-17): week Monday -> when the
 * week reached its weekly goal. Lenient per entry, union of keys with the
 * earliest time per key, and bounded by the Worker's clock like every latch.
 */

const legacy = {
  profileId: 'profile:one',
  updatedAt: '2026-10-10T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
};

describe('WeekMondaySchema and SteadyWeeksSchema', () => {
  it('keeps Monday keys only (the ISO week on local days)', () => {
    expect(WeekMondaySchema.safeParse('2026-10-19').success).toBe(true);
    for (const bad of ['2026-10-20', '2026-10-18', '2026-02-30', '20261019', '']) expect(WeekMondaySchema.safeParse(bad).success).toBe(false);
  });

  it('drops an entry whose key is not a Monday or whose time is not a strict instant, and keeps the rest', () => {
    const read = SteadyWeeksSchema.parse({
      '2026-10-19': '2026-10-21T09:00:00.000Z',
      '2026-10-20': '2026-10-21T09:00:00.000Z',
      '2026-10-12': 'yesterday',
      '2026-10-05': '2026-10-08T10:00:00+09:00',
    });
    expect(read).toEqual({ '2026-10-05': '2026-10-08T10:00:00+09:00', '2026-10-19': '2026-10-21T09:00:00.000Z' });
    expect(SteadyWeeksSchema.parse('x')).toBeUndefined();
    expect(SteadyWeeksSchema.parse(undefined)).toBeUndefined();
  });

  it('is an optional, lenient snapshot key: absent in an older snapshot, a bad value reads as absent', () => {
    expect(CURR_002_SNAPSHOT_KEYS).toContain('steadyWeeks');
    expect(ProgressSnapshotSchema.parse(legacy).steadyWeeks).toBeUndefined();
    expect(ProgressSnapshotSchema.parse({ ...legacy, steadyWeeks: [1, 2] }).steadyWeeks).toBeUndefined();
    const parsed = ProgressSnapshotSchema.parse({ ...legacy, steadyWeeks: { '2026-10-19': '2026-10-21T09:00:00.000Z' } });
    expect(parsed.steadyWeeks).toEqual({ '2026-10-19': '2026-10-21T09:00:00.000Z' });
  });

  it('readSnapshotCopy reads a server copy leniently: a key a newer build wrote that this build cannot read drops', () => {
    const copy = readSnapshotCopy({ ...legacy, steadyWeeks: { '2026-10-19': '2026-10-21T09:00:00.000Z', bad: 'x' } });
    expect(copy.steadyWeeks).toEqual({ '2026-10-19': '2026-10-21T09:00:00.000Z' });
  });
});

const monday = fc.integer({ min: 0, max: 30 }).map((n) => new Date(Date.UTC(2026, 0, 5) + n * 7 * 86_400_000).toISOString().slice(0, 10));
const instant = fc.integer({ min: 0, max: 400 }).map((n) => new Date(Date.UTC(2026, 0, 5) + n * 3_600_000).toISOString());
const weeks = fc.option(fc.dictionary(monday, instant, { maxKeys: 12 }), { nil: undefined }).map((v) => (v === undefined ? undefined : SteadyWeeksSchema.parse(v)));

describe('steadyWeeks merges as a latch (mergeLatchRecord)', () => {
  it('is commutative, idempotent and associative, and the count never drops', () => {
    fc.assert(
      fc.property(weeks, weeks, weeks, (a, b, c) => {
        const ab = mergeLatchRecord(a, b);
        expect(ab).toEqual(mergeLatchRecord(b, a));
        expect(mergeLatchRecord(ab, b)).toEqual(ab);
        expect(mergeLatchRecord(ab, c)).toEqual(mergeLatchRecord(a, mergeLatchRecord(b, c)));
        const count = Object.keys(ab ?? {}).length;
        expect(count).toBeGreaterThanOrEqual(Math.max(Object.keys(a ?? {}).length, Object.keys(b ?? {}).length));
      }),
      { numRuns: 300 },
    );
  });

  it('keeps the earliest latch time per week', () => {
    expect(mergeLatchRecord({ '2026-10-19': '2026-10-24T09:00:00.000Z' }, { '2026-10-19': '2026-10-21T09:00:00.000Z', '2026-10-12': '2026-10-14T09:00:00.000Z' })).toEqual({
      '2026-10-12': '2026-10-14T09:00:00.000Z',
      '2026-10-19': '2026-10-21T09:00:00.000Z',
    });
  });
});

describe('boundToNow on steadyWeeks (a wrong device clock, section 13)', () => {
  const now = new Date('2026-10-22T12:00:00.000Z');
  const nowIso = now.toISOString();

  it('reads a latch time after now as now, so an earlier stored time still wins', () => {
    const out = boundToNow({ steadyWeeks: { '2026-10-19': '2099-01-01T00:00:00.000Z', '2026-10-12': '2026-10-15T00:00:00.000Z' } }, now);
    expect(out.steadyWeeks).toEqual({ '2026-10-12': '2026-10-15T00:00:00.000Z', '2026-10-19': nowIso });
  });

  it('drops a week whose Monday no time zone has reached yet', () => {
    expect(latestLocalDay(now)).toBe('2026-10-23');
    const out = boundToNow({ steadyWeeks: { '2099-01-05': '2026-10-21T00:00:00.000Z', '2026-10-19': '2026-10-21T00:00:00.000Z' } }, now);
    expect(out.steadyWeeks).toEqual({ '2026-10-19': '2026-10-21T00:00:00.000Z' });
  });

  it('returns the snapshot itself when every week is in bounds', () => {
    const fine = { steadyWeeks: { '2026-10-19': '2026-10-21T00:00:00.000Z' } };
    expect(boundToNow(fine, now)).toBe(fine);
  });
});
