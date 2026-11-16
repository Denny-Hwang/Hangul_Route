import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { durableRateKey } from '../lib/durable-rate-limit';
import { CLAIM_LIMIT, CLAIM_RATE, CLAIM_WINDOW_MS } from '../routes/recovery';
import { RELINK_LIMIT, RELINK_RATE } from '../routes/relink';
import { JOIN_FAIL_RATE, LOOKUP_LIMIT, LOOKUP_RATE, LOOKUP_WINDOW_MS } from '../routes/spaces';
import { testDb as db } from './helpers/db';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-16 (audit SEC-5): the limits on Rescue Code claim, join-code lookup, join and
 * re-link count in the D1 table `rate_hits`, not in the isolate's memory: same limits, same windows, same 429.
 */
type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message?: string; details?: { retryAfterSeconds?: number } }; meta?: unknown };
const json = { 'content-type': 'application/json' };
const from = (ip: string): Record<string, string> => ({ ...json, 'cf-connecting-ip': ip });
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
const HOUR = 60 * 60 * 1000;
const IP = '203.0.113.40';
const OTHER_IP = '198.51.100.7';
const WRONG_CODE = 'K7M2X9';

async function call(method: string, path: string, headers: Record<string, string>, body?: unknown, env?: Record<string, string>) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
  return { status: res.status, body: (await res.json()) as Envelope };
}
const claim = (ip: string, env?: Record<string, string>) => call('POST', '/api/recovery/claim', from(ip), { code: 'TIGER-MOON-RIVER-APPLE-111111', deviceId: 'device-bbbbbbbb' }, env);
const lookup = (ip: string, code = WRONG_CODE) => call('POST', '/api/spaces/lookup', from(ip), { code });

async function classWithLearner() {
  const cls = (await call('POST', '/api/spaces', bearer('teacher'), { kind: 'class', name: 'A' })).body.data as { space: { id: string }; joinCode: string };
  const reg = (await call('POST', '/api/sync/learners', json, { deviceId: 'device-aaaaaaaa', learner: { displayName: 'Minho', ageGroup: '5-7', avatar: 'hoya-orange' } })).body.data as { learner: { id: string }; device: { secret: string } };
  const auth = (ip: string): Record<string, string> => ({ ...from(ip), authorization: `Device device-aaaaaaaa:${reg.device.secret}` });
  return { spaceId: cls.space.id, code: cls.joinCode, learnerId: reg.learner.id, auth };
}

/** The exact 429 these routes answered before the move. */
const TOO_MANY = (retryAfterSeconds: unknown) => ({ ok: false, error: { code: 'too_many_attempts', message: 'Too many attempts — try again later', details: { retryAfterSeconds } } });

beforeEach(async () => {
  await db.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the counters live in rate_hits, keyed without the client address', () => {
  it('a claim, a lookup and a re-link request each write one row under their own key', async () => {
    const s = await classWithLearner();
    const since = new Date(Date.now() - HOUR);
    await claim(IP);
    await lookup(IP);
    await call('POST', `/api/spaces/${s.spaceId}/relink-requests`, from(IP), { code: WRONG_CODE, learnerId: s.learnerId, deviceId: 'device-bbbbbbbb' });
    for (const rule of [CLAIM_RATE, LOOKUP_RATE, RELINK_RATE]) {
      const key = await durableRateKey(rule, IP, undefined);
      expect(key).not.toContain(IP);
      expect(await db.countRateHits(key, since), rule.name).toBe(1);
      expect(await db.countRateHits(await durableRateKey(rule, OTHER_IP, undefined), since), rule.name).toBe(0);
    }
    expect([CLAIM_RATE, LOOKUP_RATE, RELINK_RATE, JOIN_FAIL_RATE].map((r) => r.name)).toEqual(['claim', 'lookup', 'relink', 'join-fail']);
  });

  it('keys the hash with RESCUE_PEPPER when the deployment has one', async () => {
    await claim(IP, { RESCUE_PEPPER: 'a-long-secret' });
    const since = new Date(Date.now() - HOUR);
    expect(await db.countRateHits(await durableRateKey(CLAIM_RATE, IP, 'a-long-secret'), since)).toBe(1);
    expect(await db.countRateHits(await durableRateKey(CLAIM_RATE, IP, undefined), since)).toBe(0);
  });

  it('a request with no client header shares one bucket, as before', async () => {
    await call('POST', '/api/spaces/lookup', json, { code: WRONG_CODE });
    expect(await db.countRateHits(await durableRateKey(LOOKUP_RATE, 'anonymous', undefined), new Date(Date.now() - HOUR))).toBe(1);
  });
});

