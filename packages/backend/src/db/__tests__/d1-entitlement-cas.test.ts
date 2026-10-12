import { describe, expect, it } from 'vitest';
import type { EntitlementApply } from '@hangul-route/content-schema';
import { D1Db, type D1Like, type D1PreparedLike } from '../d1';

const NOW = new Date('2026-10-11T00:00:00.000Z');
const END = '2027-10-11T00:00:00.000Z';
const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'ent:1',
  subject_kind: 'space',
  subject_id: 'space:fam',
  plan_key: 'family_lifetime',
  status: 'active',
  provider: 'stripe',
  provider_ref: 'sub_1',
  customer_ref: 'cus_1',
  seats: null,
  expires_at: END,
  promo_code: null,
  updated_at: '2026-10-10T00:00:00.000Z',
  ...over,
});
const completion: EntitlementApply = { subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime', status: 'active', provider: 'stripe', providerRef: 'sub_1', customerRef: 'cus_1', promoCode: 'HOYA20' };

/** A D1 whose reads answer `reads` in turn and whose writes answer `changes` in turn. */
function scripted(reads: Array<Record<string, unknown> | null>, changes: number[]): { d1: D1Like; sql: string[]; bound: unknown[][] } {
  const sql: string[] = [];
  const bound: unknown[][] = [];
  const d1: D1Like = {
    prepare(statement: string): D1PreparedLike {
      sql.push(statement);
      const prepared: D1PreparedLike = {
        bind(...values: unknown[]) {
          bound.push(values);
          return prepared;
        },
        first: async () => (reads.shift() ?? null) as never,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: changes.shift() ?? 0 } }) as never,
      };
      return prepared;
    },
    batch: async (statements) => Promise.all(statements.map((statement) => statement.run())),
  };
  return { d1, sql, bound };
}

/**
 * BY-D5: Stripe delivers `customer.subscription.created` and the checkout completion
 * together, so the row is written with a compare-and-set: a write that lost the race
 * reads again and merges onto the winner instead of overwriting it with a stale copy.
 */
describe('D1Db.applyEntitlement is a compare-and-set (BY-D5)', () => {
  it('inserts a new row with INSERT … DO NOTHING', async () => {
    const db = scripted([null], [1]);
    const e = await new D1Db(db.d1).applyEntitlement(completion, NOW, 'checkout');
    expect(e).toMatchObject({ status: 'active', providerRef: 'sub_1', expiresAt: null, promoCode: 'HOYA20' });
    expect(db.sql).toHaveLength(2);
    expect(db.sql[1]).toMatch(/^INSERT INTO entitlements .* ON CONFLICT\(subject_kind, subject_id, plan_key\) DO NOTHING$/);
  });

  it('updates an existing row only while every column still holds what was read', async () => {
    const db = scripted([row()], [1]);
    const e = await new D1Db(db.d1).applyEntitlement(completion, NOW, 'checkout');
    // The subscription event already set the end: the completion only fills the code.
    expect(e).toMatchObject({ id: 'ent:1', status: 'active', expiresAt: END, promoCode: 'HOYA20' });
    expect(db.sql[1]).toMatch(/^UPDATE entitlements SET .* WHERE id = \? AND status = \? AND provider = \? AND provider_ref IS \? AND customer_ref IS \? AND seats IS \? AND expires_at IS \? AND promo_code IS \? AND updated_at = \?$/);
    expect(db.bound[1]?.slice(-9)).toEqual(['ent:1', 'active', 'stripe', 'sub_1', 'cus_1', null, END, null, '2026-10-10T00:00:00.000Z']);
  });

  it('a lost race reads again and merges onto the row that won', async () => {
    // Read: no row. Insert: lost (the subscription event inserted first). Read again: its row. Update: won.
    const db = scripted([null, row({ promo_code: null })], [0, 1]);
    const e = await new D1Db(db.d1).applyEntitlement(completion, NOW, 'checkout');
    expect(e).toMatchObject({ id: 'ent:1', expiresAt: END, status: 'active', promoCode: 'HOYA20' });
    expect(db.sql.filter((s) => s.startsWith('SELECT'))).toHaveLength(2);
    expect(db.sql[3]).toMatch(/^UPDATE entitlements/);
  });

  it('writes nothing when the merge keeps the stored row (a superseded subscription)', async () => {
    const db = scripted([row({ provider_ref: 'sub_b' })], []);
    const deleted: EntitlementApply = { subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_lifetime', status: 'expired', provider: 'stripe', providerRef: 'sub_a', customerRef: 'cus_1', expiresAt: null };
    expect(await new D1Db(db.d1).applyEntitlement(deleted, NOW)).toMatchObject({ providerRef: 'sub_b', status: 'active', expiresAt: END });
    expect(db.sql).toHaveLength(1);
  });

  it('gives up after five lost races so Stripe retries the delivery', async () => {
    const db = scripted([row(), row(), row(), row(), row()], [0, 0, 0, 0, 0]);
    await expect(new D1Db(db.d1).applyEntitlement(completion, NOW, 'checkout')).rejects.toThrow(/entitlement_write_conflict/);
    expect(db.sql.filter((s) => s.startsWith('UPDATE'))).toHaveLength(5);
  });
});
