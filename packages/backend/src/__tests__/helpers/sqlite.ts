import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { D1Like, D1PreparedLike, D1RunResultLike } from '../../db/d1';

/**
 * A D1 look-alike over Node's built-in SQLite (tests only). It applies the real
 * migrations from apps/api/migrations, so the SQL the Worker runs is the SQL
 * the suite exercises. Foreign keys are on, as on D1.
 */
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');

type SqliteStatement = { get: (...p: unknown[]) => unknown; all: (...p: unknown[]) => unknown[]; run: (...p: unknown[]) => { changes: number | bigint } };
type SqliteDatabase = { exec: (sql: string) => void; prepare: (sql: string) => SqliteStatement; close: () => void };

// Vite's resolver predates `node:sqlite`; asking Node for the builtin directly sidesteps it.
const { DatabaseSync } = (process as unknown as { getBuiltinModule: (name: string) => { DatabaseSync: new (path: string) => SqliteDatabase } }).getBuiltinModule('node:sqlite');

/**
 * `before` (a migration file name, e.g. `0006_plan_meta.sql`) stops at the
 * database of the previous migration, so a migration test can seed rows the
 * way production holds them and then apply the new file itself.
 */
export function openSqliteD1(options: { before?: string } = {}): D1Like & { close: () => void } {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => options.before === undefined || f < options.before);
  for (const file of files) db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  /** What each statement this connection prepared will run: its SQL and its current bound params. */
  const recorded = new WeakMap<D1PreparedLike, () => { sql: string; params: unknown[] }>();
  return {
    prepare(sql: string): D1PreparedLike {
      let params: unknown[] = [];
      const stmt: D1PreparedLike = {
        bind(...values: unknown[]) {
          params = values.map((v) => (v === undefined ? null : v));
          return stmt;
        },
        async first<T>() {
          const row = db.prepare(sql).get(...params) as T | undefined;
          return row ?? null;
        },
        async all<T>() {
          return { results: db.prepare(sql).all(...params) as T[] };
        },
        async run(): Promise<D1RunResultLike> {
          // Same shape as D1's D1Result, so callers read `meta.changes` on both.
          const { changes } = db.prepare(sql).run(...params);
          return { meta: { changes: Number(changes) } };
        },
      };
      recorded.set(stmt, () => ({ sql, params }));
      return stmt;
    },
    /**
     * D1's batch, synchronously: every statement runs inside one
     * BEGIN/COMMIT with no `await` in between. This is one shared connection,
     * so an `await` would let another query interleave into the transaction.
     */
    batch(statements: D1PreparedLike[]): Promise<D1RunResultLike[]> {
      const plan = statements.map((stmt) => recorded.get(stmt)?.());
      if (plan.some((step) => !step)) return Promise.reject(new Error('batch: statement not prepared by this connection'));
      const results: D1RunResultLike[] = [];
      db.exec('BEGIN');
      try {
        for (const step of plan as Array<{ sql: string; params: unknown[] }>) {
          const { changes } = db.prepare(step.sql).run(...step.params);
          results.push({ meta: { changes: Number(changes) } });
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        return Promise.reject(error);
      }
      return Promise.resolve(results);
    },
    close: () => db.close(),
  };
}
