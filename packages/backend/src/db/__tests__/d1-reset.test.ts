import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db, type D1Like } from '../d1';

const T = '2026-10-11T00:00:00.000Z';
const insertAccount = (d1: D1Like, id: string) => d1.prepare('INSERT INTO accounts (id, created_at) VALUES (?, ?)').bind(id, T);
const count = async (d1: D1Like, table: string): Promise<number> => Number((await d1.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n);
const TRANSFER_TABLES = ['transfer_events', 'transfer_requests', 'learner_transfer_prefs', 'rate_hits'];

/**
 * D1Db.reset and the class-transfer tables of migration 0005 (F-SPACE-002
 * T-3a / T-3b): it clears them, children first, and skips a table that a
 * database without the migration does not have.
 */
describe('D1Db.reset and the class-transfer tables', () => {
  it('works on a database without the transfer tables', async () => {
    const d1 = openSqliteD1();
    for (const table of TRANSFER_TABLES) await d1.prepare(`DROP TABLE ${table}`).run();
    await insertAccount(d1, 'acct-a').run();
    await new D1Db(d1).reset();
    expect(await count(d1, 'accounts')).toBe(0);
    d1.close();
  });

  it('clears them, children before parents', async () => {
    const d1 = openSqliteD1();
    await insertAccount(d1, 'teacher').run();
    for (const id of ['space:a', 'space:b']) await d1.prepare("INSERT INTO spaces (id, kind, name, owner_account_id, created_at) VALUES (?, 'class', ?, 'teacher', ?)").bind(id, id, T).run();
    await d1.prepare("INSERT INTO learners (id, display_name, age_group, avatar, created_at, last_active_at) VALUES ('profile:a', 'A', '8-9', 'x', ?, ?)").bind(T, T).run();
    await d1.prepare("INSERT INTO transfer_requests (id, learner_id, source_space_id, dest_space_id, initiator, status, created_at, updated_at, expires_at) VALUES ('transfer:1', 'profile:a', 'space:a', 'space:b', 'source', 'requested', ?, ?, ?)").bind(T, T, T).run();
    await d1.prepare("INSERT INTO transfer_events (transfer_id, at, actor_kind, event) VALUES ('transfer:1', ?, 'system', 'created')").bind(T).run();
    await d1.prepare("INSERT INTO learner_transfer_prefs (learner_id, updated_at) VALUES ('profile:a', ?)").bind(T).run();
    await d1.prepare("INSERT INTO rate_hits (key, at) VALUES ('tcode:acct:teacher', ?)").bind(T).run();
    await new D1Db(d1).reset();
    for (const table of [...TRANSFER_TABLES, 'learners', 'spaces', 'accounts']) expect(await count(d1, table), table).toBe(0);
    d1.close();
  });
});

describe('D1Db.reset and the notes tables (F-FEEDBACK-001 FB-2)', () => {
  it('works on a database without migration 0008', async () => {
    const d1 = openSqliteD1();
    for (const table of ['feedback_reports', 'feedback_notes', 'learner_note_prefs', 'feedback_sender_blocks', 'feedback_send_grants', 'feedback_sender_holds']) await d1.prepare(`DROP TABLE ${table}`).run();
    await insertAccount(d1, 'acct-a').run();
    await new D1Db(d1).reset();
    expect(await count(d1, 'accounts')).toBe(0);
    d1.close();
  });
});
