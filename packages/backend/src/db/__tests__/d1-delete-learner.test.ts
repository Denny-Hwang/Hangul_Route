import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db, type D1Like } from '../d1';

const T = '2026-10-11T00:00:00.000Z';
const TRANSFER_TABLES = ['transfer_events', 'transfer_requests', 'learner_transfer_prefs', 'rate_hits'];
const count = async (d1: D1Like, table: string, where = ''): Promise<number> => Number((await d1.prepare(`SELECT COUNT(*) AS n FROM ${table} ${where}`).first<{ n: number }>())?.n);

async function seedLearner(d1: D1Like): Promise<void> {
  await d1.prepare('INSERT INTO accounts (id, created_at) VALUES (?, ?)').bind('teacher', T).run();
  for (const id of ['space:a', 'space:b']) await d1.prepare("INSERT INTO spaces (id, kind, name, owner_account_id, created_at) VALUES (?, 'class', ?, 'teacher', ?)").bind(id, id, T).run();
  for (const id of ['profile:suni', 'profile:other']) {
    await d1.prepare("INSERT INTO learners (id, display_name, age_group, avatar, created_at, last_active_at) VALUES (?, 'N', '8-9', 'x', ?, ?)").bind(id, T, T).run();
    await d1.prepare("INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at) VALUES ('space:a', 'learner', ?, 'student', ?)").bind(id, T).run();
  }
}

/**
 * D1Db.deleteLearner and migration 0005 (F-SPACE-002 T-3b). The erase is the
 * live caregiver route (privacy, COPPA), so it must keep working on a
 * database where 0005 has not landed yet: if the Worker were ever uploaded
 * before the migration ran, an erase naming the transfer tables would fail
 * with "no such table" and roll back.
 */
describe('D1Db.deleteLearner and the class-transfer tables', () => {
  it('erases the learner on a database without migration 0005', async () => {
    const d1 = openSqliteD1();
    for (const table of TRANSFER_TABLES) await d1.prepare(`DROP TABLE ${table}`).run();
    await seedLearner(d1);
    expect(await new D1Db(d1).deleteLearner('profile:suni')).toBe(true);
    expect(await count(d1, 'learners', "WHERE id = 'profile:suni'")).toBe(0);
    expect(await count(d1, 'memberships', "WHERE member_id = 'profile:suni'")).toBe(0);
    expect(await count(d1, 'learners')).toBe(1); // the other learner stays
    d1.close();
  });

  it('erases the learner when only some of the transfer tables exist', async () => {
    const d1 = openSqliteD1();
    await d1.prepare('DROP TABLE rate_hits').run();
    await seedLearner(d1);
    await d1.prepare("INSERT INTO learner_transfer_prefs (learner_id, updated_at) VALUES ('profile:suni', ?)").bind(T).run();
    expect(await new D1Db(d1).deleteLearner('profile:suni')).toBe(true);
    expect(await count(d1, 'learners', "WHERE id = 'profile:suni'")).toBe(0);
    expect(await count(d1, 'learner_transfer_prefs')).toBe(0);
    d1.close();
  });

  it('with the migration applied, also erases the learner-keyed rate counters and keeps everyone else', async () => {
    const d1 = openSqliteD1();
    await seedLearner(d1);
    for (const key of ['tcode:learner:profile:suni', 'tcreate:learner:profile:suni', 'tcode:learner:profile:other', 'tcode:acct:teacher']) await d1.prepare('INSERT INTO rate_hits (key, at) VALUES (?, ?)').bind(key, T).run();
    expect(await new D1Db(d1).deleteLearner('profile:suni')).toBe(true);
    expect(await count(d1, 'rate_hits')).toBe(2);
    expect(await new D1Db(d1).deleteLearner('profile:nobody')).toBe(false);
    d1.close();
  });
});
