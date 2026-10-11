import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { hashSecret, parseDeviceHeader } from '../lib/device-auth';
import { testDb as db } from './helpers/db';

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
  beforeEach(async () => db.reset());

  it('registers a learner keeping the client id and returns a one-time device secret', async () => {
    const r = await register(DEVICE_A, 'profile:local-1');
    expect(r.status).toBe(201);
    expect(r.learnerId).toBe('profile:local-1');
    expect(r.secret).toHaveLength(64);
    expect((await db.getDevice('profile:local-1', DEVICE_A))?.secretHash).toBe(await hashSecret(r.secret));
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
    expect((await db.getLearner(r.learnerId))?.lastActiveAt).toBe(merged.json.data?.updatedAt);
  });

  it('concurrent PUTs from two devices on the same base rev: exactly one wins, the other gets 409 (SYNC-1)', async () => {
    const r = await register(DEVICE_A);
    const secretB = 'b'.repeat(64);
    await db.putDevice({ learnerId: r.learnerId, deviceId: DEVICE_B, secretHash: await hashSecret(secretB), scope: 'full', createdAt: 't', lastSeenAt: 't' });
    const base = { summary, schemaVer: 1, contentVer: '2026.09' };
    const fromA = { ...base, snapshot: snapshotFor(r.learnerId, [{ questId: 'quest:a', stars: 3 }]) };
    const fromB = { ...base, snapshot: snapshotFor(r.learnerId, [{ questId: 'quest:b', stars: 1 }]) };

    // Two Worker isolates: both read the row before either writes. The barrier
    // holds every snapshot read until both requests have made theirs.
    const read = db.getSnapshot.bind(db);
    for (const baseRev of [0, 1]) {
      let arrived = 0;
      let release = (): void => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      db.getSnapshot = async (learnerId) => {
        const row = await read(learnerId);
        arrived += 1;
        if (arrived >= 2) release();
        await gate;
        return row;
      };
      const [a, b] = await Promise.all([
        put(r.learnerId, deviceAuth(DEVICE_A, r.secret), { ...fromA, baseRev }),
        put(r.learnerId, deviceAuth(DEVICE_B, secretB), { ...fromB, baseRev }),
      ]).finally(() => {
        db.getSnapshot = read;
      });
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const winner = a.status === 200 ? 'quest:a' : 'quest:b';
      const loser = a.status === 200 ? b : a;
      // the loser sees the winner's copy and the rev to merge onto
      const conflict = loser.json as unknown as { data: { rev: number; snapshot: { quests: Array<{ questId: string }> } } };
      expect(conflict.data.rev).toBe(baseRev + 1);
      expect(conflict.data.snapshot.quests[0]?.questId).toBe(winner);
      const stored = await db.getSnapshot(r.learnerId);
      expect(stored?.rev).toBe(baseRev + 1);
      expect((stored?.payload as { quests: Array<{ questId: string }> }).quests[0]?.questId).toBe(winner);
    }
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

describe('/api/sync Hangul Check fields (F-QUEST-002 §3.9, Q-10a)', () => {
  beforeEach(() => db.reset());

  const anchor = { met: true, checkedAt: '2026-10-10T00:00:00.000Z', tricky: ['ㅌ', 'ㄴ/final'] };
  const review = {
    id: 'review:stage1:2026-10-10T00:00:00.000Z',
    kind: 'stage-certificate',
    generatedAt: '2026-10-10T00:00:00.000Z',
    scope: 'stage1',
    itemIds: ['jamo:giyeok', 'jamo:tieut'],
    resultStars: 2,
  };
  const withReviews = (profileId: string, reviews: unknown[]) => ({ ...snapshotFor(profileId), reviews });
  const base = { schemaVer: 1, contentVer: '2026.10' };

  async function getSnapshot(learnerId: string, auth: Record<string, string>) {
    const res = await app.request(`/api/sync/learners/${learnerId}/snapshot`, { headers: auth });
    return (await res.json()) as { data: { snapshot: { reviews: Array<Record<string, unknown>> }; summary: Record<string, unknown> } };
  }

  it('round-trips ReviewEntry.missedItemIds and ProgressSummary.stage1Anchor', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const res = await put(r.learnerId, auth, {
      ...base,
      baseRev: 0,
      snapshot: withReviews(r.learnerId, [{ ...review, missedItemIds: ['jamo:tieut'] }, { ...review, id: 'review:stage1:clean', missedItemIds: [] }]),
      summary: { ...summary, stage1Anchor: anchor },
    });
    expect(res.status).toBe(200);

    const got = await getSnapshot(r.learnerId, auth);
    expect(got.data.snapshot.reviews[0]?.missedItemIds).toEqual(['jamo:tieut']);
    expect(got.data.snapshot.reviews[1]?.missedItemIds).toEqual([]);
    expect(got.data.summary.stage1Anchor).toEqual(anchor);
  });

  it('an old client (neither field) still uploads and reads back without them', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const res = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withReviews(r.learnerId, [review]), summary });
    expect(res.status).toBe(200);

    const got = await getSnapshot(r.learnerId, auth);
    expect(got.data.snapshot.reviews[0]).toEqual(review);
    expect(got.data.summary).not.toHaveProperty('stage1Anchor');
  });

  it('a conflict response carries the stored fields back for the merge', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, {
      ...base,
      baseRev: 0,
      snapshot: withReviews(r.learnerId, [{ ...review, missedItemIds: ['jamo:tieut'] }]),
      summary: { ...summary, stage1Anchor: anchor },
    });
    const stale = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary });
    expect(stale.status).toBe(409);
    const body = stale.json as unknown as { data: { snapshot: { reviews: Array<Record<string, unknown>> }; summary: Record<string, unknown> } };
    expect(body.data.snapshot.reviews[0]?.missedItemIds).toEqual(['jamo:tieut']);
    expect(body.data.summary.stage1Anchor).toEqual(anchor);
  });

  it('rejects malformed values with 422 and stores nothing', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const badIds = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withReviews(r.learnerId, [{ ...review, missedItemIds: [1] }]), summary });
    expect(badIds.status).toBe(422);
    const badAnchor = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary: { ...summary, stage1Anchor: { met: 'yes', checkedAt: 'x', tricky: [] } } });
    expect(badAnchor.status).toBe(422);
    expect(await db.getSnapshot(r.learnerId)).toBeNull();
  });
});

