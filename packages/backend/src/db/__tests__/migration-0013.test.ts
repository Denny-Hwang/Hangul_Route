import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';

/**
 * Migration 0013_remote_config.sql (F-CURR-002 section 12.2, row CM-2). A merge applies it to production before the
 * Worker code (the Deploy command applies migrations first), so it must be additive: one new table, nothing else
 * created, altered, rewritten, dropped or inserted, so every flag keeps its built-in value until the owner adds a row.
 */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');
const FILE = '0013_remote_config.sql';
const statements = readFileSync(join(DIR, FILE), 'utf8')
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);
const T = '2026-10-21T00:00:00.000Z';

describe('migration 0013_remote_config.sql · production safety', () => {
  it('is the only migration with its number', () => {
    expect(readdirSync(DIR).filter((f) => f.startsWith('0013_'))).toEqual([FILE]);
  });

  it('creates one table and nothing else: no ALTER, DROP, UPDATE, DELETE or INSERT', () => {
    expect(statements).toEqual([
      'CREATE TABLE IF NOT EXISTS remote_config ( flag TEXT PRIMARY KEY, "on" INTEGER NOT NULL CHECK ("on" IN (0, 1)), pct INTEGER NOT NULL CHECK (pct BETWEEN 0 AND 100), updated_at TEXT NOT NULL, reason TEXT )',
    ]);
    expect(statements.join(' ')).not.toMatch(/\bALTER\b|\bDROP\b|\bUPDATE\b|\bDELETE\b|\bINSERT\b|\bREPLACE\b/i);
  });

  it('applies on the database at the previous migration, starts empty, and is idempotent', async () => {
    const d1 = openSqliteD1({ before: FILE });
    await expect(new D1Db(d1).remoteConfig()).rejects.toThrow(/remote_config/);
    for (const st of statements) await d1.prepare(st).run();
    for (const st of statements) await d1.prepare(st).run(); // IF NOT EXISTS: a second apply is a no-op
    const db = new D1Db(d1);
    expect(await db.remoteConfig()).toEqual([]);
    await db.putRemoteConfig({ flag: 'memoryRecord', on: true, pct: 10, updatedAt: T, reason: 'ramp 10' });
    await db.putRemoteConfig({ flag: 'dailyReview', on: false, pct: 0, updatedAt: T, reason: null });
    expect(await db.remoteConfig()).toEqual([
      { flag: 'dailyReview', on: false, pct: 0, updatedAt: T, reason: null },
      { flag: 'memoryRecord', on: true, pct: 10, updatedAt: T, reason: 'ramp 10' },
    ]);
    d1.close();
  });

  it('a row without on, pct or updated_at is refused (NOT NULL)', async () => {
    const d1 = openSqliteD1();
    await expect(d1.prepare('INSERT INTO remote_config (flag, pct, updated_at) VALUES (?, ?, ?)').bind('goals', 0, T).run()).rejects.toThrow();
    await expect(d1.prepare('INSERT INTO remote_config (flag, "on", updated_at) VALUES (?, ?, ?)').bind('goals', 1, T).run()).rejects.toThrow();
    await expect(d1.prepare('INSERT INTO remote_config (flag, "on", pct) VALUES (?, ?, ?)').bind('goals', 1, 0).run()).rejects.toThrow();
    d1.close();
  });

  it('a row with on outside 0/1 or pct outside 0-100 is refused (CHECK), so a ramp typo fails at the console', async () => {
    const d1 = openSqliteD1();
    const put = (on: unknown, pct: unknown) => d1.prepare('INSERT INTO remote_config (flag, "on", pct, updated_at) VALUES (?, ?, ?, ?)').bind('goals', on, pct, T).run();
    for (const [on, pct] of [[2, 10], [-1, 10], [1, 101], [1, 250], [1, -1]] as const) await expect(put(on, pct), `${on}/${pct}`).rejects.toThrow(/CHECK/i);
    await put(1, 100);
    await expect(new D1Db(d1).remoteConfig()).resolves.toEqual([{ flag: 'goals', on: true, pct: 100, updatedAt: T, reason: null }]);
    d1.close();
  });

  it('reset empties it (tests only)', async () => {
    const d1 = openSqliteD1();
    const db = new D1Db(d1);
    await db.putRemoteConfig({ flag: 'goals', on: true, pct: 100, updatedAt: T, reason: null });
    await db.reset();
    expect(await db.remoteConfig()).toEqual([]);
    d1.close();
  });
});
