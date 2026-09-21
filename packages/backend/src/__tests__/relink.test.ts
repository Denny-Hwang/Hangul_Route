import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { RELINK_LIMIT, relinkLimiter } from '../routes/relink';
import { store } from '../store';

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
async function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Envelope };
}
const DEVICE_A = 'device-aaaaaaaa';
const DEVICE_B = 'device-bbbbbbbb';

async function setup() {
  const cls = (await call('POST', '/api/spaces', bearer('teacher'), { kind: 'class', name: 'A' })).body.data as { space: { id: string }; joinCode: string };
  const reg = (await call('POST', '/api/sync/learners', json, { deviceId: DEVICE_A, learner: { displayName: 'Minho Kim', ageGroup: '5-7', avatar: 'hoya-orange' } })).body.data as { learner: { id: string }; device: { secret: string } };
  const authA = { ...json, authorization: `Device ${DEVICE_A}:${reg.device.secret}` };
  await call('POST', `/api/spaces/${cls.space.id}/join`, authA, { code: cls.joinCode, learnerId: reg.learner.id });
  await call('PUT', `/api/sync/learners/${reg.learner.id}/snapshot`, authA, {
    baseRev: 0,
    snapshot: { profileId: reg.learner.id, updatedAt: 't', episodes: [], quests: [], cards: [{ cardId: 'card:book', unlockedAt: 't', newSinceLastView: false }], sessions: [], homework: [], reviews: [], streakDays: 0 },
    summary: { schemaVersion: 1, lastActiveAt: 't', streakDays: 0, stage1: { questsDone: 0, questsTotal: 11, anchorAccuracy: null }, cardsUnlocked: 1, minutesLast7d: 0, jamoRecognized: [], needsPractice: [], planProgress: {} },
    schemaVer: 1,
    contentVer: '2026.09',
  });
  return { spaceId: cls.space.id, code: cls.joinCode, learnerId: reg.learner.id };
}
const create = (spaceId: string, body: Record<string, unknown>, headers: Record<string, string> = json) => call('POST', `/api/spaces/${spaceId}/relink-requests`, headers, body);
const poll = (spaceId: string, rid: string, deviceId: string) => call('GET', `/api/spaces/${spaceId}/relink-requests/${rid}?deviceId=${deviceId}`, json);

beforeEach(() => {
  store.reset();
  relinkLimiter.reset();
});

