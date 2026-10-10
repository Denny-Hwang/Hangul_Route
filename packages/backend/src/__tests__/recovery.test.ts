import { normalizeRescueCode } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { hashSecret } from '../lib/device-auth';
import { RESCUE_CODE_BITS, RESCUE_WORDS, randomRescueCode } from '../lib/rescue-words';
import { CLAIM_LIMIT, claimLimiter, setRescueCodeSourceForTests } from '../routes/recovery';
import { testDb as db } from './helpers/db';

const DEVICE_A = 'device-aaaaaaaa';
const DEVICE_B = 'device-bbbbbbbb';
const json = { 'content-type': 'application/json' };

async function registerAndUpload() {
  const reg = await app.request('/api/sync/learners', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ deviceId: DEVICE_A, learner: { id: 'profile:suni', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' } }),
  });
  const r = (await reg.json()) as { data: { device: { secret: string } } };
  const auth = { ...json, authorization: `Device ${DEVICE_A}:${r.data.device.secret}` };
  await app.request('/api/sync/learners/profile:suni/snapshot', {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({
      baseRev: 0,
      schemaVer: 1,
      contentVer: '2026.09',
      snapshot: { profileId: 'profile:suni', updatedAt: 't', episodes: [], quests: [], cards: [{ cardId: 'card:tiger', unlockedAt: 't', newSinceLastView: false }], sessions: [], homework: [], reviews: [], streakDays: 0 },
      summary: { schemaVersion: 1, lastActiveAt: 't', streakDays: 0, stage1: { questsDone: 0, questsTotal: 11, anchorAccuracy: null }, cardsUnlocked: 1, minutesLast7d: 0, jamoRecognized: [], needsPractice: [], planProgress: {} },
    }),
  });
  return auth;
}

type Env = { RESCUE_PEPPER?: string };
const V2_CODE = /^(?:[A-Z]{3,10}-){4}\d{6}$/;

async function issue(auth: Record<string, string>, env?: Env, learnerId = 'profile:suni') {
  const res = await app.request('/api/recovery/issue', { method: 'POST', headers: auth, body: JSON.stringify({ learnerId }) }, env);
  return { status: res.status, code: ((await res.json()) as { data?: { code: string } }).data?.code ?? '' };
}

