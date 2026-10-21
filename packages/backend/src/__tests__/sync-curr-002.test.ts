import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { claimLimiter } from '../routes/recovery';
import { testDb as db } from './helpers/db';

/*
 * F-CURR-002 row CM-3b, Worker first: the snapshot routes accept the new
 * review kinds and fields, drop an unknown kind per entry, and keep what an
 * older build leaves out, before any app writes them.
 */

const DEVICE_A = 'device-aaaaaaaa';
const DEVICE_B = 'device-bbbbbbbb';
const json = { 'content-type': 'application/json' };
const base = { schemaVer: 1, contentVer: '2026.10' };

const snapshotFor = (profileId: string, extra: Record<string, unknown> = {}) => ({
  profileId,
  updatedAt: '2026-10-21T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
  ...extra,
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
const review = (id: string, kind: string) => ({ id, kind, generatedAt: '2026-10-21T00:00:00.000Z', scope: 'stage2', itemIds: ['lex:sagwa'], resultStars: 2 });
const mixedReviews = [review('review:a', 'daily'), review('review:b', 'cell-check'), review('review:c', 'warmup'), review('review:d', 'pack-check'), { id: 'review:e', kind: 'feedback' }];
const keptIds = ['review:a', 'review:b', 'review:c'];
const fields = {
  cellBest: { 'letters-s2': 2 },
  cellCheckAt: { 'letters-s2': '2026-10-20T09:00:00.000Z' },
  stageCheckAt: { stage2: '2026-10-21T09:00:00.000Z' },
  testedOut: { 'life-s3': '2026-10-19T09:00:00.000Z' },
  goals: { daily: 6, weeklyDays: 5, setAt: '2026-10-18T09:00:00.000Z' },
  dayLog: { '2026-10-21': { 'install-a': 6 } },
  streakLocal: { run: 4, lastDay: '2026-10-21' },
  streakBest: 9,
  stamps: { 'first-cell': '2026-10-15T09:00:00.000Z' },
  memSeededAt: '2026-10-14T09:00:00.000Z',
};
const memory = { wordsKnown: 42, readyToRefresh: 7, cellBestCounts: [5, 2, 1], stageChecks: 1, weekPoints: 18, topDue: ['lex:sagwa'] };

async function register(deviceId: string, learnerId: string) {
  const res = await app.request('/api/sync/learners', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ deviceId, learner: { id: learnerId, displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange' } }),
  });
  const body = (await res.json()) as { data: { device: { secret: string } } };
  return { ...json, authorization: `Device ${deviceId}:${body.data.device.secret}` };
}

async function put(learnerId: string, auth: Record<string, string>, body: Record<string, unknown>) {
  const res = await app.request(`/api/sync/learners/${learnerId}/snapshot`, { method: 'PUT', headers: auth, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as { data: Record<string, unknown> } };
}

type Stored = { snapshot: Record<string, unknown> & { reviews: Array<{ id: string }>; sessions: Array<Record<string, unknown>> }; summary: Record<string, unknown> };
async function get(learnerId: string, auth: Record<string, string>): Promise<Stored> {
  const res = await app.request(`/api/sync/learners/${learnerId}/snapshot`, { headers: auth });
  return ((await res.json()) as { data: Stored }).data;
}

describe('/api/sync snapshot, F-CURR-002 section 4.8 (Worker first)', () => {
  beforeEach(async () => {
    // The Worker's time guard reads the clock: pin it after every date in these fixtures.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T12:00:00.000Z'));
    await db.reset();
    claimLimiter.reset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts cell-check and warmup reviews and drops an unknown kind per entry, on PUT and then on GET', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    const res = await put('profile:suni', auth, { ...base, baseRev: 0, snapshot: snapshotFor('profile:suni', { reviews: mixedReviews, streakDays: 2 }), summary });
    expect(res.status).toBe(200);
    const got = await get('profile:suni', auth);
    expect(got.snapshot.reviews.map((r) => r.id)).toEqual(keptIds);
    expect(got.snapshot.streakDays).toBe(2);
  });

  it('stores every new field and summary.memory, and keeps them all when an older build re-uploads without them', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    const session = { id: 'session:1', profileId: 'profile:suni', startedAt: '2026-10-21T23:30:00.000Z', episodesTouched: [], localDay: '2026-10-22' };
    expect((await put('profile:suni', auth, { ...base, baseRev: 0, snapshot: snapshotFor('profile:suni', { ...fields, sessions: [session] }), summary: { ...summary, memory } })).status).toBe(200);
    const first = await get('profile:suni', auth);
    expect(first.snapshot).toMatchObject(fields);
    expect(first.summary.memory).toEqual(memory);

    // An older build: no new keys, and its schema stripped the session's localDay.
    const { localDay: _dropped, ...oldSession } = session;
    const old = await put('profile:suni', auth, { ...base, baseRev: 1, snapshot: snapshotFor('profile:suni', { sessions: [oldSession], streakDays: 1 }), summary });
    expect(old.status).toBe(200);
    const after = await get('profile:suni', auth);
    expect(after.snapshot).toMatchObject({ ...fields, streakDays: 1 });
    expect(after.snapshot.sessions[0]?.localDay).toBe('2026-10-22');
    expect(after.summary.memory).toEqual(memory);
  });

  it('an older-client snapshot round-trips unchanged, with no new key invented', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    const legacy = snapshotFor('profile:suni', { reviews: [review('review:a', 'stage-certificate')] });
    expect((await put('profile:suni', auth, { ...base, baseRev: 0, snapshot: legacy, summary })).status).toBe(200);
    const got = await get('profile:suni', auth);
    for (const key of Object.keys(fields)) expect(got.snapshot).not.toHaveProperty(key);
    expect(got.summary).not.toHaveProperty('memory');
    expect(got.snapshot).toMatchObject(legacy);
  });

  it('a sync from an older build never lowers streakBest or a cell level', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    await put('profile:suni', auth, { ...base, baseRev: 0, snapshot: snapshotFor('profile:suni', { streakBest: 12, cellBest: { 'letters-s2': 3 } }), summary });
    await put('profile:suni', auth, { ...base, baseRev: 1, snapshot: snapshotFor('profile:suni', { streakBest: 4, cellBest: { 'letters-s2': 1 } }), summary });
    const got = await get('profile:suni', auth);
    expect(got.snapshot.streakBest).toBe(12);
    expect(got.snapshot.cellBest).toEqual({ 'letters-s2': 3 });
  });

  it('reads malformed new values as absent instead of a 422, and keeps the stored copy', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    await put('profile:suni', auth, { ...base, baseRev: 0, snapshot: snapshotFor('profile:suni', fields), summary });
    const res = await put('profile:suni', auth, {
      ...base,
      baseRev: 1,
      snapshot: snapshotFor('profile:suni', { goals: { daily: 4 }, streakLocal: 'x', dayLog: [], cellBest: { 'letters-s2': 9 } }),
      summary: { ...summary, memory: { wordsKnown: -1 } },
    });
    expect(res.status).toBe(200);
    const got = await get('profile:suni', auth);
    expect(got.snapshot).toMatchObject(fields);
    expect(got.summary).not.toHaveProperty('memory');
  });

  it('a PUT without a reviews list is still a 422 and never clears the stored reviews', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    await put('profile:suni', auth, { ...base, baseRev: 0, snapshot: snapshotFor('profile:suni', { reviews: mixedReviews }), summary });
    const { reviews: _none, ...noReviews } = snapshotFor('profile:suni');
    for (const snapshot of [noReviews, { ...noReviews, reviews: null }, { ...noReviews, reviews: 'x' }]) {
      expect((await put('profile:suni', auth, { ...base, baseRev: 1, snapshot, summary })).status).toBe(422);
    }
    const got = await get('profile:suni', auth);
    expect(got.snapshot.reviews.map((r) => r.id)).toEqual(keptIds);
  });

  it('a wrong device clock never evicts real days, freezes the streak or pins the goals (time guard)', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    const realDays = { '2026-10-20': { 'install-a': 5 }, '2026-10-21': { 'install-a': 7 } };
    await put('profile:suni', auth, { ...base, baseRev: 0, snapshot: snapshotFor('profile:suni', { dayLog: realDays, streakLocal: { run: 30, lastDay: '2026-10-21' }, streakBest: 30 }), summary });
    // A tablet whose clock reads 2099.
    const wrong = await put('profile:suni', auth, {
      ...base,
      baseRev: 1,
      snapshot: snapshotFor('profile:suni', {
        dayLog: { '2099-01-01': { 'install-b': 1 }, '2026-10-23': { 'install-b': 2 }, '2026-10-22': { 'install-b': 3 } },
        streakLocal: { run: 1, lastDay: '2099-01-01' },
        goals: { daily: 10, weeklyDays: 7, setAt: '2099-01-01T00:00:00.000Z' },
        stamps: { 'first-cell': '2099-01-01T00:00:00.000Z' },
      }),
      summary,
    });
    expect(wrong.status).toBe(200);
    const got = await get('profile:suni', auth);
    // 2026-10-23 can already be a local day (UTC+14); 2099 cannot.
    expect(got.snapshot.dayLog).toEqual({ ...realDays, '2026-10-22': { 'install-b': 3 }, '2026-10-23': { 'install-b': 2 } });
    expect(got.snapshot.streakLocal).toEqual({ run: 30, lastDay: '2026-10-21' });
    expect(got.snapshot.goals).toEqual({ daily: 10, weeklyDays: 7, setAt: '2026-10-22T12:00:00.000Z' });
    expect(got.snapshot.stamps).toEqual({ 'first-cell': '2026-10-22T12:00:00.000Z' });

    // A later real goal change on a phone with a right clock wins.
    vi.setSystemTime(new Date('2026-10-22T13:00:00.000Z'));
    const goals = { daily: 3, weeklyDays: 3, setAt: '2026-10-22T13:00:00.000Z' };
    expect((await put('profile:suni', auth, { ...base, baseRev: 2, snapshot: snapshotFor('profile:suni', { goals, stamps: { 'first-cell': '2026-10-22T12:30:00.000Z' } }), summary })).status).toBe(200);
    const later = await get('profile:suni', auth);
    expect(later.snapshot.goals).toEqual(goals);
    expect(later.snapshot.stamps).toEqual({ 'first-cell': '2026-10-22T12:00:00.000Z' });
  });

  it('the Rescue Code claim hands back the stored reviews and fields to the new device', async () => {
    const auth = await register(DEVICE_A, 'profile:suni');
    await put('profile:suni', auth, { ...base, baseRev: 0, snapshot: snapshotFor('profile:suni', { ...fields, reviews: mixedReviews }), summary });
    const issued = await app.request('/api/recovery/issue', { method: 'POST', headers: auth, body: JSON.stringify({ learnerId: 'profile:suni' }) });
    const code = ((await issued.json()) as { data: { code: string } }).data.code;
    const res = await app.request('/api/recovery/claim', { method: 'POST', headers: json, body: JSON.stringify({ code, deviceId: DEVICE_B }) });
    expect(res.status).toBe(200);
    const data = ((await res.json()) as { data: { snapshot: { snapshot: Stored['snapshot'] } } }).data;
    expect(data.snapshot.snapshot.reviews.map((r) => r.id)).toEqual(keptIds);
    expect(data.snapshot.snapshot).toMatchObject(fields);
  });
});
