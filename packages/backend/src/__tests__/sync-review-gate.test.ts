import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { claimLimiter } from '../routes/recovery';
import { testDb as db } from './helpers/db';

/*
 * F-CURR-002 section 13 (row CM-15, Worker first): the minimum-app-version gate of the `warmup` review kind. An app
 * build from before CM-3b reads `reviews[]` strictly, so a copy holding a warm-up entry fails whole. The app that
 * reads the kind declares it (`?cap=warmup`); the Worker hands warm-up entries only to such a caller (the GET, a
 * 409, the Rescue Code claim) and keeps the stored ones when a caller that does not declare it re-uploads. Warm-up
 * and Try these again (`feedback`) entries are kept for 14 local days after the newest of their kind.
 */

const DEVICE_A = 'device-aaaaaaaa';
const DEVICE_B = 'device-bbbbbbbb';
const json = { 'content-type': 'application/json' };
const base = { schemaVer: 1, contentVer: '2026.10' };
const CAP = '?cap=warmup';

const snapshotFor = (profileId: string, reviews: unknown[]) => ({
  profileId,
  updatedAt: '2026-10-21T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews,
  streakDays: 0,
});
const summary = {
  schemaVersion: 1,
  lastActiveAt: '2026-10-21T00:00:00.000Z',
  streakDays: 0,
  stage1: { questsDone: 0, questsTotal: 11, anchorAccuracy: null },
  cardsUnlocked: 0,
  minutesLast7d: 0,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};
const warmup = (day: string) => ({ id: `warmup:${day}`, kind: 'warmup', generatedAt: `${day}T09:00:00.000Z`, scope: day, itemIds: ['lex:sagwa'] });
const feedback = (day: string) => ({ id: `feedback:${day}`, kind: 'feedback', generatedAt: `${day}T09:00:00.000Z`, scope: day, itemIds: ['lex:bae'], resultStars: 2, missedItemIds: [] });
const certificate = { id: 'review:stage1', kind: 'stage-certificate', generatedAt: '2026-09-01T09:00:00.000Z', scope: 'stage1', itemIds: ['sym:g'], resultStars: 3 };

async function register(deviceId: string, learnerId: string) {
  const res = await app.request('/api/sync/learners', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ deviceId, learner: { id: learnerId, displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange' } }),
  });
  const body = (await res.json()) as { data: { device: { secret: string } } };
  return { ...json, authorization: `Device ${deviceId}:${body.data.device.secret}` };
}

async function put(learnerId: string, auth: Record<string, string>, baseRev: number, reviews: unknown[], query = '') {
  const res = await app.request(`/api/sync/learners/${learnerId}/snapshot${query}`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ ...base, baseRev, snapshot: snapshotFor(learnerId, reviews), summary }),
  });
  return { status: res.status, body: (await res.json()) as { data: { snapshot?: { reviews: Array<{ id: string }> } } } };
}

async function reviewIds(learnerId: string, auth: Record<string, string>, query = ''): Promise<string[]> {
  const res = await app.request(`/api/sync/learners/${learnerId}/snapshot${query}`, { headers: auth });
  return ((await res.json()) as { data: { snapshot: { reviews: Array<{ id: string }> } } }).data.snapshot.reviews.map((r) => r.id);
}

