import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';

/**
 * Migration 0014_learning_rollups.sql (F-CURR-002 section 11.2, row CM-70a). A merge applies it to
 * production before the Worker code (server first), so it must be additive: one new table, created
 * only, and nothing existing altered, rewritten or dropped. Its columns hold codes and counts only.
 */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');
const FILE = '0014_learning_rollups.sql';
const statements = readFileSync(join(DIR, FILE), 'utf8')
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);
const T = '2026-10-21T00:00:00.000Z';

describe('migration 0014_learning_rollups.sql · production safety', () => {
  it('is the only migration with its number', () => {
    expect(readdirSync(DIR).filter((f) => f.startsWith('0014_'))).toEqual([FILE]);
  });

  it('is one CREATE TABLE and nothing else: no ALTER, DROP, UPDATE, DELETE, INSERT or CHECK', () => {
    expect(statements).toEqual([
      'CREATE TABLE IF NOT EXISTS learning_rollups ( day TEXT NOT NULL, metric TEXT NOT NULL, dim TEXT NOT NULL, bucket TEXT NOT NULL, events INTEGER NOT NULL, PRIMARY KEY (day, metric, dim, bucket) ) WITHOUT ROWID',
    ]);
    expect(statements.join(' ')).not.toMatch(/\bALTER\b|\bDROP\b|\bUPDATE\b|\bDELETE\b|\bINSERT\b|\bCHECK\b|\bREPLACE\b/i);
  });

  it('is WITHOUT ROWID, so an upsert writes one row and no separate primary-key index', async () => {
    const d1 = openSqliteD1();
    const indexes = (await d1.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'learning_rollups'").all()).results;
    expect(indexes).toEqual([]);
    d1.close();
  });

  it('has exactly the five columns of section 11.2: none for a profile, install, device or account id', async () => {
    const d1 = openSqliteD1();
    const columns = (await d1.prepare("SELECT name, type, \"notnull\" AS nn, pk FROM pragma_table_info('learning_rollups') ORDER BY cid").all()).results;
    expect(columns).toEqual([
      { name: 'day', type: 'TEXT', nn: 1, pk: 1 },
      { name: 'metric', type: 'TEXT', nn: 1, pk: 2 },
      { name: 'dim', type: 'TEXT', nn: 1, pk: 3 },
      { name: 'bucket', type: 'TEXT', nn: 1, pk: 4 },
      { name: 'events', type: 'INTEGER', nn: 1, pk: 0 },
    ]);
    d1.close();
  });

  it('applies on the database at the previous migration; existing rows read back unchanged; applying twice is harmless', async () => {
    const d1 = openSqliteD1({ before: FILE });
    const before = new D1Db(d1);
    const account = { id: 'acct-1', email: null, displayName: null, consent: null, createdAt: T };
    await before.putAccount(account);
    await expect(d1.prepare('SELECT * FROM learning_rollups').all()).rejects.toThrow(/learning_rollups/);
    for (let round = 0; round < 2; round += 1) for (const st of statements) await d1.prepare(st).run();
    const after = new D1Db(d1);
    expect(await after.getAccount('acct-1')).toEqual(account);
    await after.addRollups('2026-10-21', [{ metric: 'goal.met', dim: '', bucket: '3' }]);
    await after.addRollups('2026-10-21', [
      { metric: 'goal.met', dim: '', bucket: '3' },
      { metric: 'goal.met', dim: '', bucket: '3' },
    ]);
    expect(await after.rollupRows('2026-10-21', '2026-10-21', undefined, 10)).toEqual([{ day: '2026-10-21', metric: 'goal.met', dim: '', bucket: '3', events: 2 }]);
    expect(await after.reserveRollupCells('2026-10-21', 'rollup.cells', 500)).toBe(500);
    expect(await after.reserveRollupCells('2026-10-21', 'rollup.cells', 500)).toBe(1000);
    expect(await after.rollupRows('2026-10-21', '2026-10-21', 'rollup.cells', 10)).toEqual([{ day: '2026-10-21', metric: 'rollup.cells', dim: '', bucket: '', events: 1000 }]);
    expect(await after.rollupRows('2026-10-21', '2026-10-21', undefined, 1)).toHaveLength(1);
    d1.close();
  });

  it('a Worker that runs before the migration fails the rollup write (the route swallows it) and reads nothing', async () => {
    const d1 = openSqliteD1({ before: FILE });
    const db = new D1Db(d1);
    await expect(db.addRollups('2026-10-21', [{ metric: 'goal.met', dim: '', bucket: '3' }])).rejects.toThrow(/learning_rollups/);
    await expect(db.addRollups('2026-10-21', [])).resolves.toBeUndefined();
    d1.close();
  });
});
