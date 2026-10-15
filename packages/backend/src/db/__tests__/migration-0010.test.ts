import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db } from '../d1';

/**
 * Migration 0010_learner_profile_updated_at.sql. A merge applies it to production before the Worker code
 * (server first), so it must be additive: one nullable column on learners, nothing else altered, rewritten or
 * dropped, and the Worker before it keeps reading and writing learners.
 */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');
const FILE = '0010_learner_profile_updated_at.sql';
const statements = readFileSync(join(DIR, FILE), 'utf8')
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);
const T = '2026-10-07T00:00:00.000Z';
const row = { id: 'profile:suni', displayName: 'test', ageGroup: '5-7' as const, avatar: 'hoya-orange', recoveryHash: 'hash-1', createdAt: T, lastActiveAt: T };

describe('migration 0010_learner_profile_updated_at.sql · production safety', () => {
  it('is the only migration with its number', () => {
    expect(readdirSync(DIR).filter((f) => f.startsWith('0010_'))).toEqual([FILE]);
  });

  it('adds one nullable column and nothing else', () => {
    expect(statements).toEqual(['ALTER TABLE learners ADD COLUMN profile_updated_at TEXT NULL']);
  });

  it('applies on the database at the previous migration; existing rows read back unchanged with a null edit time', async () => {
    const d1 = openSqliteD1({ before: FILE });
    await new D1Db(d1).putLearner(row);
    await expect(d1.prepare('SELECT profile_updated_at FROM learners').all()).rejects.toThrow(/profile_updated_at/);
    for (const st of statements) await d1.prepare(st).run();
    const after = new D1Db(d1);
    expect(await after.getLearner(row.id)).toEqual({ ...row, profileUpdatedAt: null });
    // the whole-row upsert of the Worker before this one still works next to the new column
    await after.putLearner({ ...row, lastActiveAt: '2026-10-08T00:00:00.000Z' });
    expect(await after.updateLearnerProfile(row.id, { displayName: 'Sungjoo' }, '2026-10-09T00:00:00.000Z')).toBe(true);
    expect(await after.getLearner(row.id)).toEqual({ ...row, displayName: 'Sungjoo', lastActiveAt: '2026-10-08T00:00:00.000Z', profileUpdatedAt: '2026-10-09T00:00:00.000Z' });
    d1.close();
  });

  it('reads a row from a database without the column (a Worker deployed before the migration) as never edited', async () => {
    const d1 = openSqliteD1({ before: FILE });
    const db = new D1Db(d1);
    await db.putLearner(row);
    expect((await db.getLearner(row.id))?.profileUpdatedAt).toBeNull();
    d1.close();
  });
});