describe('placements and summary.placement (F-PLC-001 section 3.8, the additive preserve rule)', () => {
  const base = { schemaVer: 1, contentVer: '2026.10' };
  const strands = { 'hangul-recognition': 'secure', 'sound-letter': 'getting-there', 'syllable-reading': 'not-yet', vocabulary: 'not-tested', sentences: 'not-tested' };
  const placementResult = {
    id: 'placement:2026-10-10-a',
    startedAt: '2026-10-10T10:00:00.000Z',
    completedAt: '2026-10-10T10:05:00.000Z',
    source: 'onboarding',
    testLocale: 'en',
    length: 'full',
    revealMode: 'tap',
    bankVersion: 1,
    contentVer: '2026.10',
    responses: [{ questionId: 'pitem:recog-1', outcome: 'correct', chosenOptionId: 'a', assisted: false, ms: 1500 }],
    gates: [{ gate: 'recog', form: 'decode', asked: 3, correct: 3, assisted: 0, result: 'pass' }],
    strands,
    level: { stage: 'stage1', band: 1 },
    oralStage: null,
    beyondContent: false,
    startQuestId: 'quest:stage1-03',
    placedOutQuestIds: ['quest:stage1-01', 'quest:stage1-02'],
    priorityTokens: ['sym:ㅓ'],
    needsStage: null,
    stopReason: 'complete',
  };
  const placementSummary = { takenAt: '2026-10-10T10:05:00.000Z', level: { stage: 'stage1', band: 1 }, oralStage: null, strands, beyondContent: false, overridden: false };
  const withPlacements = (profileId: string, placements: unknown[], quests: Array<{ questId: string; stars: 0 | 1 | 2 | 3 }> = []) => ({ ...snapshotFor(profileId, quests), placements });

  type Stored = { data: { rev: number; snapshot: { placements?: unknown[]; quests: unknown[] }; summary: Record<string, unknown> } };
  async function getStored(learnerId: string, auth: Record<string, string>) {
    const res = await app.request(`/api/sync/learners/${learnerId}/snapshot`, { headers: auth });
    return (await res.json()) as Stored;
  }

  it('round-trips placements and summary.placement', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const res = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withPlacements(r.learnerId, [placementResult]), summary: { ...summary, placement: placementSummary } });
    expect(res.status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect(got.data.snapshot.placements).toEqual([placementResult]);
    expect(got.data.summary.placement).toEqual(placementSummary);
  });

  it('round-trips a long Deep result with its mode (42 responses, 14 rows; F-PLC-001 P17), next to a legacy result without one', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const row = (gate: string, form: string) => ({ gate, form, asked: 3, correct: 3, assisted: 0, result: 'pass' });
    const deepRows = [
      row('recog', 'decode'),
      ...['sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc'].flatMap((g) => [row(g, 'decode'), row(g, 'decode')]),
      row('vocab', 'read'),
      row('vocab', 'read'),
      row('sentence', 'read'),
      row('sentence', 'read'),
      row('sentence', 'oral'),
    ];
    const deep = {
      ...placementResult,
      id: 'placement:2026-10-11-deep',
      completedAt: '2026-10-11T10:20:00.000Z',
      length: 'full',
      mode: 'deep',
      responses: Array.from({ length: 42 }, (_, i) => ({ ...placementResult.responses[0], questionId: `pitem:deep-${i}` })),
      gates: deepRows,
      level: { stage: 'stage3', band: 0 },
      oralStage: 'stage3',
    };
    const short = { ...placementResult, id: 'placement:2026-10-11-short', length: 'quick', mode: 'short' };
    const res = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withPlacements(r.learnerId, [placementResult, short, deep]), summary: { ...summary, placement: placementSummary } });
    expect(res.status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect(got.data.snapshot.placements).toEqual([placementResult, short, deep]);
    const stored = got.data.snapshot.placements as Array<{ mode?: string; responses: unknown[]; gates: unknown[] }>;
    expect(stored[0]).not.toHaveProperty('mode');
    expect(stored[2]?.mode).toBe('deep');
    expect(stored[2]?.responses).toHaveLength(42);
    expect(stored[2]?.gates).toHaveLength(14);
    // The summary carries no mode (statuses and the level only).
    expect(got.data.summary.placement).toEqual(placementSummary);
  });

  it('an old client (neither field) is accepted exactly as today and reads back with an empty list', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const res = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary });
    expect(res.status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect(got.data.snapshot.placements).toEqual([]);
    expect(got.data.summary).not.toHaveProperty('placement');
  });

  it('preserve rule: an old client re-uploading without the fields cannot erase them', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withPlacements(r.learnerId, [placementResult]), summary: { ...summary, placement: placementSummary } });

    const old = await put(r.learnerId, auth, {
      ...base,
      baseRev: 1,
      snapshot: snapshotFor(r.learnerId, [{ questId: 'quest:a', stars: 3 }]),
      summary: { ...summary, streakDays: 4 },
    });
    expect(old.status).toBe(200);
    expect(old.json.data?.rev).toBe(2);

    const got = await getStored(r.learnerId, auth);
    expect(got.data.snapshot.placements).toEqual([placementResult]);
    expect(got.data.summary.placement).toEqual(placementSummary);
    // everything the old client did send is taken as sent
    expect(got.data.snapshot.quests).toHaveLength(1);
    expect(got.data.summary.streakDays).toBe(4);
  });

  it('a client that sends a longer list replaces the stored one; the server never merges lists', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withPlacements(r.learnerId, [placementResult]), summary: { ...summary, placement: placementSummary } });
    const second = { ...placementResult, id: 'placement:2026-10-11-b', completedAt: '2026-10-11T10:05:00.000Z' };
    const next = { ...placementSummary, takenAt: second.completedAt, overridden: true };
    expect((await put(r.learnerId, auth, { ...base, baseRev: 1, snapshot: withPlacements(r.learnerId, [placementResult, second]), summary: { ...summary, placement: next } })).status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect(got.data.snapshot.placements).toEqual([placementResult, second]);
    expect(got.data.summary.placement).toEqual(next);
  });

  it('a 409 hands the stored placements back for the merge', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withPlacements(r.learnerId, [placementResult]), summary: { ...summary, placement: placementSummary } });
    const stale = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary });
    expect(stale.status).toBe(409);
    const body = stale.json as unknown as { data: { snapshot: { placements: unknown[] }; summary: Record<string, unknown> } };
    expect(body.data.snapshot.placements).toEqual([placementResult]);
    expect(body.data.summary.placement).toEqual(placementSummary);
  });

  it('rejects malformed placements and a malformed summary.placement with 422 and stores nothing', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const badResult = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withPlacements(r.learnerId, [{ ...placementResult, id: 'review:x' }]), summary });
    expect(badResult.status).toBe(422);
    const tooMany = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withPlacements(r.learnerId, [{ ...placementResult, responses: Array(49).fill(placementResult.responses[0]) }]), summary });
    expect(tooMany.status).toBe(422);
    const tooManyRows = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withPlacements(r.learnerId, [{ ...placementResult, gates: Array(17).fill(placementResult.gates[0]) }]), summary });
    expect(tooManyRows.status).toBe(422);
    const badMode = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withPlacements(r.learnerId, [{ ...placementResult, mode: 'quick' }]), summary });
    expect(badMode.status).toBe(422);
    const badLength = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withPlacements(r.learnerId, [{ ...placementResult, length: 'deep' }]), summary });
    expect(badLength.status).toBe(422);
    const badSummary = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary: { ...summary, placement: { ...placementSummary, level: { stage: 'stage1', band: 9 } } } });
    expect(badSummary.status).toBe(422);
    expect(await db.getSnapshot(r.learnerId)).toBeNull();
  });

  it('still strips unknown keys, including per-question data smuggled into summary.placement', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, {
      ...base,
      baseRev: 0,
      snapshot: { ...withPlacements(r.learnerId, [placementResult]), extra: 1 },
      summary: { ...summary, extra: 1, placement: { ...placementSummary, responses: [{ questionId: 'pitem:x' }], asked: 12 } },
    });
    const got = await getStored(r.learnerId, auth);
    expect(got.data.snapshot).not.toHaveProperty('extra');
    expect(got.data.summary).not.toHaveProperty('extra');
    expect(got.data.summary.placement).toEqual(placementSummary);
  });
});

