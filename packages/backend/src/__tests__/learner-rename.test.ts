import { SyncInboxSchema } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { hashSecret } from '../lib/device-auth';
import { lookupLimiter } from '../routes/spaces';
import { store } from '../store';
import { testDb as db } from './helpers/db';

/**
 * A learner renamed on their own device shows the new name everywhere a grown-up reads it: PATCH
 * /api/sync/learners/:id writes only the profile columns, the snapshot PUT and the Rescue Code issue write
 * only their own column (no lost update), and a join again with the device's name repairs the row. The case
 * reported by the owner: a learner registered as "test", in a class, renamed to "Sungjoo". Runs on memory and,
 * with HR_TEST_DB=sqlite, on the real migrations.
 */
type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string } };
const json = { 'content-type': 'application/json' };
const ON = { NOTES_SEND: 'enabled' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
const deviceAuth = (deviceId: string, secret: string): Record<string, string> => ({ ...json, authorization: `Device ${deviceId}:${secret}` });

async function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, ON);
  return { status: res.status, cacheControl: res.headers.get('cache-control'), body: (await res.json()) as Envelope };
}
const post = (path: string, headers: Record<string, string>, body?: unknown) => call('POST', path, headers, body);
const get = (path: string, headers: Record<string, string>) => call('GET', path, headers);

type Learner = { learnerId: string; auth: Record<string, string> };
async function registerLearner(deviceId: string, name: string): Promise<Learner> {
  const r = await post('/api/sync/learners', json, { deviceId, learner: { displayName: name, ageGroup: '5-7', avatar: 'hoya-orange' } });
  expect(r.status).toBe(201);
  const data = r.body.data as { learner: { id: string }; device: { secret: string } };
  return { learnerId: data.learner.id, auth: deviceAuth(deviceId, data.device.secret) };
}
async function createSpace(user: string, kind: string, name: string): Promise<{ id: string; code: string }> {
  const r = await post('/api/spaces', bearer(user), { kind, name });
  expect(r.status).toBe(201);
  const spaceId = (r.body.data as { space: { id: string } }).space.id;
  const code = await post(`/api/spaces/${spaceId}/code`, bearer(user));
  expect(code.status).toBe(200);
  return { id: spaceId, code: (code.body.data as { joinCode: string }).joinCode };
}
const join = (space: { id: string; code: string }, learner: Learner, displayName?: string) =>
  post(`/api/spaces/${space.id}/join`, learner.auth, { code: space.code, learnerId: learner.learnerId, ...(displayName === undefined ? {} : { displayName }) });
const patch = (learner: Learner, body: unknown) => call('PATCH', `/api/sync/learners/${learner.learnerId}`, learner.auth, body);
const at = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
const storedName = async (learnerId: string) => (await db.getLearner(learnerId))?.displayName;

