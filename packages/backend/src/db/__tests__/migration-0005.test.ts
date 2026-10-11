import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import type { D1Like } from '../d1';

/**
 * Migration 0005_class_transfer.sql — F-SPACE-002 section 4.1 (PR T-3b). A
 * merge applies it to production before the Worker upload, so it must be
 * additive, re-runnable and invisible to the Worker that is live today.
 */
const file = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations/0005_class_transfer.sql');
const sql = readFileSync(file, 'utf8');
const code = sql
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n');
const statements = code
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);
const TABLES = ['transfer_requests', 'transfer_events', 'learner_transfer_prefs', 'rate_hits'];
const T = '2026-10-11T00:00:00.000Z';

async function seed(d1: D1Like): Promise<void> {
  await d1.prepare('INSERT INTO accounts (id, created_at) VALUES (?, ?)').bind('teacher', T).run();
  for (const id of ['space:a', 'space:b']) await d1.prepare("INSERT INTO spaces (id, kind, name, owner_account_id, created_at) VALUES (?, 'class', ?, 'teacher', ?)").bind(id, id, T).run();
  await d1.prepare("INSERT INTO learners (id, display_name, age_group, avatar, created_at, last_active_at) VALUES ('profile:suni', 'Suni', '8-9', 'x', ?, ?)").bind(T, T).run();
}
const insertRequest = (d1: D1Like, id: string, status: string, extra = '') =>
  d1
    .prepare(`INSERT INTO transfer_requests (id, learner_id, source_space_id, dest_space_id, initiator, status, created_at, updated_at, expires_at${extra ? `, ${extra.split('=')[0]}` : ''}) VALUES (?, 'profile:suni', 'space:a', 'space:b', 'source', ?, ?, ?, ?${extra ? `, '${extra.split('=')[1]}'` : ''})`)
    .bind(id, status, T, T, T)
    .run();
const count = async (d1: D1Like, table: string): Promise<number> => Number((await d1.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n);

describe('migration 0005_class_transfer.sql · production safety', () => {
  it('only creates new objects, each guarded with IF NOT EXISTS (additive and re-runnable)', () => {
    expect(statements.length).toBe(12);
    for (const st of statements) expect(st, st).toMatch(/^CREATE (UNIQUE )?(TABLE|INDEX) IF NOT EXISTS /);
    expect(code.replace(/ON DELETE CASCADE/g, '')).not.toMatch(/\b(DROP|ALTER|DELETE|UPDATE|INSERT|TRUNCATE|RENAME|REPLACE)\b/i);
  });

  it('touches only the four transfer tables', () => {
    for (const st of statements) {
      const target = st.match(/^CREATE (?:UNIQUE )?(?:TABLE IF NOT EXISTS (\w+)|INDEX IF NOT EXISTS \w+ ON (\w+))/);
      expect(TABLES, st).toContain(target?.[1] ?? target?.[2]);
    }
  });

  it('every reference to learners or spaces cascades on delete (an older deleteLearner relies on it)', () => {
    const refs = code.match(/REFERENCES (learners|spaces)\(id\)[^,\n]*/g) ?? [];
    expect(refs).toHaveLength(4);
    for (const ref of refs) expect(ref).toMatch(/ON DELETE CASCADE/);
  });

  it('runs a second time without error and keeps the rows', async () => {
    const d1 = openSqliteD1(); // applies 0001..0005 once
    await seed(d1);
    await insertRequest(d1, 'transfer:1', 'requested');
    for (const st of statements) await d1.prepare(st).run();
    expect(await count(d1, 'transfer_requests')).toBe(1);
    d1.close();
  });

  it('enforces one open request per learner with the partial unique index; ended rows do not count', async () => {
    const d1 = openSqliteD1();
    await seed(d1);
    await insertRequest(d1, 'transfer:1', 'requested');
    await expect(insertRequest(d1, 'transfer:2', 'requested')).rejects.toThrow(/UNIQUE/);
    await d1.prepare("UPDATE transfer_requests SET status = 'cancelled', end_reason = 'cancelled_initiator', ended_at = ? WHERE id = 'transfer:1'").bind(T).run();
    await insertRequest(d1, 'transfer:2', 'requested');
    expect(await count(d1, 'transfer_requests')).toBe(2);
    d1.close();
  });

  it('the CHECKs refuse an illegal state', async () => {
    const d1 = openSqliteD1();
    await seed(d1);
    await expect(insertRequest(d1, 'transfer:1', 'approved')).rejects.toThrow(/CHECK/); // slots pending
    await expect(insertRequest(d1, 'transfer:1', 'declined')).rejects.toThrow(/CHECK/); // no end reason
    await expect(insertRequest(d1, 'transfer:1', 'moved')).rejects.toThrow(/CHECK/);
    await expect(insertRequest(d1, 'transfer:1', 'requested', 'l_state=consented')).rejects.toThrow(/CHECK/); // consent without evidence
    await expect(insertRequest(d1, 'transfer:1', 'requested', 's_state=maybe')).rejects.toThrow(/CHECK/);
    await expect(insertRequest(d1, 'transfer:1', 'requested', 'end_actor=teacher')).rejects.toThrow(/CHECK/);
    expect(await count(d1, 'transfer_requests')).toBe(0);
    d1.close();
  });

  it("the Worker live today erases a learner with its own statements, and the new rows go with it (cascade)", async () => {
    const d1 = openSqliteD1();
    await seed(d1);
    await insertRequest(d1, 'transfer:1', 'requested');
    await d1.prepare("INSERT INTO transfer_events (transfer_id, at, actor_kind, event) VALUES ('transfer:1', ?, 'system', 'created')").bind(T).run();
    await d1.prepare("INSERT INTO learner_transfer_prefs (learner_id, self_managed, updated_at) VALUES ('profile:suni', 1, ?)").bind(T).run();
    // the deleteLearner of the deployed Worker (before PR T-3b), statement for statement
    for (const st of ["DELETE FROM memberships WHERE member_kind = 'learner' AND member_id = ?", 'DELETE FROM relink_requests WHERE learner_id = ?', 'DELETE FROM learner_devices WHERE learner_id = ?', 'DELETE FROM snapshots WHERE learner_id = ?', 'DELETE FROM learners WHERE id = ?']) {
      await d1.prepare(st).bind('profile:suni').run();
    }
    for (const table of ['transfer_requests', 'transfer_events', 'learner_transfer_prefs']) expect(await count(d1, table), table).toBe(0);
    d1.close();
  });
});
