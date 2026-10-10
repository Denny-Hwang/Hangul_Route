import { describe, expect, it } from 'vitest';
import { D1Db, type D1Like, type D1PreparedLike } from '../d1';

const T = '2026-10-10T00:00:00.000Z';
const record = { learnerId: 'profile:suni', rev: 2, schemaVer: 1, contentVer: '2026.09', deviceId: 'device-a', summary: {}, payload: { profileId: 'profile:suni' }, updatedAt: T };

/** A D1 that records each statement and answers every run() with `answer`. */
function d1Answering(answer: unknown): { d1: D1Like; sql: string[]; bound: unknown[][] } {
  const sql: string[] = [];
  const bound: unknown[][] = [];
  const d1: D1Like = {
    prepare(statement: string): D1PreparedLike {
      sql.push(statement);
      const prepared: D1PreparedLike = {
        bind(...values: unknown[]) {
          bound.push(values);
          return prepared;
        },
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => answer as never,
      };
      return prepared;
    },
  };
  return { d1, sql, bound };
}

/**
 * SYNC-1: the compare-and-set lives in one statement and its answer is the row
 * count D1 reports in `meta.changes`. Guessing when D1 does not report one would
 * turn every upload into a silent 409, so the write throws instead.
 */
describe('D1Db.putSnapshot reads meta.changes (SYNC-1)', () => {
  it('one changed row is a win; zero is a lost race', async () => {
    expect(await new D1Db(d1Answering({ meta: { changes: 1 } }).d1).putSnapshot(record, 1)).toBe(true);
    expect(await new D1Db(d1Answering({ meta: { changes: 0 } }).d1).putSnapshot(record, 1)).toBe(false);
    expect(await new D1Db(d1Answering({ meta: { changes: 1 } }).d1).putSnapshot(record, 0)).toBe(true);
    expect(await new D1Db(d1Answering({ meta: { changes: 0 } }).d1).putSnapshot(record, 0)).toBe(false);
  });

  it('sends one statement: UPDATE … WHERE learner_id = ? AND rev = ? from a stored rev, INSERT … DO NOTHING from none', async () => {
    const update = d1Answering({ meta: { changes: 1 } });
    await new D1Db(update.d1).putSnapshot(record, 1);
    expect(update.sql).toHaveLength(1);
    expect(update.sql[0]).toMatch(/^UPDATE snapshots SET .* WHERE learner_id = \? AND rev = \?$/);
    expect(update.bound[0]?.slice(-2)).toEqual(['profile:suni', 1]);

    const insert = d1Answering({ meta: { changes: 1 } });
    await new D1Db(insert.d1).putSnapshot(record, 0);
    expect(insert.sql).toHaveLength(1);
    expect(insert.sql[0]).toMatch(/^INSERT INTO snapshots .* ON CONFLICT\(learner_id\) DO NOTHING$/);
  });

  it('throws when the binding does not say how many rows changed, instead of reporting a lost race', async () => {
    for (const answer of [{}, { meta: {} }, { meta: { changes: '1' } }, undefined, null]) {
      await expect(new D1Db(d1Answering(answer).d1).putSnapshot(record, 1)).rejects.toThrow(/meta\.changes/);
    }
  });
});