const snapshotFor = (profileId: string) => ({ profileId, updatedAt: '2026-10-01T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 });
const summary = {
  schemaVersion: 1,
  lastActiveAt: '2026-10-01T00:00:00.000Z',
  streakDays: 0,
  stage1: { questsDone: 0, questsTotal: 15, anchorAccuracy: null },
  cardsUnlocked: 0,
  minutesLast7d: 0,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};
const putSnapshot = (learner: Learner, baseRev = 0) =>
  call('PUT', `/api/sync/learners/${learner.learnerId}/snapshot`, learner.auth, { baseRev, snapshot: snapshotFor(learner.learnerId), summary, schemaVer: 1, contentVer: '2026.10' });

/** A class tablet for the learner: a device binding with the class scope (what a teacher's re-link approval makes). */
async function classTablet(learner: Learner): Promise<Record<string, string>> {
  const now = new Date().toISOString();
  await db.putDevice({ learnerId: learner.learnerId, deviceId: 'tablet-class-0001', secretHash: await hashSecret('tablet-secret'), scope: 'class', createdAt: now, lastSeenAt: now });
  return deviceAuth('tablet-class-0001', 'tablet-secret');
}

/** Every place a teacher or a parent reads the learner's name, as the console would. */
async function namesSeen(world: { cls: { id: string }; fam: { id: string } }, learnerId: string): Promise<Record<string, unknown>> {
  const pick = (rows: Array<Record<string, unknown>>, key: string, field: string) => rows.find((r) => r[key] === learnerId)?.[field];
  const roster = await get(`/api/spaces/${world.cls.id}/roster`, bearer('teacher'));
  const members = await get(`/api/spaces/${world.cls.id}/members`, bearer('teacher'));
  const report = await get(`/api/spaces/${world.cls.id}/learners/${learnerId}/report`, bearer('teacher'));
  const recipients = await get(`/api/spaces/${world.cls.id}/notes/recipients`, bearer('teacher'));
  const famRoster = await get(`/api/spaces/${world.fam.id}/roster`, bearer('mom'));
  const famReport = await get(`/api/spaces/${world.fam.id}/learners/${learnerId}/report`, bearer('mom'));
  for (const r of [roster, members, report, recipients, famRoster, famReport]) {
    expect(r.status).toBe(200);
    expect(r.cacheControl).toBe('no-store');
  }
  return {
    roster: pick(roster.body.data?.learners as Array<Record<string, unknown>>, 'id', 'displayName'),
    members: pick(members.body.data?.members as Array<Record<string, unknown>>, 'memberId', 'name'),
    report: (report.body.data?.learner as { displayName: string }).displayName,
    recipients: pick(recipients.body.data?.learners as Array<Record<string, unknown>>, 'id', 'displayName'),
    familyRoster: pick(famRoster.body.data?.learners as Array<Record<string, unknown>>, 'id', 'displayName'),
    familyReport: (famReport.body.data?.learner as { displayName: string }).displayName,
  };
}
const everywhere = (name: string) => ({ roster: name, members: name, report: name, recipients: name, familyRoster: name, familyReport: name });

/** Registered as "test", in the class "Kpccw class1" (teacher) and in a family (mom). */
async function reportedWorld() {
  const learner = await registerLearner('device-test0001', 'test');
  const cls = await createSpace('teacher', 'class', 'Kpccw class1');
  const fam = await createSpace('mom', 'family', 'Kim family');
  expect((await join(cls, learner)).status).toBe(201);
  expect((await join(fam, learner)).status).toBe(201);
  return { learner, cls, fam };
}

beforeEach(async () => {
  await db.reset();
  store.reset();
  lookupLimiter.reset();
});
afterEach(() => vi.restoreAllMocks());

describe('PATCH /api/sync/learners/:id — the reported rename (test -> Sungjoo)', () => {
  it('shows the new name in the class roster, members, report, notes recipients and the family views', async () => {
    const world = await reportedWorld();
    expect(await namesSeen(world, world.learner.learnerId)).toEqual(everywhere('test'));

    const r = await patch(world.learner, { displayName: 'Sungjoo', at: at() });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ applied: true, learner: { id: world.learner.learnerId, displayName: 'Sungjoo', ageGroup: '5-7', avatar: 'hoya-orange' } });
    expect(r.body.data?.learner).not.toHaveProperty('recoveryHash');
    expect(await namesSeen(world, world.learner.learnerId)).toEqual(everywhere('Sungjoo'));
  });

  it('with anonymizeRoster on, the alias follows the new name', async () => {
    const world = await reportedWorld();
    for (const [space, user] of [[world.cls, 'teacher'], [world.fam, 'mom']] as const) {
      expect((await call('PATCH', `/api/spaces/${space.id}/settings`, bearer(user), { anonymizeRoster: true })).status).toBe(200);
    }
    expect(await namesSeen(world, world.learner.learnerId)).toEqual(everywhere('T.'));
    expect((await patch(world.learner, { displayName: 'Sungjoo', at: at() })).status).toBe(200);
    expect(await namesSeen(world, world.learner.learnerId)).toEqual(everywhere('S.'));
  });

  it('changes only the fields sent: level and picture alone keep the name', async () => {
    const { learner } = await reportedWorld();
    const r = await patch(learner, { ageGroup: '8-9', avatar: 'hoya-blue', at: at() });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ applied: true, learner: { displayName: 'test', ageGroup: '8-9', avatar: 'hoya-blue' } });
  });

  it('trims the name, and accepts the names a device accepts (accents, Hangul, apostrophes, hyphens)', async () => {
    const { learner } = await reportedWorld();
    for (const name of ['María', '수니', "O'Neil", 'Ann-Marie', 'Zoë 2']) {
      const r = await patch(learner, { displayName: name, at: at() });
      expect(r.status, name).toBe(200);
      expect(await storedName(learner.learnerId)).toBe(name);
    }
    expect((await patch(learner, { displayName: '  Sungjoo  ', at: at() })).status).toBe(200);
    expect(await storedName(learner.learnerId)).toBe('Sungjoo');
  });

  it('refuses bad names with 422 and keeps the stored one', async () => {
    const { learner } = await reportedWorld();
    for (const displayName of ['', '   ', 'A'.repeat(13), 'Sung<joo>', 'Sung\u{1F600}', 'Сунджу', 'line\nbreak']) {
      const r = await patch(learner, { displayName, at: at() });
      expect(r.status, JSON.stringify(displayName)).toBe(422);
      expect(r.body.error?.code).toBe('bad_request');
      // the refusal never echoes the name back
      if (displayName.trim()) expect(JSON.stringify(r.body)).not.toContain(displayName.trim());
    }
    expect(await storedName(learner.learnerId)).toBe('test');
  });

  it('refuses the fields that stay on the device (who is learning, the PIN, consent), an empty edit and a bad time', async () => {
    const { learner } = await reportedWorld();
    for (const body of [
      { displayName: 'Sungjoo', learnerType: 'adult', at: at() },
      { displayName: 'Sungjoo', parentPinHash: 'abc', at: at() },
      { displayName: 'Sungjoo', consent: { at: at() }, at: at() },
      { displayName: 'Sungjoo', recoveryHash: 'x', at: at() },
      { at: at() },
      { displayName: 'Sungjoo' },
      { displayName: 'Sungjoo', at: 'yesterday' },
      { ageGroup: '99', at: at() },
      { avatar: 'not-a-cub', at: at() },
      null,
    ]) {
      const r = await patch(learner, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
    }
    expect(await db.getLearner(learner.learnerId)).toMatchObject({ displayName: 'test', ageGroup: '5-7', avatar: 'hoya-orange', recoveryHash: null, profileUpdatedAt: null });
  });

  it('a stale edit answers 200 applied:false and leaves the newer name', async () => {
    const { learner } = await reportedWorld();
    expect((await patch(learner, { displayName: 'Sungjoo', at: at() })).body.data?.applied).toBe(true);
    const stale = await patch(learner, { displayName: 'Old', at: at(-60_000) });
    expect(stale.status).toBe(200);
    expect(stale.body.data).toMatchObject({ applied: false, learner: { displayName: 'Sungjoo' } });
    expect(await storedName(learner.learnerId)).toBe('Sungjoo');
  });

  it('reads a future edit time as now, so a device clock ahead cannot lock out later edits', async () => {
    const { learner } = await reportedWorld();
    expect((await patch(learner, { displayName: 'Ahead', at: at(365 * 24 * 3600_000) })).body.data?.applied).toBe(true);
    const stored = (await db.getLearner(learner.learnerId))?.profileUpdatedAt ?? '';
    expect(Date.parse(stored)).toBeLessThanOrEqual(Date.now());
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect((await patch(learner, { displayName: 'Sungjoo', at: at() })).body.data?.applied).toBe(true);
    expect(await storedName(learner.learnerId)).toBe('Sungjoo');
  });

  it('a class tablet gets 403 scope_limited (SEC-4); no device, another learner or a bad secret cannot rename', async () => {
    const { learner } = await reportedWorld();
    const tablet = await classTablet(learner);
    const r = await call('PATCH', `/api/sync/learners/${learner.learnerId}`, tablet, { displayName: 'Sungjoo', at: at() });
    expect(r.status).toBe(403);
    expect(r.body.error?.code).toBe('scope_limited');
    expect((await call('PATCH', `/api/sync/learners/${learner.learnerId}`, json, { displayName: 'Sungjoo', at: at() })).status).toBe(401);
    const other = await registerLearner('device-other001', 'Other');
    expect((await call('PATCH', `/api/sync/learners/${learner.learnerId}`, other.auth, { displayName: 'Sungjoo', at: at() })).status).toBe(403);
    expect((await call('PATCH', `/api/sync/learners/${learner.learnerId}`, deviceAuth('device-test0001', 'wrong'), { displayName: 'Sungjoo', at: at() })).status).toBe(401);
    expect(await storedName(learner.learnerId)).toBe('test');
  });

  it('puts the name in no server event, telemetry event or log line', async () => {
    const { learner, cls } = await reportedWorld();
    const logged: unknown[] = [];
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, level).mockImplementation((...args) => void logged.push(args));
    expect((await patch(learner, { displayName: 'Sungjoo', at: at() })).status).toBe(200);
    expect((await patch(learner, { displayName: 'Bad<Name', at: at() })).status).toBe(422);
    expect((await join(cls, learner, 'Sungjooo')).status).toBe(200);
    const seen = JSON.stringify([store.events, logged]);
    for (const name of ['Sungjoo', 'Bad<Name']) expect(seen).not.toContain(name);
  });
});

