import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db, type D1Like } from '../d1';

const insertAccount = (d1: D1Like, id: string) => d1.prepare('INSERT INTO accounts (id, created_at) VALUES (?, ?)').bind(id, '2026-10-11T00:00:00.000Z');
const countAccounts = async (d1: D1Like): Promise<number> => Number((await d1.prepare('SELECT COUNT(*) AS n FROM accounts').first<{ n: number }>())?.n);

/**
 * D1Db.reset lists the class-transfer tables (T-3a) ahead of the migration
 * that creates them (T-3b), so it clears them when they exist and skips them
 * when they do not.
 */
describe('D1Db.reset and the class-transfer tables', () => {
  const TRANSFER_TABLES = ['transfer_events', 'transfer_requests', 'learner_transfer_prefs', 'rate_hits'];

  it('works before the transfer tables exist', async () => {
    const d1 = openSqliteD1();
    await insertAccount(d1, 'acct-a').run();
    await new D1Db(d1).reset();
    expect(await countAccounts(d1)).toBe(0);
    d1.close();
  });

  it('clears them once they exist', async () => {
    const d1 = openSqliteD1();
    for (const table of TRANSFER_TABLES) {
      await d1.prepare(`CREATE TABLE ${table} (id TEXT PRIMARY KEY)`).run();
      await d1.prepare(`INSERT INTO ${table} (id) VALUES ('row-1')`).run();
    }
    await new D1Db(d1).reset();
    for (const table of TRANSFER_TABLES) {
      expect((await d1.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n, table).toBe(0);
    }
    d1.close();
  });
});
