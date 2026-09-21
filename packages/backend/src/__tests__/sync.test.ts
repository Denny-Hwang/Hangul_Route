import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { hashSecret, parseDeviceHeader } from '../lib/device-auth';
import { store } from '../store';

const DEVICE_A = 'device-aaaaaaaa';
const DEVICE_B = 'device-bbbbbbbb';

const snapshotFor = (profileId: string, quests: Array<{ questId: string; stars: 0 | 1 | 2 | 3 }> = []) => ({
  profileId,
  updatedAt: '2026-09-21T00:00:00.000Z',
  episodes: [],
  quests: quests.map((q) => ({
    questId: q.questId,
    episodeId: 'episode:stage1-letters',
    startedAt: '2026-09-21T00:00:00.000Z',
    completedAt: '2026-09-21T00:05:00.000Z',
    stars: q.stars,
    attempts: 1,
    accuracy: 1,
  })),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});
const summary = {
  schemaVersion: 1,
  lastActiveAt: '2026-09-21T00:00:00.000Z',
  streakDays: 0,
  stage1: { questsDone: 0, questsTotal: 11, anchorAccuracy: null },
  cardsUnlocked: 0,
  minutesLast7d: 0,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};

async function register(deviceId = DEVICE_A, learnerId?: string) {
  const res = await app.request('/api/sync/learners', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      learner: { id: learnerId, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' },
    }),
  });
  const json = (await res.json()) as { data: { learner: { id: string }; device: { deviceId: string; secret: string } } };
  return { status: res.status, learnerId: json.data.learner.id, secret: json.data.device.secret, deviceId };
}

const deviceAuth = (deviceId: string, secret: string) => ({
  'content-type': 'application/json',
  authorization: `Device ${deviceId}:${secret}`,
});

async function put(learnerId: string, auth: Record<string, string>, body: Record<string, unknown>) {
  const res = await app.request(`/api/sync/learners/${learnerId}/snapshot`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as { data?: Record<string, unknown> } };
}

describe('/api/sync (F-SYNC-001)', () => {
  beforeEach(() => store.reset());

  it('registers a learner keeping the client id and returns a one-time device secret', async () => {
    const r = await register(DEVICE_A, 'profile:local-1');
    expect(r.status).toBe(201);
    expect(r.learnerId).toBe('profile:local-1');
    expect(r.secret).toHaveLength(64);
    expect(store.device('profile:local-1', DEVICE_A)?.secretHash).toBe(await hashSecret(r.secret));
    // a taken id is a conflict, not a silent rename
    const dup = await app.request('/api/sync/learners', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: DEVICE_B, learner: { id: 'profile:local-1', displayName: 'X', ageGroup: '5-7', avatar: 'a' } }),
    });
    expect(dup.status).toBe(409);
    // no id → server id
    const anon = await register(DEVICE_B);
    expect(anon.learnerId).toMatch(/^profile:/);
    // bad body → 422
    const bad = await app.request('/api/sync/learners', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(bad.status).toBe(422);
  });

  it('device auth: missing → 401, wrong secret → 401, other learner\'s device → 403, unknown learner → 404', async () => {
    const a = await register(DEVICE_A);
    const b = await register(DEVICE_B);
    const none = await app.request(`/api/sync/learners/${a.learnerId}/snapshot`);
    expect(none.status).toBe(401);
    const wrong = await app.request(`/api/sync/learners/${a.learnerId}/snapshot`, { headers: deviceAuth(DEVICE_A, 'nope') });
    expect(wrong.status).toBe(401);
    const cross = await app.request(`/api/sync/learners/${a.learnerId}/snapshot`, { headers: deviceAuth(DEVICE_B, b.secret) });
    expect(cross.status).toBe(403);
    const unknown = await app.request('/api/sync/learners/profile:ghost/snapshot', { headers: deviceAuth(DEVICE_A, a.secret) });
    expect(unknown.status).toBe(404);
    expect(parseDeviceHeader('Device :x')).toBeNull();
    expect(parseDeviceHeader('Device abc:')).toBeNull();
    expect(parseDeviceHeader('Bearer abc')).toBeNull();
  });

  it('put/get round-trips a snapshot with optimistic revs', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const empty = await app.request(`/api/sync/learners/${r.learnerId}/snapshot`, { headers: auth });
    expect(empty.status).toBe(404);

    const first = await put(r.learnerId, auth, {
      baseRev: 0,
      snapshot: snapshotFor(r.learnerId, [{ questId: 'quest:a', stars: 2 }]),
      summary,
      schemaVer: 1,
      contentVer: '2026.09',
    });
    expect(first.status).toBe(200);
    expect(first.json.data?.rev).toBe(1);

    const got = await app.request(`/api/sync/learners/${r.learnerId}/snapshot`, { headers: auth });
    const gotJson = (await got.json()) as { data: { rev: number; snapshot: { quests: unknown[] } } };
    expect(gotJson.data.rev).toBe(1);
    expect(gotJson.data.snapshot.quests).toHaveLength(1);

    const mismatched = await put(r.learnerId, auth, {
      baseRev: 0,
      snapshot: snapshotFor('profile:someone-else'),
      summary,
      schemaVer: 1,
      contentVer: '2026.09',
    });
    expect(mismatched.status).toBe(422);
    const invalid = await put(r.learnerId, auth, { baseRev: 1 });
    expect(invalid.status).toBe(422);
  });

  it('409 on a stale rev returns the server snapshot; a merged retry with the right rev succeeds', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const base = { summary, schemaVer: 1, contentVer: '2026.09' };
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId, [{ questId: 'quest:a', stars: 3 }]) });

    // second device bound via a second registration is S2's job; simulate by binding directly
    const stale = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId, [{ questId: 'quest:b', stars: 1 }]) });
    expect(stale.status).toBe(409);
    const conflict = stale.json as unknown as { data: { rev: number; snapshot: { quests: Array<{ questId: string }> } } };
    expect(conflict.data.rev).toBe(1);
    expect(conflict.data.snapshot.quests[0]?.questId).toBe('quest:a');

    const merged = await put(r.learnerId, auth, {
      ...base,
      baseRev: 1,
      snapshot: snapshotFor(r.learnerId, [
        { questId: 'quest:a', stars: 3 },
        { questId: 'quest:b', stars: 1 },
      ]),
    });
    expect(merged.status).toBe(200);
    expect(merged.json.data?.rev).toBe(2);
    expect(store.learners.get(r.learnerId)?.lastActiveAt).toBe(merged.json.data?.updatedAt);
  });

  it('inbox carries the fixed shape with empty plans until later stages', async () => {
    const r = await register(DEVICE_A);
    const res = await app.request(`/api/sync/learners/${r.learnerId}/inbox?since=2026-01-01`, {
      headers: deviceAuth(DEVICE_A, r.secret),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { rev: number; plans: unknown[]; memberships: unknown[]; tier: string; serverTime: string } };
    expect(json.data).toMatchObject({ rev: 0, plans: [], memberships: [], tier: 'free' });
    expect(json.data.serverTime).toMatch(/T/);
  });
});
