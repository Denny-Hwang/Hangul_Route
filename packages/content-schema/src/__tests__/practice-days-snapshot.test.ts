import { describe, expect, it } from 'vitest';
import { PRACTICE_DAYS_MAX, PracticeDaysSchema, ProgressSnapshotSchema, mergePracticeDays, newestPracticeDays, type PracticeDaysEntry } from '..';

/** AMENDMENTS-ROUTE-CLASS-BLEND section 9.4 (row BL-W): `snapshot.practiceDays`, lenient on read, merged by plan. */

const entry = (planId: string, days: PracticeDaysEntry['days'], updatedAt: string): PracticeDaysEntry => ({ planId, days, updatedAt });
const A1 = entry('plan:a', ['wed', 'fri', 'sun'], '2026-11-01T09:00:00.000Z');
const A2 = entry('plan:a', ['sat'], '2026-11-02T09:00:00.000Z');
const B = entry('plan:b', ['tue'], '2026-11-01T10:00:00.000Z');
const C = entry('plan:c', ['mon', 'thu'], '2026-11-01T11:00:00.000Z');
const D = entry('plan:d', ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], '2026-11-01T12:00:00.000Z');

const snapshot = {
  profileId: 'profile:a',
  updatedAt: '2026-11-01T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
};

describe('PracticeDaysSchema', () => {
  it('is optional with no default: a snapshot without it keeps no key', () => {
    expect(ProgressSnapshotSchema.parse(snapshot)).not.toHaveProperty('practiceDays', expect.anything());
    expect(ProgressSnapshotSchema.parse(snapshot).practiceDays).toBeUndefined();
    expect(ProgressSnapshotSchema.parse({ ...snapshot, practiceDays: [A1] }).practiceDays).toEqual([A1]);
  });

  it('reads a value that is not a list as absent', () => {
    for (const value of [undefined, null, {}, 'x', 3]) expect(PracticeDaysSchema.parse(value)).toBeUndefined();
    expect(PracticeDaysSchema.parse([])).toEqual([]);
  });

  it('drops a malformed entry on its own (no days, 8 days, a repeated day, a bad time, no plan)', () => {
    const bad = [
      entry('plan:x', [], A1.updatedAt),
      { ...entry('plan:x', ['mon'], A1.updatedAt), days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'mon'] },
      entry('plan:x', ['mon', 'mon'], A1.updatedAt),
      entry('plan:x', ['mon'], '2026-11-01 09:00'),
      { days: ['mon'], updatedAt: A1.updatedAt },
      { planId: 'plan:x', days: ['someday'], updatedAt: A1.updatedAt },
      'plan:x',
    ];
    expect(PracticeDaysSchema.parse([A1, ...bad])).toEqual([A1]);
  });

  it('keeps one entry per plan, the newest, and at most three (the newest), in plan order', () => {
    expect(PracticeDaysSchema.parse([A2, A1])).toEqual([A2]);
    expect(PRACTICE_DAYS_MAX).toBe(3);
    expect(PracticeDaysSchema.parse([D, C, B, A1])).toEqual([B, C, D]);
  });
});

describe('mergePracticeDays', () => {
  it('is undefined only when both sides are absent', () => {
    expect(mergePracticeDays(undefined, undefined)).toBeUndefined();
    expect(mergePracticeDays([A1], undefined)).toEqual([A1]);
    expect(mergePracticeDays(undefined, [B])).toEqual([B]);
    expect(mergePracticeDays([], [])).toEqual([]);
  });

  it('keeps the newest updatedAt per plan, compared as instants', () => {
    expect(mergePracticeDays([A1, B], [A2])).toEqual([A2, B]);
    // 10:00+01:00 is 09:00Z, earlier than 09:30Z.
    const offset = entry('plan:a', ['mon'], '2026-11-02T10:00:00.000+01:00');
    const later = entry('plan:a', ['tue'], '2026-11-02T09:30:00.000Z');
    expect(mergePracticeDays([offset], [later])).toEqual([later]);
  });

  it('breaks a tie the same way in either order', () => {
    const x = entry('plan:a', ['mon'], '2026-11-02T09:00:00.000Z');
    const y = entry('plan:a', ['tue'], '2026-11-02T09:00:00.000Z');
    const z = entry('plan:a', ['tue'], '2026-11-02T10:00:00.000+01:00');
    expect(mergePracticeDays([x], [y])).toEqual(mergePracticeDays([y], [x]));
    expect(mergePracticeDays([y], [z])).toEqual(mergePracticeDays([z], [y]));
    expect(mergePracticeDays([x], [x])).toEqual([x]);
  });

  it('is commutative, associative and idempotent', () => {
    const sides = [[A1, B], [A2, C], [D], []] as PracticeDaysEntry[][];
    for (const a of sides) {
      expect(mergePracticeDays(a, a)).toEqual(newestPracticeDays(a));
      for (const b of sides) {
        expect(mergePracticeDays(a, b)).toEqual(mergePracticeDays(b, a));
        for (const c of sides) expect(mergePracticeDays(mergePracticeDays(a, b), c)).toEqual(mergePracticeDays(a, mergePracticeDays(b, c)));
      }
    }
  });

  it('never shares an array with its inputs', () => {
    const out = mergePracticeDays([A1], undefined);
    expect(out?.[0]).not.toBe(A1);
    expect(out?.[0]?.days).not.toBe(A1.days);
  });
});
