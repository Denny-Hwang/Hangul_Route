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

  it('real draws are uniform: all 256 words and every leading digit come up evenly, and 20 000 codes never repeat (SEC-5)', () => {
    const draws = 20_000;
    const words = new Map<string, number>();
    const leadingDigit = Array.from({ length: 10 }, () => 0);
    const seen = new Set<string>();
    for (let i = 0; i < draws; i += 1) {
      const code = randomRescueCode();
      seen.add(code);
      const parts = code.split('-');
      for (const word of parts.slice(0, 4)) words.set(word, (words.get(word) ?? 0) + 1);
      leadingDigit[Number((parts[4] as string)[0])] += 1;
    }
    expect(seen.size).toBe(draws); // 2^51.9 codes: a repeat in 20 000 means a broken source
    expect(words.size).toBe(RESCUE_WORDS.length); // every word is reachable
    // each word is expected 80 000 / 256 = 312.5 times (sd 17.6); six sd either way
    for (const count of words.values()) expect(Math.abs(count - 312.5)).toBeLessThan(110);
    // the number is uniform over [0, 10^6), so the leading digit is expected 2 000 times (sd 42); six sd either way
    for (const count of leadingDigit) expect(Math.abs(count - 2_000)).toBeLessThan(255);
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

  it('a code the old Worker stored is matched byte for byte: PADDLE-GLACIER-4992 is a fixed SHA-256 vector, whatever the helpers do', async () => {
    // sha256 of the normalized code, computed outside this codebase: printf 'PADDLE-GLACIER-4992' | shasum -a 256
    const STORED_BY_THE_OLD_WORKER = '73fb5ede9468438ddce667718d1a0c91e73da887f47606d14e9d693f52513d75';
    expect(await hashSecret('PADDLE-GLACIER-4992')).toBe(STORED_BY_THE_OLD_WORKER);
    await registerAndUpload();
    const learner = await db.getLearner('profile:suni');
    if (!learner) throw new Error('learner missing');
    await db.putLearner({ ...learner, recoveryHash: STORED_BY_THE_OLD_WORKER });

    // every way a parent writes it down, before and after RESCUE_PEPPER is set
    for (const env of [undefined, { RESCUE_PEPPER: 'set-after-launch' }]) {
      for (const typed of ['PADDLE-GLACIER-4992', 'paddle glacier 4992', ' Paddle-Glacier 4992 ']) {
        claimLimiter.reset();
        const res = await claim(typed, {}, env);
        expect(res.status).toBe(200);
        expect((res.body.data as { learner: { id: string }; snapshot: { rev: number } }).learner.id).toBe('profile:suni');
      }
    }
    // a near miss is still just not found
    claimLimiter.reset();
    expect((await claim('PADDLE-GLACIER-4993')).status).toBe(404);
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

describe('rescue re-issue by an adult — only who may read the snapshot (SEC-4)', () => {
  beforeEach(async () => {
    await db.reset();
    claimLimiter.reset();
  });

  const T = '2026-10-09T00:00:00.000Z';
  const settings = { consentMode: 'parent' as const, anonymizeRoster: false };
  const space = (id: string, kind: 'family' | 'class' | 'school', owner: string, parentSpaceId: string | null = null, archivedAt: string | null = null) => ({ id, kind, name: id, parentSpaceId, ownerAccountId: owner, joinCode: null, joinCodeExpiresAt: null, settings, archivedAt, createdAt: T });

  /**
   * A re-issued code is a bearer credential for the whole snapshot and a new
   * device binding, so it follows snapshot.read: family owner and caregivers.
   * Class and school roles hold summary.read + roster.manage only.
   */
  it('permission matrix: family owner and caregiver may; class and school roles, strangers and archived spaces may not', async () => {
    const auth = await registerAndUpload();
    const { code: original } = await issue(auth);
    for (const id of ['mom', 'dad', 'teacher', 'coteacher', 'principal', 'admin', 'schoolteacher', 'exmom', 'stranger']) {
      await db.putAccount({ id, email: null, displayName: null, consent: null, createdAt: T });
    }
    await db.putSpace(space('space:fam', 'family', 'mom'));
    await db.putSpace(space('space:sch', 'school', 'principal'));
    await db.putSpace(space('space:cls', 'class', 'teacher', 'space:sch'));
    await db.putSpace(space('space:old', 'family', 'exmom', null, T));
    const member = (spaceId: string, memberId: string, role: 'owner' | 'caregiver' | 'teacher' | 'admin' | 'student', memberKind: 'account' | 'learner' = 'account') =>
      db.addMembership({ spaceId, memberKind, memberId, role, joinedAt: T });
    await member('space:fam', 'mom', 'owner');
    await member('space:fam', 'dad', 'caregiver');
    await member('space:cls', 'teacher', 'owner');
    await member('space:cls', 'coteacher', 'teacher');
    await member('space:sch', 'principal', 'owner');
    await member('space:sch', 'admin', 'admin');
    await member('space:sch', 'schoolteacher', 'teacher');
    await member('space:old', 'exmom', 'owner');
    for (const s of ['space:fam', 'space:cls', 'space:old']) await member(s, 'profile:suni', 'student', 'learner');

    const expected: Record<string, number> = { mom: 201, dad: 201, teacher: 403, coteacher: 403, principal: 403, admin: 403, schoolteacher: 403, exmom: 403, stranger: 403 };
    const got: Record<string, number> = {};
    for (const who of Object.keys(expected)) {
      got[who] = (await app.request('/api/recovery/issue', { method: 'POST', headers: { ...json, authorization: `Bearer ${who}` }, body: JSON.stringify({ learnerId: 'profile:suni' }) })).status;
    }
    expect(got).toEqual(expected);
    expect((await app.request('/api/recovery/issue', { method: 'POST', headers: json, body: JSON.stringify({ learnerId: 'profile:suni' }) })).status).toBe(401);

    // a caregiver's re-issue rotates: the old code stops, the new one restores
    const reissued = await app.request('/api/recovery/issue', { method: 'POST', headers: { ...json, authorization: 'Bearer mom' }, body: JSON.stringify({ learnerId: 'profile:suni' }) });
    const { code: fresh } = ((await reissued.json()) as { data: { code: string } }).data;
    expect(fresh).toMatch(V2_CODE);
    expect((await claim(original)).status).toBe(404);
    expect((await claim(fresh)).status).toBe(200);
  });
});