describe('stageDoneAt (F-ROUTE-001 section 3.15, the stage latch and the additive preserve rule)', () => {
  beforeEach(() => db.reset());
  const base = { schemaVer: 1, contentVer: '2026.10' };
  const latch = { stage1: '2026-10-11T09:30:00.000Z' };
  const withLatch = (profileId: string, stageDoneAt: unknown, quests: Array<{ questId: string; stars: 0 | 1 | 2 | 3 }> = []) => ({ ...snapshotFor(profileId, quests), stageDoneAt });

  type Stored = { data: { rev: number; snapshot: { stageDoneAt?: Record<string, string>; quests: unknown[] }; summary: Record<string, unknown> } };
  async function getStored(learnerId: string, auth: Record<string, string>) {
    const res = await app.request(`/api/sync/learners/${learnerId}/snapshot`, { headers: auth });
    return (await res.json()) as Stored;
  }

  it('round-trips the latch', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    expect((await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withLatch(r.learnerId, latch), summary })).status).toBe(200);
    expect((await getStored(r.learnerId, auth)).data.snapshot.stageDoneAt).toEqual(latch);
  });

  it('an old client (no field) is accepted exactly as today and reads back without the key', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    expect((await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary })).status).toBe(200);
    expect((await getStored(r.learnerId, auth)).data.snapshot).not.toHaveProperty('stageDoneAt');
  });

  it('preserve rule: an old client re-uploading without the field cannot erase an earned latch', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withLatch(r.learnerId, latch), summary });

    const old = await put(r.learnerId, auth, { ...base, baseRev: 1, snapshot: snapshotFor(r.learnerId, [{ questId: 'quest:a', stars: 3 }]), summary: { ...summary, streakDays: 4 } });
    expect(old.status).toBe(200);
    expect(old.json.data?.rev).toBe(2);

    const got = await getStored(r.learnerId, auth);
    expect(got.data.snapshot.stageDoneAt).toEqual(latch);
    // everything the old client did send is taken as sent
    expect(got.data.snapshot.quests).toHaveLength(1);
    expect(got.data.summary.streakDays).toBe(4);
  });

  it('an empty record counts as unset and keeps the stored latch', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withLatch(r.learnerId, latch), summary });
    expect((await put(r.learnerId, auth, { ...base, baseRev: 1, snapshot: withLatch(r.learnerId, {}), summary })).status).toBe(200);
    expect((await getStored(r.learnerId, auth)).data.snapshot.stageDoneAt).toEqual(latch);
  });

  it('a client that sends a latch record is unioned with the stored one (earliest time wins)', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withLatch(r.learnerId, latch), summary });
    const next = { stage1: '2026-10-12T00:00:00.000Z', stage2: '2026-11-01T08:00:00.000Z' };
    expect((await put(r.learnerId, auth, { ...base, baseRev: 1, snapshot: withLatch(r.learnerId, next), summary })).status).toBe(200);
    expect((await getStored(r.learnerId, auth)).data.snapshot.stageDoneAt).toEqual({ ...latch, stage2: next.stage2 });
  });

  it('an old build that synced without the latch and then upgraded cannot erase a latch another device earned', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    // device A (new build) latches stage2: rev 1
    const stage2 = { stage2: '2026-10-11T09:30:00.000Z' };
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withLatch(r.learnerId, stage2), summary });
    // device B (old build) uploads without the field: the preserve rule keeps stage2, rev 2
    expect((await put(r.learnerId, auth, { ...base, baseRev: 1, snapshot: snapshotFor(r.learnerId), summary })).status).toBe(200);
    // device B upgrades, latches stage1 locally and uploads at its in-sync rev without ever having seen stage2
    const stage1 = { stage1: '2026-10-12T10:00:00.000Z' };
    expect((await put(r.learnerId, auth, { ...base, baseRev: 2, snapshot: withLatch(r.learnerId, stage1), summary })).status).toBe(200);
    expect((await getStored(r.learnerId, auth)).data.snapshot.stageDoneAt).toEqual({ ...stage2, ...stage1 });
  });

  it('a 409 hands the stored latch back for the client merge', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withLatch(r.learnerId, latch), summary });
    const stale = await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary });
    expect(stale.status).toBe(409);
    const body = stale.json as unknown as { data: { snapshot: { stageDoneAt: Record<string, string> } } };
    expect(body.data.snapshot.stageDoneAt).toEqual(latch);
  });

  it('rejects a malformed latch with 422 and stores nothing', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    for (const bad of [null, ['stage1'], { stage1: 1 }]) {
      expect((await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withLatch(r.learnerId, bad), summary })).status).toBe(422);
    }
    expect(await db.getSnapshot(r.learnerId)).toBeNull();
  });

  it('keeps the placements preserve rule working next to the latch', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const stored = { ...withLatch(r.learnerId, latch), placements: [] };
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: stored, summary });
    expect((await put(r.learnerId, auth, { ...base, baseRev: 1, snapshot: snapshotFor(r.learnerId), summary })).status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect(got.data.snapshot.stageDoneAt).toEqual(latch);
    expect((got.data.snapshot as { placements?: unknown[] }).placements).toEqual([]);
  });
});

