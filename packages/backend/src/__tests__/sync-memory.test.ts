import { MEMORY_PUSH_MAX_BYTES, MEMORY_PUSH_MAX_SHARDS, MEMORY_PUSH_MAX_STATES, MemoryPullSchema, type MemoryItemState } from '@hangul-route/content-schema/memory';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D1Db } from '../db';
import app from '../index';
import { hashSecret } from '../lib/device-auth';
import { claimLimiter } from '../routes/recovery';
import { testDb as db } from './helpers/db';
import { openSqliteD1 } from './helpers/sqlite';

/*
 * F-CURR-002 section 4.8 and section 14 "Worker" (row CM-11, Worker first): the memory routes take
 * full-scope devices only, cap a call at 500 states and 64 KB, merge last-writer-wins with the
 * tie-break plus OR and max, page by the server's seq, and write at most one row per touched shard.
 */

const SUNI = 'profile:suni';
const PHONE = 'device-phone-aaaa';
const TABLET = 'device-tablet-bbb';
const LAPTOP = 'device-laptop-ccc';
const CLASS_TABLET = 'device-class-dddd';
const CLASS_SECRET = 'c'.repeat(64);
const json = { 'content-type': 'application/json' };
const NOW = new Date('2026-10-22T12:00:00.000Z');
const RECOGNIZE = 1;
const READ = 2;
const PRODUCE = 4;

const state = (over: Partial<MemoryItemState> = {}): MemoryItemState => ({
  b: 3,
  d: '2026-10-25',
  c: 2,
  r: RECOGNIZE | READ,
  n: 4,
  f: '2026-10-01',
  s: 3,
  at: '2026-10-22T10:00:00.000Z',
  ...over,
});

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; details?: Record<string, unknown> } };
type Auth = Record<string, string>;

async function register(deviceId: string, learnerId = SUNI): Promise<Auth> {
  const res = await app.request('/api/sync/learners', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ deviceId, learner: { id: learnerId, displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange' } }),
  });
  const body = (await res.json()) as { data: { device: { secret: string } } };
  return { ...json, authorization: `Device ${deviceId}:${body.data.device.secret}` };
}

/** A second device of the same learner, bound full scope directly (as a claim or a relink would). */
async function bind(deviceId: string, scope: 'full' | 'class', secret = `${deviceId}-secret`.padEnd(64, 'x')): Promise<Auth> {
  await db.putDevice({ learnerId: SUNI, deviceId, secretHash: await hashSecret(secret), scope, createdAt: NOW.toISOString(), lastSeenAt: NOW.toISOString() });
  return { ...json, authorization: `Device ${deviceId}:${secret}` };
}

async function push(auth: Auth, shards: unknown, learnerId = SUNI, env?: Record<string, unknown>) {
  const res = await app.request(`/api/sync/learners/${learnerId}/memory`, { method: 'POST', headers: auth, body: typeof shards === 'string' ? shards : JSON.stringify({ shards }) }, env);
  return { status: res.status, body: (await res.json()) as Envelope };
}

async function pull(auth: Auth, since?: number | string, learnerId = SUNI, env?: Record<string, unknown>) {
  const query = since === undefined ? '' : `?since=${since}`;
  const res = await app.request(`/api/sync/learners/${learnerId}/memory${query}`, { headers: auth }, env);
  const body = (await res.json()) as Envelope;
  return { status: res.status, body, headers: res.headers, pull: res.status === 200 ? MemoryPullSchema.parse(body.data) : null };
}

/** `count` distinct, valid item ids. */
const items = (count: number, over: Partial<MemoryItemState> = {}): Record<string, MemoryItemState> =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`lex:w${i}`, state(over)]));