describe('GET /api/sync/learners/:id/inbox — the learner block', () => {
  it('returns the server row to a full-scope device and leaves it off a class tablet', async () => {
    const { learner } = await reportedWorld();
    const before = await get(`/api/sync/learners/${learner.learnerId}/inbox`, learner.auth);
    expect(before.status).toBe(200);
    expect(before.cacheControl).toBe('no-store');
    expect(before.body.data?.learner).toEqual({ displayName: 'test', ageGroup: '5-7', avatar: 'hoya-orange', profileUpdatedAt: null });

    const edit = at();
    await patch(learner, { displayName: 'Sungjoo', at: edit });
    const after = await get(`/api/sync/learners/${learner.learnerId}/inbox`, learner.auth);
    expect(SyncInboxSchema.parse(after.body.data).learner).toEqual({ displayName: 'Sungjoo', ageGroup: '5-7', avatar: 'hoya-orange', profileUpdatedAt: edit });

    const tablet = await get(`/api/sync/learners/${learner.learnerId}/inbox`, await classTablet(learner));
    expect(tablet.status).toBe(200);
    expect(tablet.body.data).not.toHaveProperty('learner');
    expect(SyncInboxSchema.parse(tablet.body.data).learner).toBeUndefined();
  });

  it('an older app still parses the inbox, and a malformed block reads as absent', () => {
    const base = { rev: 0, plans: [], memberships: [], tier: 'free', serverTime: at() };
    expect(SyncInboxSchema.parse(base).learner).toBeUndefined();
    expect(SyncInboxSchema.parse({ ...base, learner: { displayName: 5 } }).learner).toBeUndefined();
    expect(SyncInboxSchema.parse({ ...base, learner: { displayName: 'Sungjoo', ageGroup: '5-7', avatar: 'hoya-orange', profileUpdatedAt: null } }).learner?.displayName).toBe('Sungjoo');
  });
});

