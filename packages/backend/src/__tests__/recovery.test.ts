import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { hashSecret } from '../lib/device-auth';
import { RESCUE_WORDS, randomRescueCode } from '../lib/rescue-words';
import { CLAIM_LIMIT, claimLimiter } from '../routes/recovery';
import { store } from '../store';

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

async function issue(auth: Record<string, string>) {
  const res = await app.request('/api/recovery/issue', { method: 'POST', headers: auth, body: JSON.stringify({ learnerId: 'profile:suni' }) });
  return { status: res.status, code: ((await res.json()) as { data?: { code: string } }).data?.code ?? '' };
}

async function claim(code: string, headers: Record<string, string> = {}) {
  const res = await app.request('/api/recovery/claim', { method: 'POST', headers: { ...json, ...headers }, body: JSON.stringify({ code, deviceId: DEVICE_B }) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('/api/recovery (F-RESTORE-001)', () => {
  beforeEach(() => {
    store.reset();
    claimLimiter.reset();
  });

  it('word list is large, upper case, and codes have the WORD-WORD-1234 shape', () => {
    expect(RESCUE_WORDS.length).toBeGreaterThanOrEqual(256);
    expect(new Set(RESCUE_WORDS).size).toBe(RESCUE_WORDS.length);
    expect(RESCUE_WORDS.every((w) => /^[A-Z]{3,10}$/.test(w))).toBe(true);
    expect(randomRescueCode(() => 0)).toBe('TIGER-TIGER-0000');
    expect(randomRescueCode(() => 0.9999)).toMatch(/^[A-Z]+-[A-Z]+-9999$/);
  });

  it('issue needs device auth, returns the plaintext once, and stores only the hash', async () => {
    const auth = await registerAndUpload();
    expect((await app.request('/api/recovery/issue', { method: 'POST', headers: json, body: JSON.stringify({ learnerId: 'profile:suni' }) })).status).toBe(401);
    expect((await app.request('/api/recovery/issue', { method: 'POST', headers: auth, body: '{}' })).status).toBe(422);
    const first = await issue(auth);
    expect(first.status).toBe(201);
    expect(first.code).toMatch(/^[A-Z]+-[A-Z]+-\d{4}$/);
    expect(store.learners.get('profile:suni')?.recoveryHash).toBe(await hashSecret(first.code));
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
  beforeEach(() => {
    store.reset();
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