describe('/api/sync/learners/:id/memory (F-CURR-002 section 4.8, Worker first)', () => {
  let phone: Auth;
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    await db.reset();
    claimLimiter.reset();
    phone = await register(PHONE);
  });
  afterEach(() => vi.useRealTimers());

  describe('auth: full scope only (SEC-4)', () => {
    it('a class-scoped device gets 403 scope_limited on both routes and nothing is stored', async () => {
      const tablet = await bind(CLASS_TABLET, 'class', CLASS_SECRET);
      const pushed = await push(tablet, { stage2: { 'lex:sagwa': state() } });
      expect([pushed.status, pushed.body.error?.code]).toEqual([403, 'scope_limited']);
      const pulled = await pull(tablet, 0);
      expect([pulled.status, pulled.body.error?.code]).toEqual([403, 'scope_limited']);
      expect(await db.memoryShardsSince(SUNI, 0)).toEqual([]);
    });

    it('no credentials is 401, another learner is 404, a device of another learner is 403', async () => {
      expect((await push(json, { stage2: {} })).status).toBe(401);
      expect((await pull(json)).status).toBe(401);
      expect((await push(phone, { stage2: {} }, 'profile:nobody')).status).toBe(404);
      const jun = await register('device-jun-eeeee', 'profile:jun');
      expect((await push(jun, { stage2: {} })).status).toBe(403);
      expect((await pull(jun, 0)).status).toBe(403);
    });
  });

  describe('caps: 500 states and 64 KB a call, else 413', () => {
    it('500 states are taken in one call; 501 states answer 413 with the caps and store nothing', async () => {
      const ok = await push(phone, { stage2: items(MEMORY_PUSH_MAX_STATES) });
      expect(ok.status).toBe(200);
      expect(ok.body.data).toEqual({ stored: 500, seeded: 0, written: 1 });
      await db.reset();
      phone = await register(PHONE);
      const over = { stage2: items(300), stage3: items(201) };
      expect(JSON.stringify({ shards: over }).length).toBeLessThan(MEMORY_PUSH_MAX_BYTES);
      const r = await push(phone, over);
      expect([r.status, r.body.error?.code]).toEqual([413, 'payload_too_large']);
      expect(r.body.error?.details).toEqual({ maxStates: 500, maxBytes: 65_536, maxShards: MEMORY_PUSH_MAX_SHARDS });
      expect(await db.memoryShardsSince(SUNI, 0)).toEqual([]);
    });

    it('501 states answer 413 even when the states do not parse', async () => {
      const junk = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`k${i}`, 1]));
      expect((await push(phone, { stage2: junk })).status).toBe(413);
    });

    it('a body over 64 KB answers 413, by its bytes or by its declared length, whatever it holds', async () => {
      const padded = JSON.stringify({ shards: { stage2: { 'lex:sagwa': state() } }, pad: 'x'.repeat(MEMORY_PUSH_MAX_BYTES) });
      expect((await push(phone, padded)).status).toBe(413);
      // Multi-byte text: the cap is bytes, not characters.
      const wide = JSON.stringify({ shards: {}, pad: '가'.repeat(Math.ceil(MEMORY_PUSH_MAX_BYTES / 3) + 10) });
      expect(wide.length).toBeLessThan(MEMORY_PUSH_MAX_BYTES);
      expect((await push(phone, wide)).status).toBe(413);
      const declared = await app.request(`/api/sync/learners/${SUNI}/memory`, { method: 'POST', headers: { ...phone, 'content-length': String(MEMORY_PUSH_MAX_BYTES + 1) }, body: '{}' });
      expect(declared.status).toBe(413);
    });

    it('a chunked body with no declared length is read only up to the cap, then answers 413', async () => {
      let chunks = 0;
      const chunk = new TextEncoder().encode('x'.repeat(16 * 1024));
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          chunks += 1;
          if (chunks > 40) controller.close();
          else controller.enqueue(chunk);
        },
      });
      const res = await app.request(`/api/sync/learners/${SUNI}/memory`, { method: 'POST', headers: phone, body, duplex: 'half' } as RequestInit);
      expect(res.status).toBe(413);
      // 64 KB is four chunks; the fifth passes the cap and the read stops there (a stream may pull one ahead).
      expect(chunks).toBeLessThanOrEqual(6);
    });

    it('more shards than the cap answer 413', async () => {
      const shards = Object.fromEntries(Array.from({ length: MEMORY_PUSH_MAX_SHARDS + 1 }, (_, i) => [`pack:p${i}`, { 'lex:sagwa': state() }]));
      expect((await push(phone, shards)).status).toBe(413);
    });

    it('a malformed body is 422 with issue paths and codes only; a bad cursor is 422', async () => {
      for (const body of ['not json', JSON.stringify({}), JSON.stringify({ shards: { stage9: {} } }), JSON.stringify({ shards: { stage2: { 'lex:sagwa': { ...state(), b: 9 } } } })]) {
        const r = await push(phone, body);
        expect([r.status, r.body.error?.code], body).toEqual([422, 'bad_request']);
      }
      const r = await push(phone, { stage2: { 'lex:sagwa': { ...state(), at: 'yesterday' } } });
      expect(JSON.stringify(r.body.error?.details)).not.toContain('yesterday');
      for (const since of ['-1', 'abc', '1.5']) expect((await pull(phone, since)).status).toBe(422);
    });
  });

  describe('push and pull', () => {
    it('round trip: the pull returns whole shards with their seq, and the cursor; no-store', async () => {
      const r = await push(phone, { stage2: { 'lex:sagwa': state() }, week: { 'lex:chuseok': state({ b: 1 }) } });
      expect(r.body.data).toEqual({ stored: 2, seeded: 0, written: 2 });
      const got = await pull(phone);
      expect(got.status).toBe(200);
      expect(got.headers.get('cache-control')).toBe('no-store');
      expect(got.body.ok).toBe(true);
      expect(got.pull).toEqual({
        cursor: 2,
        shards: [
          { shard: 'stage2', seq: 1, states: { 'lex:sagwa': state() } },
          { shard: 'week', seq: 2, states: { 'lex:chuseok': state({ b: 1 }) } },
        ],
      });
      expect((await pull(phone, 2)).pull).toEqual({ cursor: 2, shards: [] });
    });

    it('seeded states (n = 0) are never stored', async () => {
      const r = await push(phone, { stage1: { 'sym:bieup': state({ n: 0 }) }, stage2: { 'lex:sagwa': state({ n: 0 }), 'lex:bae~pear': state({ n: 1 }) } });
      expect(r.body.data).toEqual({ stored: 1, seeded: 2, written: 1 });
      expect((await pull(phone, 0)).pull?.shards).toEqual([{ shard: 'stage2', seq: 1, states: { 'lex:bae~pear': state({ n: 1 }) } }]);
      // A seeded state never lowers or replaces a stored answer either.
      await push(phone, { stage2: { 'lex:bae~pear': state({ n: 0, b: 0, at: '2026-10-22T11:00:00.000Z' }) } });
      expect((await pull(phone, 0)).pull?.shards[0]?.states['lex:bae~pear']).toEqual(state({ n: 1 }));
    });

    it('last writer wins on at for b, d and c; equal at takes the higher box; r is OR and n, s are max', async () => {
      const tablet = await bind(TABLET, 'full');
      await push(phone, { stage2: { 'lex:sagwa': state({ b: 5, d: '2026-11-10', c: 3, r: RECOGNIZE | PRODUCE, n: 9, s: 5, at: '2026-10-22T09:00:00.000Z' }) } });
      await push(tablet, { stage2: { 'lex:sagwa': state({ b: 2, d: '2026-10-23', c: 1, r: READ, n: 3, s: 2, at: '2026-10-22T10:00:00.000Z' }) } });
      expect((await pull(phone, 0)).pull?.shards[0]?.states['lex:sagwa']).toEqual(state({ b: 2, d: '2026-10-23', c: 1, r: RECOGNIZE | READ | PRODUCE, n: 9, s: 5, at: '2026-10-22T10:00:00.000Z' }));
      // Equal at: the higher box, then the later due day, then the higher rung.
      const t = '2026-10-22T11:00:00.000Z';
      await push(phone, { stage2: { 'lex:bae~pear': state({ b: 3, d: '2026-10-30', at: t }) } });
      await push(tablet, { stage2: { 'lex:bae~pear': state({ b: 4, d: '2026-10-24', at: t }) } });
      await push(phone, { stage2: { 'lex:bae~pear': state({ b: 4, d: '2026-10-26', c: 1, at: t }) } });
      expect((await pull(tablet, 0)).pull?.shards[0]?.states['lex:bae~pear']).toMatchObject({ b: 4, d: '2026-10-26', c: 1 });
    });

    it('a produce miss on device A (c falls, r keeps the produce bit) merged with an older state on device B', async () => {
      const tablet = await bind(TABLET, 'full');
      // A answers first with the miss; B's older state (box 4, produce next) arrives later from an offline queue.
      const miss = state({ b: 3, d: '2026-10-23', c: 2, r: RECOGNIZE | READ | PRODUCE, n: 7, s: 4, at: '2026-10-22T10:00:00.000Z' });
      const older = state({ b: 4, d: '2026-10-22', c: 3, r: RECOGNIZE | READ | PRODUCE, n: 6, s: 4, at: '2026-10-15T10:00:00.000Z' });
      await push(phone, { stage2: { 'lex:sagwa': miss } });
      await push(tablet, { stage2: { 'lex:sagwa': older } });
      expect((await pull(tablet, 0)).pull?.shards[0]?.states['lex:sagwa']).toEqual(miss);
    });

    it('a far-future at from a wrong device clock does not beat a later real answer from another device (section 13)', async () => {
      const tablet = await bind(TABLET, 'full');
      const wrong = state({ b: 7, d: '2030-01-10', c: 3, r: RECOGNIZE, n: 2, s: 7, at: '2030-01-01T00:00:00.000Z' });
      await push(phone, { stage2: { 'lex:sagwa': wrong } });
      // Nothing stored yet: the far-future at is read as the Worker's now.
      expect((await pull(tablet, 0)).pull?.shards[0]?.states['lex:sagwa']).toEqual({ ...wrong, at: NOW.toISOString() });
      vi.setSystemTime(new Date('2026-10-22T13:00:00.000Z'));
      const real = state({ b: 2, d: '2026-10-23', c: 1, r: READ, n: 3, s: 2, at: '2026-10-22T12:30:00.000Z' });
      await push(tablet, { stage2: { 'lex:sagwa': real } });
      // The wrong clock sends its state again on its next sync: the stored schedule is kept, the grow-only fields still merge.
      await push(phone, { stage2: { 'lex:sagwa': wrong } });
      expect((await pull(phone, 0)).pull?.shards[0]?.states['lex:sagwa']).toEqual({ ...real, r: RECOGNIZE | READ, n: 3, s: 7 });
    });

    it('seq paging: a late upload with an old at still reaches every other device, and a cursor never skips a write', async () => {
      const tablet = await bind(TABLET, 'full');
      const laptop = await bind(LAPTOP, 'full');
      await push(phone, { stage2: { 'lex:sagwa': state({ b: 4, at: '2026-10-22T10:00:00.000Z' }) } });
      const first = await pull(tablet, 0);
      expect(first.pull?.cursor).toBe(1);
      // The laptop was offline for a week: its states carry an old at, and one touches a new shard.
      await push(laptop, { stage2: { 'lex:bae~pear': state({ at: '2026-10-15T08:00:00.000Z' }) }, stage3: { 'pat:n-juseyo': state({ at: '2026-10-15T08:00:00.000Z' }) } });
      const next = await pull(tablet, first.pull?.cursor);
      expect(next.pull?.shards.map((s) => [s.shard, s.seq])).toEqual([
        ['stage2', 2],
        ['stage3', 3],
      ]);
      expect(next.pull?.cursor).toBe(3);
      // The old at reached the tablet without beating the newer state it met.
      expect(next.pull?.shards[0]?.states).toEqual({ 'lex:bae~pear': state({ at: '2026-10-15T08:00:00.000Z' }), 'lex:sagwa': state({ b: 4, at: '2026-10-22T10:00:00.000Z' }) });
      expect((await pull(tablet, 3)).pull?.shards).toEqual([]);
    });

    it('a cursor past the highest seq (an older server copy) reads from the start', async () => {
      await push(phone, { stage2: { 'lex:sagwa': state() } });
      const got = await pull(phone, 40);
      expect(got.pull?.cursor).toBe(1);
      expect(got.pull?.shards.map((s) => s.shard)).toEqual(['stage2']);
      await db.reset();
      phone = await register(PHONE);
      expect((await pull(phone, 9)).pull).toEqual({ cursor: 0, shards: [] });
    });

    it('rows written per call: only the touched shards, none for a merge that changes nothing; untouched shards keep their seq', async () => {
      await push(phone, { stage1: items(3), stage2: items(3), stage3: items(3), week: items(3) });
      const before = await db.memoryShardsSince(SUNI, 0);
      const r = await push(phone, { stage2: { 'lex:new': state() }, week: { 'lex:w0': state({ at: '2026-10-22T11:00:00.000Z' }) } });
      expect(r.body.data).toMatchObject({ written: 2 });
      const after = await db.memoryShardsSince(SUNI, 0);
      const seqOf = (rows: typeof after, shard: string) => rows.find((x) => x.shard === shard)?.seq;
      for (const untouched of ['stage1', 'stage3']) expect(seqOf(after, untouched)).toBe(seqOf(before, untouched));
      expect(seqOf(after, 'stage2')).toBe(5);
      expect(seqOf(after, 'week')).toBe(6);
      // The same call again changes nothing, so it writes no row and the cursor stays.
      const again = await push(phone, { stage2: { 'lex:new': state() }, week: { 'lex:w0': state({ at: '2026-10-22T11:00:00.000Z' }) } });
      expect(again.body.data).toEqual({ stored: 2, seeded: 0, written: 0 });
      expect(await db.memoryHighestSeq(SUNI)).toBe(6);
    });
  });

  describe('Rescue Code (F-RESTORE-001)', () => {
    it('a claimed device pulls the shards through the GET route; a learner with none gets an empty pull', async () => {
      const issued = await app.request('/api/recovery/issue', { method: 'POST', headers: phone, body: JSON.stringify({ learnerId: SUNI }) });
      const code = ((await issued.json()) as { data: { code: string } }).data.code;
      const claim = async (deviceId: string): Promise<Auth> => {
        const res = await app.request('/api/recovery/claim', { method: 'POST', headers: json, body: JSON.stringify({ code, deviceId }) });
        expect(res.status).toBe(200);
        const data = ((await res.json()) as { data: { device: { secret: string } } }).data;
        return { ...json, authorization: `Device ${deviceId}:${data.device.secret}` };
      };
      // Without any memory: the claim works as before and the pull is empty.
      expect((await pull(await claim(TABLET), 0)).pull).toEqual({ cursor: 0, shards: [] });
      await push(phone, { stage2: { 'lex:sagwa': state() }, 'pack:numbers-time': { 'rea:price-won': state({ b: 1 }) } });
      const laptop = await claim(LAPTOP);
      expect((await pull(laptop, 0)).pull?.shards.map((s) => [s.shard, s.states])).toEqual([
        // Written in shard order, so the pack has the lower seq.
        ['pack:numbers-time', { 'rea:price-won': state({ b: 1 }) }],
        ['stage2', { 'lex:sagwa': state() }],
      ]);
      // A class-approved binding the claim widens to full scope reads them too.
      await bind(CLASS_TABLET, 'class', CLASS_SECRET);
      expect((await pull(await claim(CLASS_TABLET), 0)).status).toBe(200);
    });
  });

  describe('a Worker ahead of migration 0016', () => {
    it('answers both memory routes 503 memory_unavailable; the snapshot route is unchanged', async () => {
      const d1 = openSqliteD1({ before: '0016_memory_shards.sql' });
      const old = new D1Db(d1);
      await old.putLearner({ id: SUNI, displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: NOW.toISOString(), lastActiveAt: NOW.toISOString(), profileUpdatedAt: null });
      const secret = 'f'.repeat(64);
      await old.putDevice({ learnerId: SUNI, deviceId: PHONE, secretHash: await hashSecret(secret), scope: 'full', createdAt: NOW.toISOString(), lastSeenAt: NOW.toISOString() });
      const auth = { ...json, authorization: `Device ${PHONE}:${secret}` };
      const env = { DB: d1 };
      const pushed = await push(auth, { stage2: { 'lex:sagwa': state() } }, SUNI, env);
      expect([pushed.status, pushed.body.error?.code]).toEqual([503, 'memory_unavailable']);
      const pulled = await pull(auth, 0, SUNI, env);
      expect([pulled.status, pulled.body.error?.code]).toEqual([503, 'memory_unavailable']);
      const snapshot = await app.request(`/api/sync/learners/${SUNI}/snapshot`, { headers: auth }, env);
      expect(snapshot.status).toBe(404);
      d1.close();
    });
  });
});
