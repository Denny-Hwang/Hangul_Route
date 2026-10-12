import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openSqliteD1 } from '../../__tests__/helpers/sqlite';
import { D1Db, type D1Like, type D1PreparedLike } from '../d1';

/**
 * Migration 0007_billing_events.sql (F-BILL-002 section 5.1). A merge applies it
 * to production before the Worker code (server first), so it must be additive:
 * one new table and three indexes, nothing existing is altered, rewritten or
 * dropped, and no receipt URL is ever stored.
 */
const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../apps/api/migrations');
const FILE = '0007_billing_events.sql';
const sql = readFileSync(join(DIR, FILE), 'utf8');
/** The statements with every `--` comment removed (whole-line and trailing), whitespace collapsed. */
const statements = sql
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const T = '2026-10-11T00:00:00.000Z';
type SqliteD1 = ReturnType<typeof openSqliteD1>;

async function seedEntitlement(d1: SqliteD1): Promise<void> {
  await d1
    .prepare('INSERT INTO entitlements (id, subject_kind, subject_id, plan_key, status, provider, provider_ref, customer_ref, seats, expires_at, promo_code, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind('ent:old', 'space', 'space:c', 'group_license', 'active', 'stripe', 'sub_1', 'cus_1', null, '2027-10-11T00:00:00.000Z', null, T)
    .run();
}

/**
 * The query plan of the statement a Db read really prepares: the connection is
 * wrapped to record the SQL and the bound values of the last read, so a change
 * to a WHERE or ORDER BY in d1.ts is what this plan sees (not a copy here).
 */
async function planOf(d1: SqliteD1, read: (db: D1Db) => Promise<unknown>): Promise<{ sql: string; plan: string }> {
  let last: { sql: string; params: unknown[] } | null = null;
  const recording: D1Like = {
    prepare(sql: string): D1PreparedLike {
      const stmt = d1.prepare(sql);
      const bind = stmt.bind.bind(stmt);
      stmt.bind = (...values: unknown[]) => {
        last = { sql, params: values };
        return bind(...values);
      };
      return stmt;
    },
    batch: (statements) => d1.batch(statements),
  };
  await read(new D1Db(recording));
  const seen = last as { sql: string; params: unknown[] } | null;
  if (!seen) throw new Error('the read prepared no statement');
  const { results } = await d1.prepare(`EXPLAIN QUERY PLAN ${seen.sql}`).bind(...seen.params).all<{ detail: string }>();
  return { sql: seen.sql, plan: results.map((r) => r.detail).join(' | ') };
}

describe('migration 0007_billing_events.sql · production safety', () => {
  it('is the only migration with its number', () => {
    expect(readdirSync(DIR).filter((f) => f.startsWith('0007_'))).toEqual([FILE]);
  });

  it('only creates the billing_events table and three indexes (additive: nothing altered, dropped or rewritten)', () => {
    expect(statements).toHaveLength(4);
    expect(statements[0]).toMatch(/^CREATE TABLE IF NOT EXISTS billing_events \(/);
    expect(statements.slice(1)).toEqual([
      'CREATE INDEX IF NOT EXISTS idx_billing_events_subject ON billing_events(subject_kind, subject_id, occurred_at)',
      'CREATE INDEX IF NOT EXISTS idx_billing_events_payment ON billing_events(payment_ref)',
      'CREATE INDEX IF NOT EXISTS idx_entitlements_provider_ref ON entitlements(provider, provider_ref)',
    ]);
    expect(statements.join(';')).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|RENAME|ALTER|REPLACE)\b/i);
  });

  it('stores no receipt URL, card, email, name or address', () => {
    expect(statements.join(';')).not.toMatch(/url|card|email|name|address/i);
  });

  it('applies on the database at the previous migration; existing entitlements read back unchanged', async () => {
    const d1 = openSqliteD1({ before: FILE });
    await seedEntitlement(d1);
    const before = await new D1Db(d1).entitlementsFor('space', 'space:c');
    await expect(d1.prepare('SELECT * FROM billing_events').all()).rejects.toThrow(/billing_events/);
    for (const st of statements) await d1.prepare(st).run();
    // Applying twice is harmless (IF NOT EXISTS), as a re-run deploy would.
    for (const st of statements) await d1.prepare(st).run();
    const db = new D1Db(d1);
    expect(await db.entitlementsFor('space', 'space:c')).toEqual(before);
    expect(await db.entitlementByProviderRef('stripe', 'sub_1')).toEqual(before[0]);
    d1.close();
  });

  it('creates the indexes, and the reads use them', async () => {
    const d1 = openSqliteD1();
    const { results } = await d1.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'").all<{ name: string }>();
    const names = results.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['idx_billing_events_subject', 'idx_billing_events_payment', 'idx_entitlements_provider_ref']));
    const subject = await planOf(d1, (db) => db.billingEventsFor('space', 'space:c', 3));
    expect(subject.sql).toMatch(/FROM billing_events WHERE subject_kind = \? AND subject_id = \?/);
    expect(subject.plan).toMatch(/idx_billing_events_subject/);
    const payment = await planOf(d1, (db) => db.billingEventByPaymentRef('pi_1'));
    expect(payment.sql).toMatch(/FROM billing_events WHERE payment_ref = \?/);
    expect(payment.plan).toMatch(/idx_billing_events_payment/);
    const entitlement = await planOf(d1, (db) => db.entitlementByProviderRef('stripe', 'sub_1'));
    expect(entitlement.sql).toMatch(/FROM entitlements WHERE provider = \? AND provider_ref = \?/);
    expect(entitlement.plan).toMatch(/idx_entitlements_provider_ref/);
    d1.close();
  });

  it('enforces the unique key and the column checks', async () => {
    const d1 = openSqliteD1();
    const insert = (id: string, over: Record<string, unknown> = {}) => {
      const row = { subject_kind: 'space', plan_key: 'family_lifetime', kind: 'purchase', amount_cents: 1530, provider: 'stripe', provider_ref: 'pi_1', ...over };
      return d1
        .prepare('INSERT INTO billing_events (id, subject_kind, subject_id, plan_key, kind, amount_cents, currency, provider, provider_ref, payment_ref, livemode, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, row.subject_kind, 'space:f', row.plan_key, row.kind, row.amount_cents, 'usd', row.provider, row.provider_ref, null, 0, T, T)
        .run();
    };
    await insert('bev:a');
    await expect(insert('bev:b')).rejects.toThrow(/UNIQUE/);
    await insert('bev:c', { kind: 'refund' }); // same ref, another kind
    await expect(insert('bev:d', { provider_ref: 'pi_2', kind: 'chargeback' })).rejects.toThrow(/CHECK/);
    await expect(insert('bev:e', { provider_ref: 'pi_3', amount_cents: -1 })).rejects.toThrow(/CHECK/);
    await expect(insert('bev:f', { provider_ref: 'pi_4', plan_key: 'teacher_pro' })).rejects.toThrow(/CHECK/);
    await expect(insert('bev:g', { provider_ref: 'pi_5', provider: 'paypal' })).rejects.toThrow(/CHECK/);
    await expect(insert('bev:h', { provider_ref: 'pi_6', subject_kind: 'learner' })).rejects.toThrow(/CHECK/);
    d1.close();
  });
});
