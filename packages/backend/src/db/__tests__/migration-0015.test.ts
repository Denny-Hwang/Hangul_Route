import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { runScheduledPurge } from '../../lib/note-retention';
import { TELEMETRY_DAILY_WRITES_PER_MIN, countTelemetryDaily, resetTelemetryDailyBudgetForTests } from '../../lib/telemetry-daily';
import { D1Db, TELEMETRY_DAILY_ROWS_PER_STATEMENT } from '../d1';

/**
 * [OA] Migration 0015_telemetry_daily.sql (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 15.1). A merge applies it to
 * production before the Worker code (server first), so it must be additive: one new table, nothing else altered,
 * rewritten or dropped, and the table holds counts and codes only.
 */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');
const FILE = '0015_telemetry_daily.sql';
const statements = readFileSync(join(DIR, FILE), 'utf8')
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

describe('migration 0015_telemetry_daily.sql · production safety', () => {
  it('is the only migration with its number', () => {
    expect(readdirSync(DIR).filter((f) => f.startsWith('0015_'))).toEqual([FILE]);
  });

  it('creates exactly the section 15.1 table and nothing else', () => {
    expect(statements).toEqual([
      "CREATE TABLE IF NOT EXISTS telemetry_daily ( day TEXT NOT NULL, name TEXT NOT NULL, dims TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL DEFAULT 0 CHECK (n >= 0), PRIMARY KEY (day, name, dims) )",
    ]);
    expect(statements.join(' ')).not.toMatch(/\bALTER\b|\bDROP\b|\bUPDATE\b|\bDELETE FROM\b|\bINSERT\b/i);
    // No column can hold a person, a device or a fine time.
    expect(statements[0]).not.toMatch(/profile|device|account|learner|ip_|_at\b/i);
  });

  it('applies on a copy of the schema at the previous migration, twice without harm, and takes counts', async () => {
    const d1 = openSqliteD1({ before: FILE });
    await expect(d1.prepare('SELECT * FROM telemetry_daily').all()).rejects.toThrow(/telemetry_daily/);
    for (const st of statements) await d1.prepare(st).run();
    for (const st of statements) await d1.prepare(st).run();
    const db = new D1Db(d1);
    await db.addTelemetryDaily([{ day: '2026-10-21', name: 'who.shown', dims: '{"trigger":"launch"}', n: 1 }]);
    await db.addTelemetryDaily([{ day: '2026-10-21', name: 'who.shown', dims: '{"trigger":"launch"}', n: 1 }]);
    await db.addTelemetryDaily([{ day: '2026-10-21', name: 'session.start', dims: '', n: 1 }]);
    expect(await db.telemetryDailyOf('2026-10-21')).toEqual([
      { day: '2026-10-21', name: 'session.start', dims: '', n: 1 },
      { day: '2026-10-21', name: 'who.shown', dims: '{"trigger":"launch"}', n: 2 },
    ]);
    await expect(d1.prepare("INSERT INTO telemetry_daily (day, name, dims, n) VALUES ('2026-10-21', 'x', '', -1)").run()).rejects.toThrow(/CHECK/);
    expect(await d1.prepare("SELECT dims, n FROM telemetry_daily WHERE name = 'session.start'").first()).toEqual({ dims: '', n: 1 });
    d1.close();
  });

  it('one flush is one batch of multi-row upserts, 25 rows a statement, that add each n to the stored count', async () => {
    expect(TELEMETRY_DAILY_ROWS_PER_STATEMENT).toBe(25);
    const d1 = openSqliteD1();
    const batch = vi.spyOn(d1, 'batch');
    const db = new D1Db(d1);
    const rows = Array.from({ length: TELEMETRY_DAILY_WRITES_PER_MIN }, (_, i) => ({ day: '2026-10-21', name: 'who.picked', dims: `{"i":${i}}`, n: 2 }));
    await db.addTelemetryDaily(rows);
    expect(batch).toHaveBeenCalledTimes(1);
    // 600 rows are 24 statements: under the 50 a Free-plan invocation allows.
    expect(batch.mock.calls[0]?.[0]).toHaveLength(24);
    await db.addTelemetryDaily([{ day: '2026-10-21', name: 'who.picked', dims: '{"i":0}', n: 3 }, { day: '2026-10-21', name: 'session.start', dims: '', n: 1 }]);
    const stored = await db.telemetryDailyOf('2026-10-21');
    expect(stored).toHaveLength(601);
    expect(stored.find((r) => r.dims === '{"i":0}')).toEqual({ day: '2026-10-21', name: 'who.picked', dims: '{"i":0}', n: 5 });
    expect(stored.find((r) => r.dims === '{"i":599}')?.n).toBe(2);
    await db.addTelemetryDaily([]);
    expect(batch).toHaveBeenCalledTimes(2);
    d1.close();
  });

  it('the daily purge removes rows older than 400 days, at most 200 a round', async () => {
    const d1 = openSqliteD1();
    const db = new D1Db(d1);
    await db.addTelemetryDaily(Array.from({ length: 230 }, (_, i) => ({ day: '2025-01-01', name: 'who.picked', dims: `{"i":${i}}`, n: 1 })));
    await db.addTelemetryDaily([{ day: '2025-09-16', name: 'who.picked', dims: '', n: 1 }]);
    const out = await runScheduledPurge(db, new Date('2026-10-21T11:17:00.000Z'));
    expect(out).toMatchObject({ rounds: 2, telemetryDaily: 230 });
    expect(await db.telemetryDailyOf('2025-01-01')).toEqual([]);
    expect(await db.telemetryDailyOf('2025-09-16')).toEqual([{ day: '2025-09-16', name: 'who.picked', dims: '', n: 1 }]);
    d1.close();
  });

  it('a Worker that runs before the migration skips the count and the purge and keeps purging the rest', async () => {
    resetTelemetryDailyBudgetForTests();
    const d1 = openSqliteD1({ before: FILE });
    const db = new D1Db(d1);
    expect(await countTelemetryDaily(() => db, undefined, { name: 'who.picked', payload: { kind: 'add' }, at: '2026-10-21T00:00:00.000Z' }, Date.now())).toBe(0);
    expect(await runScheduledPurge(db, new Date())).toMatchObject({ rounds: 1, adminInvites: 0, telemetryDaily: 0 });
    d1.close();
  });
});
