import { describe, expect, expectTypeOf, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import type { D1Like, D1PreparedLike, D1RunResultLike } from '../d1';

const T = '2026-10-11T00:00:00.000Z';

const insertAccount = (d1: D1Like, id: string): D1PreparedLike => d1.prepare('INSERT INTO accounts (id, created_at) VALUES (?, ?)').bind(id, T);
const countAccounts = async (d1: D1Like): Promise<number> => Number((await d1.prepare('SELECT COUNT(*) AS n FROM accounts').first<{ n: number }>())?.n);

/**
 * D1Like.batch — F-SPACE-002 T-3a (section 4.6 plumbing). D1's native batch
 * runs its statements as one transaction and answers one result per
 * statement; the SQLite shim must behave the same, synchronously, so no
 * other query can interleave into the transaction.
 */
describe('D1Like.batch', () => {
  it("is satisfied by Cloudflare's D1Database binding", () => {
    expectTypeOf<D1Database>().toMatchTypeOf<D1Like>();
    expectTypeOf<D1Like['batch']>().returns.resolves.toEqualTypeOf<D1RunResultLike[]>();
  });

  describe('SQLite shim', () => {
    it('answers one result per statement with meta.changes, and a statement that changes 0 rows does not stop the batch', async () => {
      const d1 = openSqliteD1();
      const results = await d1.batch([
        insertAccount(d1, 'acct-a'),
        d1.prepare("UPDATE accounts SET display_name = 'x' WHERE id = ?").bind('nobody'),
        insertAccount(d1, 'acct-b'),
        d1.prepare('UPDATE accounts SET display_name = ? WHERE id IN (?, ?)').bind('Kim', 'acct-a', 'acct-b'),
      ]);
      expect(results.map((r) => r.meta?.changes)).toEqual([1, 0, 1, 2]);
      expect(await countAccounts(d1)).toBe(2);
      d1.close();
    });

    it('rolls every earlier write back when a later statement fails, and rejects', async () => {
      const d1 = openSqliteD1();
      await insertAccount(d1, 'acct-kept').run();
      await expect(
        d1.batch([
          insertAccount(d1, 'acct-a'),
          d1.prepare("UPDATE accounts SET display_name = 'changed' WHERE id = ?").bind('acct-kept'),
          insertAccount(d1, 'acct-kept'), // primary key violation
        ]),
      ).rejects.toThrow(/UNIQUE|PRIMARY KEY|constraint/i);
      expect(await countAccounts(d1)).toBe(1);
      expect(await d1.prepare('SELECT display_name FROM accounts WHERE id = ?').bind('acct-kept').first()).toEqual({ display_name: null });
      // The connection is usable afterwards: no transaction was left open.
      await d1.batch([insertAccount(d1, 'acct-after')]);
      expect(await countAccounts(d1)).toBe(2);
      d1.close();
    });

    it('rolls back on a CHECK violation in the last statement (the guard D1 enforces in the transfer swap)', async () => {
      const d1 = openSqliteD1();
      await insertAccount(d1, 'mom').run();
      await d1.prepare("INSERT INTO spaces (id, kind, name, owner_account_id, settings_json, created_at) VALUES ('space:f', 'family', 'F', 'mom', '{}', ?)").bind(T).run();
      await expect(
        d1.batch([
          insertAccount(d1, 'dad'),
          d1.prepare("INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at) VALUES ('space:f', 'account', 'dad', 'caregiver', ?)").bind(T),
          d1.prepare("INSERT INTO memberships (space_id, member_kind, member_id, role, joined_at) VALUES ('space:f', 'robot', 'x', 'caregiver', ?)").bind(T),
        ]),
      ).rejects.toThrow(/CHECK/i);
      expect(await countAccounts(d1)).toBe(1);
      expect((await d1.prepare('SELECT COUNT(*) AS n FROM memberships').first<{ n: number }>())?.n).toBe(0);
      d1.close();
    });

    it('runs every statement before the caller resumes: nothing can interleave', async () => {
      const d1 = openSqliteD1();
      const pending = d1.batch([insertAccount(d1, 'acct-a'), insertAccount(d1, 'acct-b')]);
      // No await yet: a query issued now already sees the whole batch.
      const seen = countAccounts(d1);
      expect(await seen).toBe(2);
      expect(await pending).toHaveLength(2);
      d1.close();
    });

    it('takes statements with or without bind, and an empty batch answers []', async () => {
      const d1 = openSqliteD1();
      expect(await d1.batch([])).toEqual([]);
      const [result] = await d1.batch([d1.prepare("INSERT INTO accounts (id, created_at) VALUES ('acct-unbound', '2026-10-11')")]);
      expect(result?.meta?.changes).toBe(1);
      d1.close();
    });

    it('refuses a statement that this connection did not prepare', async () => {
      const d1 = openSqliteD1();
      const other = openSqliteD1();
      await expect(d1.batch([insertAccount(other, 'acct-x')])).rejects.toThrow(/not prepared by this connection/);
      expect(await countAccounts(d1)).toBe(0);
      d1.close();
      other.close();
    });
  });
});