async function claim(code: string, headers: Record<string, string> = {}, env?: Env) {
  const res = await app.request('/api/recovery/claim', { method: 'POST', headers: { ...json, ...headers }, body: JSON.stringify({ code, deviceId: DEVICE_B }) }, env);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('/api/recovery (F-RESTORE-001)', () => {
  beforeEach(async () => {
    await db.reset();
    claimLimiter.reset();
  });

  afterEach(() => {
    setRescueCodeSourceForTests(null);
    vi.restoreAllMocks();
  });

  it('codes are four list words + six digits (>= 50 bits) drawn from crypto.getRandomValues, never Math.random (SEC-5)', () => {
    expect(RESCUE_WORDS).toHaveLength(256); // exactly one random byte per word: no modulo bias
    expect(new Set(RESCUE_WORDS).size).toBe(RESCUE_WORDS.length);
    expect(RESCUE_WORDS.every((w) => /^[A-Z]{3,10}$/.test(w))).toBe(true);
    expect(RESCUE_CODE_BITS).toBeGreaterThanOrEqual(50);

    expect(randomRescueCode((bytes) => bytes.fill(0))).toBe('TIGER-TIGER-TIGER-TIGER-000000');
    // The number is a uint32 reduced mod 10^6; draws past the last whole multiple are thrown away (no bias).
    const draws = [
      [0, 1, 2, 255],
      [0xff, 0xff, 0xff, 0xff],
      [0x00, 0x01, 0xe2, 0x40], // 123456
    ];
    let i = 0;
    expect(randomRescueCode((bytes) => bytes.set(draws[i++] as number[]))).toBe('TIGER-MOON-RIVER-BAGEL-123456');
    expect(i).toBe(3);

    const mathRandom = vi.spyOn(Math, 'random');
    const a = randomRescueCode();
    const b = randomRescueCode();
    expect(mathRandom).not.toHaveBeenCalled();
    expect(a).toMatch(V2_CODE);
    expect(a).not.toBe(b);
    expect(normalizeRescueCode(a.toLowerCase().replace(/-/g, ' '))).toBe(a);
  });

  it('issue needs device auth, returns the plaintext once, and stores only the hash', async () => {
    const auth = await registerAndUpload();
    expect((await app.request('/api/recovery/issue', { method: 'POST', headers: json, body: JSON.stringify({ learnerId: 'profile:suni' }) })).status).toBe(401);
    expect((await app.request('/api/recovery/issue', { method: 'POST', headers: auth, body: '{}' })).status).toBe(422);
    const first = await issue(auth);
    expect(first.status).toBe(201);
    expect(first.code).toMatch(V2_CODE);
    // no RESCUE_PEPPER on the Worker: plain SHA-256, the hash every earlier code was stored under
    expect((await db.getLearner('profile:suni'))?.recoveryHash).toBe(await hashSecret(first.code));
  });

  it('with RESCUE_PEPPER the stored hash is keyed (HMAC-SHA-256), and claims find it (SEC-5)', async () => {
    const env = { RESCUE_PEPPER: 'test-pepper-0123456789abcdef' };
    const auth = await registerAndUpload();
    const { status, code } = await issue(auth, env);
    expect(status).toBe(201);
    const stored = (await db.getLearner('profile:suni'))?.recoveryHash;
    expect(stored).toBe(await hmacHex(env.RESCUE_PEPPER, code));
    expect(stored).not.toBe(await hashSecret(code));
    expect((await claim(code, {}, env)).status).toBe(200);
    // the pepper is part of the hash: a Worker without it cannot match the code
    expect((await claim(code)).status).toBe(404);
  });

  it('codes issued before SEC-5 (two words + four digits, plain SHA-256) still restore, with or without a pepper', async () => {
    await registerAndUpload();
    const learner = await db.getLearner('profile:suni');
    if (!learner) throw new Error('learner missing');
    await db.putLearner({ ...learner, recoveryHash: await hashSecret('TIGER-MOON-4821') });

    const plain = await claim('tiger moon 4821');
    expect(plain.status).toBe(200);
    expect((plain.body.data as { learner: { id: string } }).learner.id).toBe('profile:suni');
    const peppered = await claim('TIGER-MOON-4821', {}, { RESCUE_PEPPER: 'set-after-launch' });
    expect(peppered.status).toBe(200);
    expect((peppered.body.data as { snapshot: { rev: number } }).snapshot.rev).toBe(1);
  });

  it('a code that collides with another learner is drawn again, never shared (UNIQUE recovery_hash)', async () => {
    const suni = await registerAndUpload();
    const reg = await app.request('/api/sync/learners', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ deviceId: 'device-cccccccc', learner: { id: 'profile:mina', displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-blue' } }),
    });
    const minaSecret = ((await reg.json()) as { data: { device: { secret: string } } }).data.device.secret;
    const mina = { ...json, authorization: `Device device-cccccccc:${minaSecret}` };

    const scripted = ['TIGER-MOON-RIVER-APPLE-111111', 'TIGER-MOON-RIVER-APPLE-111111', 'TIGER-MOON-RIVER-APPLE-222222'];
    setRescueCodeSourceForTests(() => scripted.shift() ?? 'TIGER-MOON-RIVER-APPLE-999999');
    expect((await issue(suni)).code).toBe('TIGER-MOON-RIVER-APPLE-111111');
    expect((await issue(mina, undefined, 'profile:mina')).code).toBe('TIGER-MOON-RIVER-APPLE-222222');
    expect(((await claim('TIGER-MOON-RIVER-APPLE-111111')).body.data as { learner: { id: string } }).learner.id).toBe('profile:suni');
    expect(((await claim('TIGER-MOON-RIVER-APPLE-222222')).body.data as { learner: { id: string } }).learner.id).toBe('profile:mina');

    // a source that keeps colliding gives up cleanly and leaves the current code in place
    claimLimiter.reset();
    setRescueCodeSourceForTests(() => 'TIGER-MOON-RIVER-APPLE-111111');
    const stuck = await app.request('/api/recovery/issue', { method: 'POST', headers: mina, body: JSON.stringify({ learnerId: 'profile:mina' }) });
    expect(stuck.status).toBe(500);
    expect(((await claim('TIGER-MOON-RIVER-APPLE-222222')).body.data as { learner: { id: string } }).learner.id).toBe('profile:mina');
  });

  it('claim binds a new device and returns learner + snapshot; rotation invalidates the old code', async () => {
    const auth = await registerAndUpload();
    const { code } = await issue(auth);
    const ok = await claim(code.toLowerCase().replace(/-/g, ' '));
    expect(ok.status).toBe(200);
    const data = ok.body.data as { learner: { id: string }; device: { deviceId: string; secret: string }; snapshot: { rev: number; snapshot: { cards: unknown[] } } };
    expect(data.learner.id).toBe('profile:suni');
    expect(data.learner).not.toHaveProperty('recoveryHash');
    expect(data.device.deviceId).toBe(DEVICE_B);
    expect(data.snapshot.rev).toBe(1);
    expect(data.snapshot.snapshot.cards).toHaveLength(1);
    // the new device can now sync
    const got = await app.request('/api/sync/learners/profile:suni/snapshot', { headers: { authorization: `Device ${DEVICE_B}:${data.device.secret}` } });
    expect(got.status).toBe(200);

    const { code: rotated } = await issue(auth);
    expect(rotated).not.toBe(code);
    expect((await claim(code)).status).toBe(404);
    expect((await claim(rotated)).status).toBe(200);
  });

  it('rejects malformed and unknown codes, and rate-limits guessing per client key', async () => {
    expect((await claim('nope')).status).toBe(422);
    expect((await claim('TIGER-MOON-0000')).status).toBe(404);
    for (let i = 0; i < CLAIM_LIMIT - 2; i += 1) await claim('TIGER-MOON-0001');
    const blocked = await claim('TIGER-MOON-0002');
    expect(blocked.status).toBe(429);
    expect((blocked.body.error as { details: { retryAfterSeconds: number } }).details.retryAfterSeconds).toBeGreaterThan(0);
    // a different client key is unaffected; x-forwarded-for takes the first hop
    expect((await claim('TIGER-MOON-0003', { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' })).status).toBe(404);
    expect((await claim('TIGER-MOON-0003', { 'cf-connecting-ip': '198.51.100.7' })).status).toBe(404);
  });

  it('claim without a snapshot returns snapshot: null', async () => {
    const reg = await app.request('/api/sync/learners', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ deviceId: DEVICE_A, learner: { id: 'profile:suni', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' } }),
    });
    const r = (await reg.json()) as { data: { device: { secret: string } } };
    const { code } = await issue({ ...json, authorization: `Device ${DEVICE_A}:${r.data.device.secret}` });
    const res = await claim(code);
    expect(res.status).toBe(200);
    expect((res.body.data as { snapshot: unknown }).snapshot).toBeNull();
  });
});

describe('rescue re-issue by an adult (F-TCH-001 §10.2)', () => {
  beforeEach(async () => {
    await db.reset();
    claimLimiter.reset();
  });

  it('a teacher with roster rights can issue a new code; strangers cannot; the old code stops working', async () => {
    const auth = await registerAndUpload();
    const { code: first } = await issue(auth);
    const clsRes = await app.request('/api/spaces', { method: 'POST', headers: { ...json, authorization: 'Bearer teacher' }, body: JSON.stringify({ kind: 'class', name: 'A' }) });
    const cls = (await clsRes.json()) as { data: { space: { id: string }; joinCode: string } };
    const joined = await app.request(`/api/spaces/${cls.data.space.id}/join`, { method: 'POST', headers: auth, body: JSON.stringify({ code: cls.data.joinCode, learnerId: 'profile:suni' }) });
    expect(joined.status).toBe(201);
    const denied = await app.request('/api/recovery/issue', { method: 'POST', headers: { ...json, authorization: 'Bearer stranger' }, body: JSON.stringify({ learnerId: 'profile:suni' }) });
    expect(denied.status).toBe(403);
    const reissued = await app.request('/api/recovery/issue', { method: 'POST', headers: { ...json, authorization: 'Bearer teacher' }, body: JSON.stringify({ learnerId: 'profile:suni' }) });
    expect(reissued.status).toBe(201);
    const { code: second } = ((await reissued.json()) as { data: { code: string } }).data;
    expect(second).not.toBe(first);
    expect((await claim(first)).status).toBe(404);
    expect((await claim(second)).status).toBe(200);
    expect((await app.request('/api/recovery/issue', { method: 'POST', headers: json, body: JSON.stringify({ learnerId: 'profile:suni' }) })).status).toBe(401);
  });
});