describe('POST /api/recovery/claim', () => {
  it('blocks the sixth claim of an hour per client with the same 429 body, and counts nothing more', async () => {
    expect([CLAIM_LIMIT, CLAIM_WINDOW_MS]).toEqual([5, HOUR]);
    for (let i = 0; i < CLAIM_LIMIT; i += 1) expect((await claim(IP)).status).toBe(404);
    const blocked = await claim(IP);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual(TOO_MANY(expect.any(Number)));
    expect(blocked.body.error?.details?.retryAfterSeconds).toBeGreaterThan(HOUR / 1000 - 60);
    expect(blocked.body.error?.details?.retryAfterSeconds).toBeLessThanOrEqual(HOUR / 1000);
    await claim(IP);
    expect(await db.countRateHits(await durableRateKey(CLAIM_RATE, IP, undefined), new Date(Date.now() - HOUR))).toBe(CLAIM_LIMIT);
    // Another client is not held back.
    expect((await claim(OTHER_IP)).status).toBe(404);
  });

  it('counts a malformed claim too, and opens again when the window has passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-15T10:00:00.000Z'));
    for (let i = 0; i < CLAIM_LIMIT; i += 1) expect((await call('POST', '/api/recovery/claim', from(IP), { code: 'nope' })).status).toBe(422);
    vi.setSystemTime(new Date('2026-11-15T10:20:00.000Z'));
    expect((await claim(IP)).body).toEqual(TOO_MANY(40 * 60));
    vi.setSystemTime(new Date('2026-11-15T11:00:00.001Z'));
    expect((await claim(IP)).status).toBe(404);
  });
});

describe('POST /api/spaces/lookup', () => {
  it('blocks the twenty-first lookup of an hour per client, right code or wrong', async () => {
    expect([LOOKUP_LIMIT, LOOKUP_WINDOW_MS]).toEqual([20, HOUR]);
    const s = await classWithLearner();
    for (let i = 0; i < LOOKUP_LIMIT; i += 1) expect((await lookup(IP, i % 2 === 0 ? s.code : WRONG_CODE)).status).toBe(i % 2 === 0 ? 200 : 404);
    const blocked = await lookup(IP, s.code);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual(TOO_MANY(expect.any(Number)));
    expect((await lookup(OTHER_IP, s.code)).status).toBe(200);
  });
});

describe('POST /api/spaces/:id/relink-requests', () => {
  it('blocks the eleventh request of an hour per client', async () => {
    expect(RELINK_RATE).toEqual({ name: 'relink', limit: 10, windowMs: HOUR });
    const s = await classWithLearner();
    const ask = (ip: string) => call('POST', `/api/spaces/${s.spaceId}/relink-requests`, from(ip), { code: WRONG_CODE, learnerId: s.learnerId, deviceId: 'device-bbbbbbbb' });
    for (let i = 0; i < RELINK_LIMIT; i += 1) expect((await ask(IP)).status).toBe(404);
    expect((await ask(IP)).body).toEqual(TOO_MANY(expect.any(Number)));
    expect((await ask(OTHER_IP)).status).toBe(404);
  });
});

describe('POST /api/spaces/:id/join: the wrong-code brake', () => {
  it('a right code never counts: a whole class can join from one network', async () => {
    const s = await classWithLearner();
    for (let i = 0; i < JOIN_FAIL_RATE.limit + 5; i += 1) {
      expect((await call('POST', `/api/spaces/${s.spaceId}/join`, s.auth(IP), { code: s.code, learnerId: s.learnerId })).status).toBe(i === 0 ? 201 : 200);
    }
    expect(await db.countRateHits(await durableRateKey(JOIN_FAIL_RATE, IP, undefined), new Date(Date.now() - HOUR))).toBe(0);
  });

  it('twenty wrong codes in an hour stop every join from that client, the right code included; other clients go on', async () => {
    expect(JOIN_FAIL_RATE).toEqual({ name: 'join-fail', limit: 20, windowMs: HOUR });
    const s = await classWithLearner();
    const join = (ip: string, code: string) => call('POST', `/api/spaces/${s.spaceId}/join`, s.auth(ip), { code, learnerId: s.learnerId });
    for (let i = 0; i < JOIN_FAIL_RATE.limit; i += 1) expect((await join(IP, WRONG_CODE)).body.error?.code).toBe('code_not_found');
    expect((await join(IP, WRONG_CODE)).body).toEqual(TOO_MANY(expect.any(Number)));
    expect((await join(IP, s.code)).status).toBe(429);
    expect(await db.membership(s.spaceId, 'learner', s.learnerId)).toBeNull();
    // A blocked join counts nothing more.
    expect(await db.countRateHits(await durableRateKey(JOIN_FAIL_RATE, IP, undefined), new Date(Date.now() - HOUR))).toBe(JOIN_FAIL_RATE.limit);
    expect((await join(OTHER_IP, s.code)).status).toBe(201);
  });

  it('a malformed code, an expired code and an unknown space count nothing', async () => {
    const s = await classWithLearner();
    expect((await call('POST', `/api/spaces/${s.spaceId}/join`, s.auth(IP), { code: 'nope', learnerId: s.learnerId })).status).toBe(422);
    expect((await call('POST', '/api/spaces/space:nope/join', s.auth(IP), { code: s.code, learnerId: s.learnerId })).status).toBe(404);
    const space = await db.getSpace(s.spaceId);
    if (space) await db.putSpace({ ...space, joinCodeExpiresAt: '2020-01-01T00:00:00.000Z' });
    expect((await call('POST', `/api/spaces/${s.spaceId}/join`, s.auth(IP), { code: s.code, learnerId: s.learnerId })).body.error?.code).toBe('code_expired');
    expect(await db.countRateHits(await durableRateKey(JOIN_FAIL_RATE, IP, undefined), new Date(Date.now() - HOUR))).toBe(0);
  });
});
