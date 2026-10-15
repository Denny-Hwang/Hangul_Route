import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { store } from '../store';
import { testDb as db } from './helpers/db';

/**
 * PATCH /api/sync/learners/:id answers with the edit time it stored (F-PROF-001). A device whose clock runs ahead
 * sends an `at` in the future, which the Worker caps at its own now; the device orders later inbox rows against that
 * stored time, not its own clock. Runs on memory and, with HR_TEST_DB=sqlite, on the real migrations.
 */
type Envelope = { ok: boolean; data?: Record<string, unknown> };
const json = { 'content-type': 'application/json' };

async function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Envelope };
}

async function registerLearner(): Promise<{ learnerId: string; auth: Record<string, string> }> {
  const r = await call('POST', '/api/sync/learners', json, { deviceId: 'device-stamp-0001', learner: { displayName: 'test', ageGroup: '5-7', avatar: 'hoya-orange' } });
  expect(r.status).toBe(201);
  const data = r.body.data as { learner: { id: string }; device: { secret: string } };
  return { learnerId: data.learner.id, auth: { ...json, authorization: `Device device-stamp-0001:${data.device.secret}` } };
}

beforeEach(async () => {
  await db.reset();
  store.reset();
});

describe('PATCH /api/sync/learners/:id — the stored edit time', () => {
  it('answers the stored time: the sent one, or the server now for a device clock ahead', async () => {
    const learner = await registerLearner();
    const sent = new Date(Date.now() - 60_000).toISOString();
    const first = await call('PATCH', `/api/sync/learners/${learner.learnerId}`, learner.auth, { displayName: 'Sungjoo', at: sent });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ applied: true, profileUpdatedAt: sent });

    const before = Date.now();
    const ahead = new Date(Date.now() + 3_600_000).toISOString();
    const second = await call('PATCH', `/api/sync/learners/${learner.learnerId}`, learner.auth, { avatar: 'hoya-orange', at: ahead });
    const stored = String(second.body.data?.profileUpdatedAt);
    expect(second.body.data?.applied).toBe(true);
    expect(Date.parse(stored)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(stored)).toBeLessThan(Date.parse(ahead));
    expect((await db.getLearner(learner.learnerId))?.profileUpdatedAt).toBe(stored);
  });

  it('a late edit answers applied false with the newer stored time and row', async () => {
    const learner = await registerLearner();
    const newer = new Date(Date.now() - 1_000).toISOString();
    await call('PATCH', `/api/sync/learners/${learner.learnerId}`, learner.auth, { displayName: 'Mina', at: newer });
    const late = await call('PATCH', `/api/sync/learners/${learner.learnerId}`, learner.auth, { displayName: 'Sungjoo', at: new Date(Date.now() - 60_000).toISOString() });
    expect(late.body.data).toMatchObject({ applied: false, profileUpdatedAt: newer, learner: { displayName: 'Mina' } });
  });
});