describe('POST /api/spaces/:id/join — the device name repairs the roster', () => {
  it('a join again with a new name updates the row (the repair path on the current app)', async () => {
    const world = await reportedWorld();
    const again = await join(world.cls, world.learner, 'Sungjoo');
    expect(again.status).toBe(200);
    expect(again.body.data?.alreadyMember).toBe(true);
    expect(await namesSeen(world, world.learner.learnerId)).toEqual(everywhere('Sungjoo'));
  });

  it('a first join with a name sets it; a join without one keeps the stored name', async () => {
    const learner = await registerLearner('device-test0001', 'test');
    const cls = await createSpace('teacher', 'class', 'Kpccw class1');
    expect((await join(cls, learner, 'Sungjoo')).status).toBe(201);
    expect(await storedName(learner.learnerId)).toBe('Sungjoo');
    expect((await join(cls, learner)).status).toBe(200);
    expect(await storedName(learner.learnerId)).toBe('Sungjoo');
  });

  it('a name that fails the rule is refused (422) and never written', async () => {
    const learner = await registerLearner('device-test0001', 'test');
    const cls = await createSpace('teacher', 'class', 'Kpccw class1');
    expect((await join(cls, learner, 'A'.repeat(13))).status).toBe(422);
    expect((await join(cls, learner)).status).toBe(201);
    expect((await join(cls, learner, '<b>')).status).toBe(422);
    expect(await storedName(learner.learnerId)).toBe('test');
  });

  it('a join again does not undo a newer edit from the device', async () => {
    const world = await reportedWorld();
    expect((await patch(world.learner, { displayName: 'Sungjoo', at: at(60_000) })).status).toBe(200);
    // the edit's time was clamped to now; a join a moment later carries a later time and applies
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect((await join(world.cls, world.learner, 'Sungjoo')).status).toBe(200);
    expect(await storedName(world.learner.learnerId)).toBe('Sungjoo');
  });
});