describe('the warm-up review gate (F-CURR-002 section 13, row CM-15)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T12:00:00.000Z'));
    await db.reset();
    claimLimiter.reset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves warm-up entries only to a reader that declares them; every other kind reaches everyone', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    expect((await put('profile:suni', auth, 0, [certificate, warmup('2026-10-21'), feedback('2026-10-21')], CAP)).status).toBe(200);
    expect(await reviewIds('profile:suni', auth, CAP)).toEqual(['review:stage1', 'warmup:2026-10-21', 'feedback:2026-10-21']);
    // A build from before CM-3b (no capability) and one from CM-3b to CM-14 never see the kind.
    expect(await reviewIds('profile:suni', auth)).toEqual(['review:stage1', 'feedback:2026-10-21']);
    expect(await reviewIds('profile:suni', auth, '?cap=curriculum')).toEqual(['review:stage1', 'feedback:2026-10-21']);
    expect(await reviewIds('profile:suni', auth, '?cap=curriculum,warmup')).toEqual(['review:stage1', 'warmup:2026-10-21', 'feedback:2026-10-21']);
  });

  it('keeps the stored warm-up entries when a build that does not read them re-uploads, and takes the list as sent from one that does', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    await put('profile:suni', auth, 0, [certificate, warmup('2026-10-20'), warmup('2026-10-21')], CAP);
    // The older build never saw them, so their absence says nothing: they stay.
    expect((await put('profile:suni', auth, 1, [certificate, feedback('2026-10-21')])).status).toBe(200);
    expect(await reviewIds('profile:suni', auth, CAP)).toEqual(['review:stage1', 'feedback:2026-10-21', 'warmup:2026-10-20', 'warmup:2026-10-21']);
    // An entry the older build sends with a warm-up id it cannot hold is never doubled.
    expect((await put('profile:suni', auth, 2, [certificate])).status).toBe(200);
    expect(await reviewIds('profile:suni', auth, CAP)).toEqual(['review:stage1', 'warmup:2026-10-20', 'warmup:2026-10-21']);
    // A build that reads the kind sends the whole list: what it leaves out goes (a profile reset, the retention).
    expect((await put('profile:suni', auth, 3, [certificate], CAP)).status).toBe(200);
    expect(await reviewIds('profile:suni', auth, CAP)).toEqual(['review:stage1']);
  });

  it('a 409 hands the stored copy back without warm-up entries to a writer that does not declare them', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    await put('profile:suni', auth, 0, [certificate, warmup('2026-10-21')], CAP);
    const old = await put('profile:suni', auth, 0, [certificate]);
    expect(old.status).toBe(409);
    expect(old.body.data.snapshot?.reviews.map((r) => r.id)).toEqual(['review:stage1']);
    const fresh = await put('profile:suni', auth, 0, [certificate], CAP);
    expect(fresh.status).toBe(409);
    expect(fresh.body.data.snapshot?.reviews.map((r) => r.id)).toEqual(['review:stage1', 'warmup:2026-10-21']);
  });

  it('the Rescue Code claim hands warm-up entries only to a device that declares them', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    await put('profile:suni', auth, 0, [certificate, warmup('2026-10-21')], CAP);
    const issue = async () => {
      const issued = await app.request('/api/recovery/issue', { method: 'POST', headers: auth, body: JSON.stringify({ learnerId: 'profile:suni' }) });
      return ((await issued.json()) as { data: { code: string } }).data.code;
    };
    const claim = async (query: string) => {
      const res = await app.request(`/api/recovery/claim${query}`, { method: 'POST', headers: json, body: JSON.stringify({ code: await issue(), deviceId: DEVICE_B }) });
      expect(res.status).toBe(200);
      return ((await res.json()) as { data: { snapshot: { snapshot: { reviews: Array<{ id: string }> } } } }).data.snapshot.snapshot.reviews.map((r) => r.id);
    };
    expect(await claim('')).toEqual(['review:stage1']);
    expect(await claim(CAP)).toEqual(['review:stage1', 'warmup:2026-10-21']);
  });

  it('keeps warm-up and Try these again entries for 14 local days after the newest of their kind, on every write', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    const sent = [certificate, warmup('2026-10-01'), warmup('2026-10-08'), warmup('2026-10-21'), feedback('2026-08-31'), feedback('2026-09-14')];
    expect((await put('profile:suni', auth, 0, sent, CAP)).status).toBe(200);
    expect(await reviewIds('profile:suni', auth, CAP)).toEqual(['review:stage1', 'warmup:2026-10-08', 'warmup:2026-10-21', 'feedback:2026-09-14']);
    // An older build that still holds a pruned Try these again entry cannot bring it back.
    expect((await put('profile:suni', auth, 1, [certificate, feedback('2026-08-31'), feedback('2026-09-14')])).status).toBe(200);
    expect(await reviewIds('profile:suni', auth, CAP)).toEqual(['review:stage1', 'feedback:2026-09-14', 'warmup:2026-10-08', 'warmup:2026-10-21']);
  });
});

describe('reviewCapsOf', () => {
  it('reads the declared capabilities from repeated and comma-joined query values', async () => {
    const { reviewCapsOf } = await import('../lib/review-kinds');
    expect([...reviewCapsOf(['curriculum,warmup'])].sort()).toEqual(['curriculum', 'warmup']);
    expect([...reviewCapsOf(['curriculum', ' warmup '])].sort()).toEqual(['curriculum', 'warmup']);
    expect(reviewCapsOf(undefined).size).toBe(0);
    expect(reviewCapsOf(['']).size).toBe(0);
  });
});
