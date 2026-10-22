import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays } from '../curriculum/dates';
import { DAILY_REVIEW_RETENTION_DAYS, pruneDailyReviews, type ReviewEntry } from '../index';

/**
 * F-CURR-002 section 4.8, `daily` retention (rows CM-3b and CM-14): the Daily Review and each Keep going
 * are `daily` entries whose `scope` is the local day they were played; after every merge, on the client and
 * in the Worker, only the `daily` entries within 14 days of the newest one's `scope` are kept. No other kind
 * is ever pruned. The rule needs no clock, so every side gives the same list.
 */

const daily = (scope: string, n = 0): ReviewEntry => ({
  id: `daily:${scope}:${n}`,
  kind: 'daily',
  generatedAt: `${scope}T09:00:00.000Z`,
  scope,
  itemIds: ['lex:sagwa'],
  resultStars: 3,
});
const certificate: ReviewEntry = { id: 'review:stage1:a', kind: 'stage-certificate', generatedAt: '2025-01-01T00:00:00.000Z', scope: 'stage1', itemIds: ['jamo:giyeok'], resultStars: 2 };
const feedback: ReviewEntry = { id: 'fb:1', kind: 'feedback', generatedAt: '2025-01-02T00:00:00.000Z', scope: '2024-01-01', itemIds: [] };

describe('pruneDailyReviews (section 4.8)', () => {
  it('keeps 14 local days counted back from the newest daily scope, the newest included', () => {
    expect(DAILY_REVIEW_RETENTION_DAYS).toBe(14);
    const days = Array.from({ length: 20 }, (_, i) => addDays('2026-10-01', i));
    const kept = pruneDailyReviews(days.map((d) => daily(d))).map((r) => r.scope);
    expect(kept).toEqual(days.slice(6));
    expect(kept[0]).toBe('2026-10-07');
    expect(kept[kept.length - 1]).toBe('2026-10-20');
  });

  it('never prunes another kind, however old, and keeps the list order', () => {
    const list = [certificate, daily('2026-01-01'), feedback, daily('2026-10-20'), daily('2026-10-19', 1)];
    expect(pruneDailyReviews(list)).toEqual([certificate, feedback, daily('2026-10-20'), daily('2026-10-19', 1)]);
  });

  it('returns the same list when nothing is pruned (no daily entry, or all in the window)', () => {
    const none = [certificate, feedback];
    expect(pruneDailyReviews(none)).toBe(none);
    const recent = [daily('2026-10-20'), daily('2026-10-07')];
    expect(pruneDailyReviews(recent)).toBe(recent);
    const empty: ReviewEntry[] = [];
    expect(pruneDailyReviews(empty)).toBe(empty);
  });

  it('leaves a daily entry whose scope is not a local day as it is: it has no day to measure (none is written so)', () => {
    const odd = [{ ...daily('2026-10-20', 2), scope: 'stage1' }, { ...daily('x', 3), scope: '2026-02-30' }];
    expect(pruneDailyReviews(odd)).toBe(odd);
    expect(pruneDailyReviews([daily('2026-01-01'), ...odd, daily('2026-10-20')])).toEqual([...odd, daily('2026-10-20')]);
  });

  it('a year of daily use (a Daily Review and 3 Keep goings every day) stays under 64 daily entries', () => {
    let list: ReviewEntry[] = [certificate];
    for (let day = 0; day < 366; day += 1) {
      const scope = addDays('2026-01-01', day);
      for (let n = 0; n < 4; n += 1) list = pruneDailyReviews([...list, daily(scope, n)]);
      expect(list.filter((r) => r.kind === 'daily').length).toBeLessThan(64);
    }
    expect(list.filter((r) => r.kind === 'daily')).toHaveLength(56);
    expect(list).toContain(certificate);
    // The size of the kept list, as JSON, is bounded too (about 100 B an entry).
    expect(JSON.stringify(list).length).toBeLessThan(64 * 200);
  });

  it('gives the same result on every side: idempotent, and a union of pruned lists prunes to the prune of the union', () => {
    const day = fc.integer({ min: 0, max: 60 }).map((i) => addDays('2026-08-01', i));
    const entries = fc.array(fc.tuple(day, fc.integer({ min: 0, max: 3 })), { maxLength: 40 }).map((xs) => xs.map(([d, n]) => daily(d, n)));
    fc.assert(
      fc.property(entries, entries, (a, b) => {
        const union = (x: readonly ReviewEntry[], y: readonly ReviewEntry[]): ReviewEntry[] => {
          const out = new Map<string, ReviewEntry>();
          for (const r of [...x, ...y]) out.set(r.id, r);
          return [...out.values()].sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
        };
        const once = pruneDailyReviews(a);
        expect(pruneDailyReviews(once)).toEqual(once);
        // A pruned entry never comes back: the union of each side's pruned list prunes to the same list as the raw union.
        expect(pruneDailyReviews(union(pruneDailyReviews(a), pruneDailyReviews(b)))).toEqual(pruneDailyReviews(union(a, b)));
      }),
    );
  });
});
