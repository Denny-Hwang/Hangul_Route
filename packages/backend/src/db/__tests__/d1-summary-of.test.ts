import { describe, expect, it } from 'vitest';
import { D1Db, type D1Like, type D1PreparedLike } from '../d1';

/** A D1 that records each statement and answers `first()` with `row`. */
function d1Answering(row: Record<string, unknown> | null): { d1: D1Like; sql: string[]; bound: unknown[][] } {
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
        first: async <T>() => row as T | null,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: 0 } }),
      };
      return prepared;
    },
    batch: async (statements) => Promise.all(statements.map((statement) => statement.run())),
  };
  return { d1, sql, bound };
}

/**
 * F-REPORT-001 section 3.8 (M11): the report routes read the summary with a
 * narrow select of three columns. `getSnapshot` is `SELECT *`, so it would
 * load `payload_json` (the learner's whole device state) too.
 */
describe('D1Db.summaryOf selects only learner_id, summary_json and updated_at', () => {
  it('sends one statement that never names payload_json and never selects *', async () => {
    const { d1, sql, bound } = d1Answering({ learner_id: 'profile:suni', summary_json: '{"cardsUnlocked":2}', updated_at: '2026-10-08T00:00:00.000Z' });
    const read = await new D1Db(d1).summaryOf('profile:suni');
    expect(read).toEqual({ learnerId: 'profile:suni', summary: { cardsUnlocked: 2 }, updatedAt: '2026-10-08T00:00:00.000Z' });
    expect(sql).toEqual(['SELECT learner_id, summary_json, updated_at FROM snapshots WHERE learner_id = ?']);
    expect(sql[0]).not.toMatch(/payload_json|\*/);
    expect(bound).toEqual([['profile:suni']]);
  });

  it('answers null when the learner has no row', async () => {
    expect(await new D1Db(d1Answering(null).d1).summaryOf('profile:nobody')).toBeNull();
  });
});
