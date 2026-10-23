import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CURR_002_SNAPSHOT_KEYS, LatchRecordSchema, ProgressSnapshotSchema, boundToNow, mergeLatchRecord, readSnapshotCopy } from '../index';

/*
 * `stageCeremonyAt` (F-CURR-002 sections 4.8 and 7.3, row CM-22, W then A): stage key -> when its ceremony was
 * offered, or when the one retroactive summary listed it. Lenient per entry, union of keys with the earliest time per
 * key (so no stage is summed up twice on any device), and bounded by the Worker's clock like every latch.
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

describe('stageCeremonyAt in the snapshot', () => {
  it('is an optional, lenient snapshot key: absent in an older snapshot, a bad entry drops on its own', () => {
    expect(CURR_002_SNAPSHOT_KEYS).toContain('stageCeremonyAt');
    expect(ProgressSnapshotSchema.parse(legacy).stageCeremonyAt).toBeUndefined();
    expect(ProgressSnapshotSchema.parse({ ...legacy, stageCeremonyAt: 'x' }).stageCeremonyAt).toBeUndefined();
    const parsed = ProgressSnapshotSchema.parse({ ...legacy, stageCeremonyAt: { stage2: '2026-10-21T09:00:00.000Z', stage3: 'yesterday' } });
    expect(parsed.stageCeremonyAt).toEqual({ stage2: '2026-10-21T09:00:00.000Z' });
  });

  it('readSnapshotCopy keeps it from a server copy', () => {
    expect(readSnapshotCopy({ ...legacy, stageCeremonyAt: { stage4: '2026-10-21T09:00:00.000Z', bad: 3 } }).stageCeremonyAt).toEqual({
      stage4: '2026-10-21T09:00:00.000Z',
    });
  });
});

const stage = fc.constantFrom('stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7');
const instant = fc.integer({ min: 0, max: 400 }).map((n) => new Date(Date.UTC(2026, 9, 1) + n * 3_600_000).toISOString());
const latches = fc.option(fc.dictionary(stage, instant, { maxKeys: 6 }), { nil: undefined }).map((v) => (v === undefined ? undefined : LatchRecordSchema.parse(v)));

describe('stageCeremonyAt merges as a latch (mergeLatchRecord)', () => {
  it('is commutative, idempotent and associative, and never loses a stage', () => {
    fc.assert(
      fc.property(latches, latches, latches, (a, b, c) => {
        const ab = mergeLatchRecord(a, b);
        expect(ab).toEqual(mergeLatchRecord(b, a));
        expect(mergeLatchRecord(ab, ab)).toEqual(ab);
        expect(mergeLatchRecord(ab, b)).toEqual(ab);
        expect(mergeLatchRecord(ab, c)).toEqual(mergeLatchRecord(a, mergeLatchRecord(b, c)));
        for (const key of [...Object.keys(a ?? {}), ...Object.keys(b ?? {})]) expect(ab?.[key]).toBeDefined();
      }),
      { numRuns: 300 },
    );
  });

  it('keeps the earliest time per stage', () => {
    expect(mergeLatchRecord({ stage2: '2026-10-24T09:00:00.000Z' }, { stage2: '2026-10-21T09:00:00.000Z', stage3: '2026-10-22T09:00:00.000Z' })).toEqual({
      stage2: '2026-10-21T09:00:00.000Z',
      stage3: '2026-10-22T09:00:00.000Z',
    });
  });
});

describe('boundToNow on stageCeremonyAt (a wrong device clock, section 13)', () => {
  const now = new Date('2026-10-22T12:00:00.000Z');

  it('reads a latch time after the Worker now as now, so an earlier stored time still wins', () => {
    const out = boundToNow({ stageCeremonyAt: { stage2: '2099-01-01T00:00:00.000Z', stage3: '2026-10-15T00:00:00.000Z' } }, now);
    expect(out.stageCeremonyAt).toEqual({ stage2: now.toISOString(), stage3: '2026-10-15T00:00:00.000Z' });
    expect(mergeLatchRecord(out.stageCeremonyAt, { stage2: '2026-10-20T00:00:00.000Z' })?.stage2).toBe('2026-10-20T00:00:00.000Z');
  });

  it('returns the snapshot itself when every time is in bounds', () => {
    const fine = { stageCeremonyAt: { stage2: '2026-10-21T00:00:00.000Z' } };
    expect(boundToNow(fine, now)).toBe(fine);
  });
});