describe('selfRoute and summary.selfRoute (F-PLAN-002 section 3.5, the additive preserve rule)', () => {
  beforeEach(() => db.reset());
  const base = { schemaVer: 1, contentVer: '2026.10' };
  const meta = {
    kind: 'curriculum',
    generatorVersion: 1,
    catalogVersion: 1,
    params: { audience: 'self', level: { stage: 'stage1', band: 0 }, startDate: '2026-10-12', weeks: 1, sessionsPerWeek: 1, minutesPerSession: 15, unlockedStages: ['stage1'] },
    weeks: [{ index: 1, startDate: '2026-10-12', kind: 'learn', focus: { episodeId: 'episode:stage1-letters', storyIds: [], festival: null }, extras: [] }],
    horizonDays: 7,
    repacedAt: null,
  };
  const route = { id: 'route:abc', createdAt: '2026-10-12T08:00:00.000Z', updatedAt: '2026-10-12T08:00:00.000Z', archivedAt: null, meta, items: [{ kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-10-12', week: 1 }] };
  const counts = { done: 0, total: 1, notReady: 0, weeks: 1, endsOn: '2026-10-18' };
  const withRoute = (profileId: string, selfRoute: unknown) => ({ ...snapshotFor(profileId), selfRoute });

  type Stored = { data: { rev: number; snapshot: { selfRoute?: unknown }; summary: Record<string, unknown> } };
  async function getStored(learnerId: string, auth: Record<string, string>) {
    const res = await app.request(`/api/sync/learners/${learnerId}/snapshot`, { headers: auth });
    return (await res.json()) as Stored;
  }

  it('round-trips a route and its counts', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    expect((await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withRoute(r.learnerId, route), summary: { ...summary, selfRoute: counts } })).status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect(got.data.snapshot.selfRoute).toEqual({ ...route, meta: { ...meta, params: { ...meta.params, daysOff: [], goals: { focus: 'balanced' }, includeComingSoon: true, culturalAnchors: true } } });
    expect(got.data.summary.selfRoute).toEqual(counts);
  });

  it('stores an old client (no field) with selfRoute null and no summary counts', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    expect((await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary })).status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect(got.data.snapshot.selfRoute).toBeNull();
    expect(got.data.summary).not.toHaveProperty('selfRoute');
  });

  it('preserve rule: an older build re-uploading after a merge cannot erase the route or its counts', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withRoute(r.learnerId, route), summary: { ...summary, selfRoute: counts } });
    const old = await put(r.learnerId, auth, { ...base, baseRev: 1, snapshot: snapshotFor(r.learnerId, [{ questId: 'quest:a', stars: 3 }]), summary: { ...summary, streakDays: 4 } });
    expect(old.status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect((got.data.snapshot.selfRoute as { id: string }).id).toBe('route:abc');
    expect(got.data.summary.selfRoute).toEqual(counts);
    expect(got.data.summary.streakDays).toBe(4);
  });

  it('an explicit null never replaces a stored route; an archived route does', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withRoute(r.learnerId, route), summary: { ...summary, selfRoute: counts } });
    expect((await put(r.learnerId, auth, { ...base, baseRev: 1, snapshot: withRoute(r.learnerId, null), summary })).status).toBe(200);
    expect(((await getStored(r.learnerId, auth)).data.snapshot.selfRoute as { id: string }).id).toBe('route:abc');
    const archived = { ...route, archivedAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' };
    expect((await put(r.learnerId, auth, { ...base, baseRev: 2, snapshot: withRoute(r.learnerId, archived), summary })).status).toBe(200);
    expect(((await getStored(r.learnerId, auth)).data.snapshot.selfRoute as { archivedAt: string }).archivedAt).toBe('2026-11-01T00:00:00.000Z');
  });

  it('drops a malformed route or malformed counts and stores the rest of the upload', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const bad = await put(r.learnerId, auth, {
      ...base,
      baseRev: 0,
      snapshot: { ...snapshotFor(r.learnerId, [{ questId: 'quest:a', stars: 3 }]), selfRoute: { ...route, id: 'plan:x' } },
      summary: { ...summary, streakDays: 2, selfRoute: { ...counts, weeks: 0 } },
    });
    expect(bad.status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect(got.data.rev).toBe(1);
    expect(got.data.snapshot.selfRoute).toBeNull();
    expect((got.data.snapshot as { quests: unknown[] }).quests).toHaveLength(1);
    expect(got.data.summary.streakDays).toBe(2);
    expect(got.data.summary).not.toHaveProperty('selfRoute');
  });

  it('a malformed route never replaces a stored one (the preserve rule keeps it and its counts)', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: withRoute(r.learnerId, route), summary: { ...summary, selfRoute: counts } });
    expect((await put(r.learnerId, auth, { ...base, baseRev: 1, snapshot: withRoute(r.learnerId, { ...route, items: 'none' }), summary })).status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect((got.data.snapshot.selfRoute as { id: string }).id).toBe('route:abc');
    expect(got.data.summary.selfRoute).toEqual(counts);
  });
});

