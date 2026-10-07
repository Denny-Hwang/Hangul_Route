import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { D1Like, D1PreparedLike } from '../../db/d1';

/**
 * A D1 look-alike over Node's built-in SQLite (tests only). It applies the real
 * migrations from apps/api/migrations, so the SQL the Worker runs is the SQL
 * the suite exercises. Foreign keys are on, as on D1.
 */
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');

type SqliteStatement = { get: (...p: unknown[]) => unknown; all: (...p: unknown[]) => unknown[]; run: (...p: unknown[]) => unknown };
type SqliteDatabase = { exec: (sql: string) => void; prepare: (sql: string) => SqliteStatement; close: () => void };

// Vite's resolver predates `node:sqlite`; asking Node for the builtin directly sidesteps it.
const { DatabaseSync } = (process as unknown as { getBuiltinModule: (name: string) => { DatabaseSync: new (path: string) => SqliteDatabase } }).getBuiltinModule('node:sqlite');

export function openSqliteD1(): D1Like & { close: () => void } {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
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
        async run() {
          return db.prepare(sql).run(...params);
        },
      };
      return stmt;
    },
    close: () => db.close(),
  };
}
