import { describe, expect, it, vi } from 'vitest';
import { MemoryDb } from '../../db/memory';
import { durableRateKey, peekDurableLimit, takeDurableHit, type DurableLimit } from '../durable-rate-limit';

/** [AU] AMENDMENTS-AUDIT-2026-11 AU-16 (audit SEC-5): per-client limits counted in `rate_hits`. */
const RULE: DurableLimit = { name: 'claim', limit: 2, windowMs: 60_000 };
const T0 = Date.parse('2026-11-15T10:00:00.000Z');
const at = (ms: number) => new Date(T0 + ms);

describe('durableRateKey', () => {
  it('is `rl:<name>:<32 hex>` and never holds the client address', async () => {
    const key = await durableRateKey(RULE, '203.0.113.4', undefined);
    expect(key).toMatch(/^rl:claim:[0-9a-f]{32}$/);
    expect(key).not.toContain('203.0.113.4');
  });

  it('is stable for one client and limit, and differs by client, by limit and by pepper', async () => {
    const key = await durableRateKey(RULE, '203.0.113.4', undefined);
    expect(await durableRateKey(RULE, '203.0.113.4', undefined)).toBe(key);
    expect(await durableRateKey(RULE, '203.0.113.5', undefined)).not.toBe(key);
    expect(await durableRateKey({ ...RULE, name: 'lookup' }, '203.0.113.4', undefined)).not.toBe(key.replace('claim', 'lookup'));
    const peppered = await durableRateKey(RULE, '203.0.113.4', 'a-secret');
    expect(peppered).toMatch(/^rl:claim:[0-9a-f]{32}$/);
    expect(peppered).not.toBe(key);
    expect(await durableRateKey(RULE, '203.0.113.4', 'another-secret')).not.toBe(peppered);
  });
});

describe('takeDurableHit', () => {
  it('allows up to the limit in the window, then blocks with the seconds until the oldest hit leaves it', async () => {
    const db = new MemoryDb();
    expect(await takeDurableHit(db, RULE, 'k', at(0))).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(await takeDurableHit(db, RULE, 'k', at(10_000))).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(await takeDurableHit(db, RULE, 'k', at(20_000))).toEqual({ allowed: false, retryAfterSeconds: 40 });
    expect(await takeDurableHit(db, RULE, 'k', at(59_001))).toEqual({ allowed: false, retryAfterSeconds: 1 });
    // A blocked attempt wrote nothing, and another key has its own count.
    expect(await db.countRateHits('k', at(-60_000))).toBe(2);
    expect((await takeDurableHit(db, RULE, 'other', at(20_000))).allowed).toBe(true);
  });

  it('opens again once the oldest hit has left the window', async () => {
    const db = new MemoryDb();
    await takeDurableHit(db, RULE, 'k', at(0));
    await takeDurableHit(db, RULE, 'k', at(10_000));
    expect((await takeDurableHit(db, RULE, 'k', at(60_001))).allowed).toBe(true);
    expect(await takeDurableHit(db, RULE, 'k', at(60_002))).toEqual({ allowed: false, retryAfterSeconds: 10 });
  });

  it('answers at least one second when the window emptied between the two reads', async () => {
    const db = new MemoryDb();
    vi.spyOn(db, 'takeRateHit').mockResolvedValue(false);
    expect(await takeDurableHit(db, RULE, 'k', at(0))).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('uses the current time by default', async () => {
    const db = new MemoryDb();
    expect((await takeDurableHit(db, RULE, 'k')).allowed).toBe(true);
    expect(await db.countRateHits('k', new Date(Date.now() - 5_000))).toBe(1);
  });
});

describe('peekDurableLimit', () => {
  it('reads the limit without counting: only recorded failures fill it', async () => {
    const db = new MemoryDb();
    for (let i = 0; i < 5; i += 1) expect(await peekDurableLimit(db, RULE, 'k', at(i))).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(await db.countRateHits('k', at(-60_000))).toBe(0);
    await db.recordRateHit('k', at(0));
    expect((await peekDurableLimit(db, RULE, 'k', at(1_000))).allowed).toBe(true);
    await db.recordRateHit('k', at(5_000));
    expect(await peekDurableLimit(db, RULE, 'k', at(30_000))).toEqual({ allowed: false, retryAfterSeconds: 30 });
    expect((await peekDurableLimit(db, RULE, 'k', at(60_001))).allowed).toBe(true);
  });

  it('uses the current time by default', async () => {
    const db = new MemoryDb();
    expect((await peekDurableLimit(db, RULE, 'k')).allowed).toBe(true);
  });
});