describe('column-targeted writes: no lost update', () => {
  /** Runs `during` once, between the request's reads and its learner write, the way a concurrent request would land. */
  function between(trigger: 'afterSnapshotRead' | 'afterSecondLearnerRead', during: () => Promise<void>): void {
    let armed = trigger === 'afterSecondLearnerRead';
    let learnerReads = 0;
    let fired = false;
    const fire = async () => {
      if (fired) return;
      fired = true;
      await during();
    };
    const getSnapshot = db.getSnapshot.bind(db);
    const getLearner = db.getLearner.bind(db);
    const touchLearner = db.touchLearner.bind(db);
    const setRecoveryHash = db.setRecoveryHash.bind(db);
    const putLearner = db.putLearner.bind(db);
    vi.spyOn(db, 'getSnapshot').mockImplementation(async (id) => {
      const row = await getSnapshot(id);
      if (trigger === 'afterSnapshotRead') armed = true;
      return row;
    });
    vi.spyOn(db, 'getLearner').mockImplementation(async (id) => {
      const row = await getLearner(id);
      learnerReads += 1;
      if (!fired && armed && (trigger === 'afterSnapshotRead' || learnerReads >= 2)) await fire();
      return row;
    });
    // A route that writes without a second read: the concurrent write lands just before it.
    vi.spyOn(db, 'touchLearner').mockImplementation(async (id, when) => {
      if (armed) await fire();
      return touchLearner(id, when);
    });
    vi.spyOn(db, 'setRecoveryHash').mockImplementation(async (id, hash) => {
      if (armed) await fire();
      return setRecoveryHash(id, hash);
    });
    vi.spyOn(db, 'putLearner').mockImplementation(async (learner) => {
      if (armed) await fire();
      return putLearner(learner);
    });
  }
  const issue = async (learner: Learner) => {
    const r = await post('/api/recovery/issue', learner.auth, { learnerId: learner.learnerId });
    expect(r.status).toBe(201);
    return (r.body.data as { code: string }).code;
  };
  const claimName = async (code: string) => {
    const r = await post('/api/recovery/claim', json, { code, deviceId: 'device-new00001' });
    expect(r.status).toBe(200);
    return (r.body.data as { learner: { displayName: string } }).learner.displayName;
  };

  it('a rename that lands during a snapshot upload survives it', async () => {
    const { learner } = await reportedWorld();
    between('afterSnapshotRead', async () => {
      expect((await patch(learner, { displayName: 'Sungjoo', at: at() })).status).toBe(200);
    });
    expect((await putSnapshot(learner)).status).toBe(200);
    vi.restoreAllMocks();
    expect(await db.getLearner(learner.learnerId)).toMatchObject({ displayName: 'Sungjoo' });
    expect((await db.getLearner(learner.learnerId))?.lastActiveAt).not.toBe('');
  });

  it('a Rescue Code issued during a snapshot upload survives it', async () => {
    const { learner } = await reportedWorld();
    let code = '';
    between('afterSnapshotRead', async () => {
      code = await issue(learner);
    });
    expect((await putSnapshot(learner)).status).toBe(200);
    vi.restoreAllMocks();
    expect(code).not.toBe('');
    expect((await db.getLearner(learner.learnerId))?.recoveryHash).not.toBeNull();
    expect(await claimName(code)).toBe('test');
  });

  it('a rename that lands during a Rescue Code issue survives it, and the code still restores', async () => {
    const { learner } = await reportedWorld();
    between('afterSecondLearnerRead', async () => {
      expect((await patch(learner, { displayName: 'Sungjoo', at: at() })).status).toBe(200);
    });
    const code = await issue(learner);
    vi.restoreAllMocks();
    expect(await storedName(learner.learnerId)).toBe('Sungjoo');
    expect(await claimName(code)).toBe('Sungjoo');
  });

  it('a snapshot upload still records the activity time', async () => {
    const { learner } = await reportedWorld();
    await db.touchLearner(learner.learnerId, '2026-01-01T00:00:00.000Z');
    expect((await putSnapshot(learner)).status).toBe(200);
    const row = await db.getLearner(learner.learnerId);
    expect((row?.lastActiveAt ?? '') > '2026-01-01T00:00:00.000Z').toBe(true);
    expect(row).toMatchObject({ displayName: 'test', profileUpdatedAt: null });
  });
});