describe('summary.journey (F-ROUTE-001 section 3.12, R-8: tolerant, no preserve entry)', () => {
  beforeEach(() => db.reset());
  const base = { schemaVer: 1, contentVer: '2026.10' };
  const journey = {
    v: 1,
    here: 'stage1',
    stages: [
      { stage: 'stage1', state: 'open', done: 4, known: 0, total: 8 },
      { stage: 'stage2', state: 'open', done: 0, known: 0, total: 2 },
    ],
  };

  type Stored = { data: { rev: number; snapshot: { quests: unknown[] }; summary: Record<string, unknown> } };
  async function getStored(learnerId: string, auth: Record<string, string>) {
    const res = await app.request(`/api/sync/learners/${learnerId}/snapshot`, { headers: auth });
    return (await res.json()) as Stored;
  }

  it('round-trips the journey with schemaVersion 1', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    expect((await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary: { ...summary, journey } })).status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect(got.data.summary.journey).toEqual(journey);
    expect(got.data.summary.schemaVersion).toBe(1);
  });

  it('an old client (no journey) is accepted exactly as today and reads back without the key', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    expect((await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary })).status).toBe(200);
    expect((await getStored(r.learnerId, auth)).data.summary).not.toHaveProperty('journey');
  });

  it('malformed journey: PUT still 200, journey dropped, the rest of the upload stored', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const malformed = [
      { ...journey, v: 2 },
      { ...journey, stages: [{ stage: 'stage1', state: 'open', done: -1, known: 0, total: 8 }] },
      'journey',
      // Oversized: dropped like any malformed journey, so no roster copies it.
      { ...journey, stages: Array.from({ length: 17 }, () => journey.stages[0]) },
    ];
    let rev = 0;
    for (const bad of malformed) {
      const res = await put(r.learnerId, auth, {
        ...base,
        baseRev: rev,
        snapshot: snapshotFor(r.learnerId, [{ questId: 'quest:a', stars: 3 }]),
        summary: { ...summary, streakDays: 3, journey: bad },
      });
      expect(res.status).toBe(200);
      rev += 1;
      const got = await getStored(r.learnerId, auth);
      expect(got.data.rev).toBe(rev);
      expect(got.data.summary).not.toHaveProperty('journey');
      expect(got.data.summary.streakDays).toBe(3);
      expect(got.data.snapshot.quests).toHaveLength(1);
    }
  });

  it('strips per-quest detail smuggled into the journey', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    const smuggled = { ...journey, learnerType: 'self', stages: [{ ...journey.stages[0], questIds: ['quest:secret'] }] };
    expect((await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary: { ...summary, journey: smuggled } })).status).toBe(200);
    const got = await getStored(r.learnerId, auth);
    expect(got.data.summary.journey).toEqual({ ...journey, stages: [journey.stages[0]] });
    expect(JSON.stringify(got.data.summary)).not.toContain('secret');
    expect(JSON.stringify(got.data.summary)).not.toContain('learnerType');
  });

  it('has no preserve entry: every upload carries its own journey, so an upload without one replaces it', async () => {
    const r = await register(DEVICE_A);
    const auth = deviceAuth(DEVICE_A, r.secret);
    await put(r.learnerId, auth, { ...base, baseRev: 0, snapshot: snapshotFor(r.learnerId), summary: { ...summary, journey } });
    const next = { ...journey, stages: [{ ...journey.stages[0], done: 5 }] };
    await put(r.learnerId, auth, { ...base, baseRev: 1, snapshot: snapshotFor(r.learnerId), summary: { ...summary, journey: next } });
    expect((await getStored(r.learnerId, auth)).data.summary.journey).toEqual(next);
    await put(r.learnerId, auth, { ...base, baseRev: 2, snapshot: snapshotFor(r.learnerId), summary });
    expect((await getStored(r.learnerId, auth)).data.summary).not.toHaveProperty('journey');
  });
});