describe('re-link requests (F-TCH-001 §10.1)', () => {
  it('a new device requests, the teacher approves, credentials are picked up once and the device can sync', async () => {
    const s = await setup();
    const created = await create(s.spaceId, { code: s.code.toLowerCase(), learnerId: s.learnerId, deviceId: DEVICE_B, platform: 'tablet' });
    expect(created.status).toBe(201);
    const req = (created.body.data as { request: { id: string; status: string; expiresAt: string } }).request;
    expect(req.status).toBe('pending');
    expect(Date.parse(req.expiresAt) - Date.now()).toBeGreaterThan(9 * 60 * 1000);
    // same learner + device again reuses the pending request
    expect((await create(s.spaceId, { code: s.code, learnerId: s.learnerId, deviceId: DEVICE_B })).status).toBe(200);

    expect((await poll(s.spaceId, req.id, DEVICE_B)).body.data).toMatchObject({ status: 'pending' });
    expect((await poll(s.spaceId, req.id, DEVICE_A)).status).toBe(404);

    const list = (await call('GET', `/api/spaces/${s.spaceId}/relink-requests`, bearer('teacher'))).body.data as { requests: Array<{ id: string; learnerName: string }> };
    expect(list.requests).toEqual([expect.objectContaining({ id: req.id, learnerName: 'Minho Kim' })]);
    expect((await call('GET', `/api/spaces/${s.spaceId}/relink-requests`, bearer('stranger'))).status).toBe(403);

    const approved = await call('POST', `/api/spaces/${s.spaceId}/relink-requests/${req.id}/approve`, bearer('teacher'));
    expect(approved.status).toBe(200);
    expect(JSON.stringify(approved.body)).not.toContain('secret');

    const pickup = (await poll(s.spaceId, req.id, DEVICE_B)).body.data as { status: string; device: { deviceId: string; secret: string }; learner: { id: string; recoveryHash?: string }; snapshot: { rev: number } };
    expect(pickup.status).toBe('approved');
    expect(pickup.device.deviceId).toBe(DEVICE_B);
    expect(pickup.learner.id).toBe(s.learnerId);
    expect(pickup.learner).not.toHaveProperty('recoveryHash');
    expect(pickup.snapshot.rev).toBe(1);
    // second pickup carries no credentials
    expect((await poll(s.spaceId, req.id, DEVICE_B)).body.data).toEqual({ status: 'approved', expiresAt: req.expiresAt });
    const sync = await app.request(`/api/sync/learners/${s.learnerId}/snapshot`, { headers: { authorization: `Device ${DEVICE_B}:${pickup.device.secret}` } });
    expect(sync.status).toBe(200);
    // approving twice is refused; the list no longer shows it
    expect((await call('POST', `/api/spaces/${s.spaceId}/relink-requests/${req.id}/approve`, bearer('teacher'))).body.error?.code).toBe('not_pending');
    expect(((await call('GET', `/api/spaces/${s.spaceId}/relink-requests`, bearer('teacher'))).body.data as { requests: unknown[] }).requests).toEqual([]);
  });

  it('rejects wrong codes, unknown learners, already-bound devices, and rate-limits guessing', async () => {
    const s = await setup();
    expect((await create(s.spaceId, { code: 'K7M2X9', learnerId: s.learnerId, deviceId: DEVICE_B })).body.error?.code).toBe('code_not_found');
    expect((await create(s.spaceId, { code: s.code, learnerId: 'profile:nobody', deviceId: DEVICE_B })).body.error?.code).toBe('learner_not_found');
    expect((await create(s.spaceId, { code: s.code, learnerId: s.learnerId, deviceId: DEVICE_A })).body.error?.code).toBe('already_bound');
    expect((await create(s.spaceId, { code: 'nope', learnerId: s.learnerId, deviceId: DEVICE_B })).status).toBe(422);
    expect((await create('space:nope', { code: s.code, learnerId: s.learnerId, deviceId: DEVICE_B })).status).toBe(404);
    const space = store.spaces.get(s.spaceId);
    if (space) space.joinCodeExpiresAt = '2020-01-01T00:00:00.000Z';
    expect((await create(s.spaceId, { code: s.code, learnerId: s.learnerId, deviceId: DEVICE_B })).body.error?.code).toBe('code_expired');
    relinkLimiter.reset();
    for (let i = 0; i < RELINK_LIMIT; i += 1) await create(s.spaceId, { code: 'K7M2X9', learnerId: s.learnerId, deviceId: DEVICE_B });
    expect((await create(s.spaceId, { code: 'K7M2X9', learnerId: s.learnerId, deviceId: DEVICE_B })).status).toBe(429);
  });

  it('deny closes a request; expiry is reported to both sides', async () => {
    const s = await setup();
    const req = ((await create(s.spaceId, { code: s.code, learnerId: s.learnerId, deviceId: DEVICE_B })).body.data as { request: { id: string } }).request;
    expect((await call('POST', `/api/spaces/${s.spaceId}/relink-requests/${req.id}/deny`, bearer('teacher'))).body.data).toMatchObject({ request: { status: 'denied' } });
    expect((await poll(s.spaceId, req.id, DEVICE_B)).body.data).toMatchObject({ status: 'denied' });
    expect(store.device(s.learnerId, DEVICE_B)).toBeUndefined();

    const again = ((await create(s.spaceId, { code: s.code, learnerId: s.learnerId, deviceId: 'device-cccccccc' })).body.data as { request: { id: string } }).request;
    const stored = store.relinkRequests.get(again.id);
    if (stored) stored.expiresAt = '2020-01-01T00:00:00.000Z';
    expect((await poll(s.spaceId, again.id, 'device-cccccccc')).body.data).toMatchObject({ status: 'expired' });
    expect((await call('POST', `/api/spaces/${s.spaceId}/relink-requests/${again.id}/approve`, bearer('teacher'))).body.error?.code).toBe('expired');
    expect((await call('POST', `/api/spaces/${s.spaceId}/relink-requests/relink:nope/deny`, bearer('teacher'))).status).toBe(404);
  });

  it('anonymized rosters show initials to the teacher list and the lookup', async () => {
    const s = await setup();
    expect((await call('PATCH', `/api/spaces/${s.spaceId}/settings`, bearer('teacher'), { anonymizeRoster: true })).status).toBe(200);
    await create(s.spaceId, { code: s.code, learnerId: s.learnerId, deviceId: DEVICE_B });
    const list = (await call('GET', `/api/spaces/${s.spaceId}/relink-requests`, bearer('teacher'))).body.data as { requests: Array<{ learnerName: string }> };
    expect(list.requests[0]?.learnerName).toBe('M. K.');
    const lookup = (await call('POST', '/api/spaces/lookup', json, { code: s.code })).body.data as { roster: Array<{ learnerId: string; name: string }> };
    expect(lookup.roster).toEqual([{ learnerId: s.learnerId, name: 'M. K.' }]);
  });
});
