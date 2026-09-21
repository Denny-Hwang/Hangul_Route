import { JOIN_CODE_RE } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { LOOKUP_LIMIT, lookupLimiter } from '../routes/spaces';
import { store } from '../store';

type Envelope = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; details?: Record<string, unknown> } };
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
const deviceAuth = (deviceId: string, secret: string): Record<string, string> => ({ ...json, authorization: `Device ${deviceId}:${secret}` });

async function call(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Envelope };
}
const post = (path: string, headers: Record<string, string>, body?: unknown) => call('POST', path, headers, body);
const get = (path: string, headers: Record<string, string>) => call('GET', path, headers);

type Created = { space: { id: string; kind: string; name: string; parentSpaceId: string | null; settings: { anonymizeRoster: boolean } }; membership: { role: string }; joinCode: string | null; joinCodeExpiresAt: string | null };
async function createSpace(user: string, kind: string, name: string, extra: Record<string, unknown> = {}): Promise<Created> {
  const r = await post('/api/spaces', bearer(user), { kind, name, ...extra });
  expect(r.status).toBe(201);
  return r.body.data as Created;
}
async function issueCode(user: string, spaceId: string): Promise<string> {
  const r = await post(`/api/spaces/${spaceId}/code`, bearer(user));
  expect(r.status).toBe(200);
  return (r.body.data as { joinCode: string }).joinCode;
}

async function registerLearner(deviceId: string, name: string) {
  const r = await post('/api/sync/learners', json, { deviceId, learner: { displayName: name, ageGroup: '5-7', avatar: 'hoya-orange' } });
  expect(r.status).toBe(201);
  const data = r.body.data as { learner: { id: string }; device: { secret: string } };
  return { learnerId: data.learner.id, auth: deviceAuth(deviceId, data.device.secret), deviceId };
}
const joinAs = (spaceId: string, headers: Record<string, string>, body: Record<string, unknown>) => post(`/api/spaces/${spaceId}/join`, headers, body);

const snapshotFor = (profileId: string) => ({
  profileId,
  updatedAt: '2026-09-21T00:00:00.000Z',
  episodes: [],
  quests: [{ questId: 'quest:secret-1', episodeId: 'episode:stage1-letters', startedAt: 't', completedAt: 't', stars: 3, attempts: 1, accuracy: 1 }],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});
const summary = { schemaVersion: 1, lastActiveAt: '2026-09-21T00:00:00.000Z', streakDays: 0, stage1: { questsDone: 1, questsTotal: 11, anchorAccuracy: null }, cardsUnlocked: 2, minutesLast7d: 5, jamoRecognized: [], needsPractice: [], planProgress: {} };

beforeEach(() => {
  store.reset();
  lookupLimiter.reset();
});

describe('POST /api/spaces + GET /api/spaces (F-SPACE-001 §3.1, §3.3)', () => {
  it('creates a family (no code), a class (live 30-day code) and a school, upserting the account', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family', { email: 'mom@example.com', displayName: 'Mom' });
    expect(fam.joinCode).toBeNull();
    expect(fam.membership.role).toBe('owner');
    expect(store.accounts.get('mom')).toMatchObject({ email: 'mom@example.com', displayName: 'Mom' });

    const cls = await createSpace('teacher', 'class', 'Sunday Class A');
    expect(cls.joinCode).toMatch(JOIN_CODE_RE);
    const ttlDays = (Date.parse(cls.joinCodeExpiresAt as string) - Date.now()) / 86_400_000;
    expect(ttlDays).toBeGreaterThan(29.9);
    expect(ttlDays).toBeLessThanOrEqual(30);

    const sch = await createSpace('principal', 'school', 'Seoul Hangul School');
    expect(sch.joinCode).toBeNull();
    expect(sch.space.settings.anonymizeRoster).toBe(true);
    // a second create keeps the first email
    await createSpace('mom', 'family', 'Second', { email: 'other@example.com' });
    expect(store.accounts.get('mom')?.email).toBe('mom@example.com');
  });

  it('rejects unauthenticated and malformed creates', async () => {
    expect((await post('/api/spaces', json, { kind: 'family', name: 'x' })).status).toBe(401);
    expect((await post('/api/spaces', bearer('mom'), { kind: 'club', name: 'x' })).status).toBe(422);
  });

  it('a class under a school needs class.create on that school', async () => {
    const sch = await createSpace('principal', 'school', 'School');
    const denied = await post('/api/spaces', bearer('outsider'), { kind: 'class', name: 'A', parentSpaceId: sch.space.id });
    expect(denied.status).toBe(403);
    expect((await post('/api/spaces', bearer('principal'), { kind: 'class', name: 'A', parentSpaceId: 'space:nope' })).status).toBe(404);
    expect((await post('/api/spaces', bearer('principal'), { kind: 'family', name: 'A', parentSpaceId: sch.space.id })).status).toBe(422);
    const ok = await createSpace('principal', 'class', 'Class A', { parentSpaceId: sch.space.id });
    expect(ok.space.parentSpaceId).toBe(sch.space.id);
    // an invited teacher may add a class too
    const code = await issueCode('principal', sch.space.id);
    expect((await joinAs(sch.space.id, bearer('t2'), { code })).status).toBe(201);
    expect((await post('/api/spaces', bearer('t2'), { kind: 'class', name: 'Class B', parentSpaceId: sch.space.id })).status).toBe(201);
  });

  it('lists my spaces with counts and shows the code only where I manage', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const cls = await createSpace('teacher', 'class', 'Sunday Class A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    expect((await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId })).status).toBe(201);
    const famCode = await issueCode('mom', fam.space.id);
    expect((await joinAs(fam.space.id, bearer('dad'), { code: famCode })).status).toBe(201);

    const mine = (await get('/api/spaces', bearer('teacher'))).body.data as { spaces: Array<{ space: { id: string }; role: string; counts: { learners: number; accounts: number; classes: number }; joinCode: string | null }> };
    expect(mine.spaces).toHaveLength(1);
    expect(mine.spaces[0]).toMatchObject({ role: 'owner', counts: { learners: 1, accounts: 1, classes: 0 }, joinCode: cls.joinCode });

    const dads = (await get('/api/spaces', bearer('dad'))).body.data as { spaces: Array<{ role: string; joinCode: string | null }> };
    expect(dads.spaces[0]).toMatchObject({ role: 'caregiver', joinCode: null });
    const moms = (await get('/api/spaces', bearer('mom'))).body.data as { spaces: Array<{ counts: { accounts: number }; joinCode: string | null }> };
    expect(moms.spaces[0]).toMatchObject({ counts: { accounts: 2 }, joinCode: famCode });
    expect((await get('/api/spaces', json)).status).toBe(401);
  });
});

describe('join code lifecycle (§3.2)', () => {
  it('regenerates on demand; the old code stops working', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const old = cls.joinCode as string;
    const fresh = await issueCode('teacher', cls.space.id);
    expect(fresh).not.toBe(old);
    expect((await post('/api/spaces/lookup', json, { code: old })).body.error?.code).toBe('code_not_found');
    const found = await post('/api/spaces/lookup', json, { code: fresh.toLowerCase() });
    expect(found.status).toBe(200);
    expect(found.body.data).toEqual({ space: { id: cls.space.id, kind: 'class', name: 'A' }, full: false, roster: [] });
    expect((await post(`/api/spaces/${cls.space.id}/code`, bearer('stranger'))).status).toBe(403);
    expect((await post('/api/spaces/space:nope/code', bearer('teacher'))).status).toBe(404);
  });

  it('lookup reports expired and malformed codes and rate-limits guessing', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const space = store.spaces.get(cls.space.id);
    if (space) space.joinCodeExpiresAt = '2020-01-01T00:00:00.000Z';
    expect((await post('/api/spaces/lookup', json, { code: cls.joinCode })).body.error?.code).toBe('code_expired');
    expect((await post('/api/spaces/lookup', json, { code: 'nope' })).status).toBe(422);
    lookupLimiter.reset();
    for (let i = 0; i < LOOKUP_LIMIT; i += 1) await post('/api/spaces/lookup', json, { code: 'K7M2X9' });
    const blocked = await post('/api/spaces/lookup', json, { code: 'K7M2X9' });
    expect(blocked.status).toBe(429);
    expect((blocked.body.error?.details as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0);
    expect((await post('/api/spaces/lookup', { ...json, 'cf-connecting-ip': '198.51.100.7' }, { code: 'K7M2X9' })).status).toBe(404);
  });
});

describe('learner join (§3.3)', () => {
  it('joins a class with the code, idempotently, sets the roster name and shows up in the inbox', async () => {
    const cls = await createSpace('teacher', 'class', 'Sunday Class A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    const first = await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId, displayName: 'Suni K' });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ alreadyMember: false, membership: { role: 'student', memberId: suni.learnerId }, space: { name: 'Sunday Class A' } });
    const again = await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    expect(again.status).toBe(200);
    expect(again.body.data).toMatchObject({ alreadyMember: true });
    expect(store.learners.get(suni.learnerId)?.displayName).toBe('Suni K');

    const inbox = (await get(`/api/sync/learners/${suni.learnerId}/inbox`, suni.auth)).body.data as { memberships: unknown[] };
    expect(inbox.memberships).toEqual([{ spaceId: cls.space.id, kind: 'class', name: 'Sunday Class A', role: 'student', joinedAt: expect.any(String) }]);
  });

  it('rejects wrong / expired codes, a missing learnerId, a bad secret, and school spaces', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    expect((await joinAs(cls.space.id, suni.auth, { code: 'K7M2X9', learnerId: suni.learnerId })).body.error?.code).toBe('code_not_found');
    expect((await joinAs(cls.space.id, suni.auth, { code: cls.joinCode })).status).toBe(422);
    expect((await joinAs(cls.space.id, deviceAuth(suni.deviceId, 'bad'), { code: cls.joinCode, learnerId: suni.learnerId })).status).toBe(401);
    expect((await joinAs(cls.space.id, suni.auth, { code: 'nope', learnerId: suni.learnerId })).status).toBe(422);
    const space = store.spaces.get(cls.space.id);
    if (space) space.joinCodeExpiresAt = '2020-01-01T00:00:00.000Z';
    expect((await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId })).body.error?.code).toBe('code_expired');

    const sch = await createSpace('principal', 'school', 'School');
    const code = await issueCode('principal', sch.space.id);
    expect((await joinAs(sch.space.id, suni.auth, { code, learnerId: suni.learnerId })).body.error?.code).toBe('not_joinable');
    expect((await joinAs('space:nope', suni.auth, { code, learnerId: suni.learnerId })).status).toBe(404);
  });

  it('caps: three classes per learner, twenty students per free class', async () => {
    const suni = await registerLearner('device-suni0001', 'Suni');
    const classes = await Promise.all(['A', 'B', 'C', 'D'].map((n) => createSpace(`t-${n}`, 'class', n)));
    for (const cls of classes.slice(0, 3)) {
      expect((await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId })).status).toBe(201);
    }
    const fourth = classes[3] as Created;
    expect((await joinAs(fourth.space.id, suni.auth, { code: fourth.joinCode, learnerId: suni.learnerId })).body.error?.code).toBe('cap_learner');

    const full = await createSpace('t-full', 'class', 'Full');
    for (let i = 0; i < 20; i += 1) {
      store.addMembership({ spaceId: full.space.id, memberKind: 'learner', memberId: `profile:s${i}`, role: 'student', joinedAt: 't' });
    }
    const late = await registerLearner('device-late00001', 'Late');
    expect((await joinAs(full.space.id, late.auth, { code: full.joinCode, learnerId: late.learnerId })).body.error?.code).toBe('cap_class');
    expect((await post('/api/spaces/lookup', json, { code: full.joinCode })).body.data).toMatchObject({ full: true });
  });

  it('a learner joins a family with the family code', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const code = await issueCode('mom', fam.space.id);
    const suni = await registerLearner('device-suni0001', 'Suni');
    const r = await joinAs(fam.space.id, suni.auth, { code, learnerId: suni.learnerId });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ membership: { role: 'student' }, space: { kind: 'family' } });
  });
});

describe('account join (§3.3)', () => {
  it('a co-parent becomes caregiver, an invited teacher joins a school, classes refuse a second teacher', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const famCode = await issueCode('mom', fam.space.id);
    const dad = await joinAs(fam.space.id, bearer('dad'), { code: famCode });
    expect(dad.status).toBe(201);
    expect(dad.body.data).toMatchObject({ membership: { role: 'caregiver', memberKind: 'account', memberId: 'dad' } });
    expect((await joinAs(fam.space.id, bearer('dad'), { code: famCode })).body.data).toMatchObject({ alreadyMember: true });

    const sch = await createSpace('principal', 'school', 'School');
    const schCode = await issueCode('principal', sch.space.id);
    expect((await joinAs(sch.space.id, bearer('t2'), { code: schCode })).body.data).toMatchObject({ membership: { role: 'teacher' } });

    const cls = await createSpace('teacher', 'class', 'A');
    expect((await joinAs(cls.space.id, bearer('t3'), { code: cls.joinCode })).body.error?.code).toBe('co_teacher_unsupported');
    expect((await joinAs(cls.space.id, json, { code: cls.joinCode })).status).toBe(401);
  });
});

describe('leave, remove, roster (§3.3, §3.4)', () => {
  it('a learner leaves idempotently; a teacher removes members but never the owner', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    expect((await post(`/api/spaces/${cls.space.id}/leave`, suni.auth, { learnerId: suni.learnerId })).body.data).toEqual({ left: true });
    expect((await post(`/api/spaces/${cls.space.id}/leave`, suni.auth, { learnerId: suni.learnerId })).body.data).toEqual({ left: false });
    expect((await post(`/api/spaces/${cls.space.id}/leave`, suni.auth, {})).status).toBe(422);
    expect((await post('/api/spaces/space:nope/leave', suni.auth, { learnerId: suni.learnerId })).status).toBe(404);

    await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    expect((await call('DELETE', `/api/spaces/${cls.space.id}/members/learner/${suni.learnerId}`, bearer('teacher'))).body.data).toEqual({ removed: true });
    expect((await call('DELETE', `/api/spaces/${cls.space.id}/members/account/teacher`, bearer('teacher'))).body.error?.code).toBe('owner');
    expect((await call('DELETE', `/api/spaces/${cls.space.id}/members/learner/${suni.learnerId}`, bearer('stranger'))).status).toBe(403);
    expect((await call('DELETE', `/api/spaces/${cls.space.id}/members/robot/x`, bearer('teacher'))).status).toBe(422);
    expect((await call('DELETE', '/api/spaces/space:nope/members/learner/x', bearer('teacher'))).status).toBe(404);
  });

  it('roster returns summaries only, most recently active first, to members with summary.read', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    const minho = await registerLearner('device-minho001', 'Minho');
    await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    await joinAs(cls.space.id, minho.auth, { code: cls.joinCode, learnerId: minho.learnerId });
    const upload = await call('PUT', `/api/sync/learners/${minho.learnerId}/snapshot`, minho.auth, { baseRev: 0, snapshot: snapshotFor(minho.learnerId), summary, schemaVer: 1, contentVer: '2026.09' });
    expect(upload.status).toBe(200);

    const roster = await get(`/api/spaces/${cls.space.id}/roster`, bearer('teacher'));
    expect(roster.status).toBe(200);
    const data = roster.body.data as { learners: Array<{ id: string; summary: { cardsUnlocked: number } | null; lastSyncedAt: string | null }>; joinCode: string | null };
    expect(data.learners.map((l) => l.id)).toEqual([minho.learnerId, suni.learnerId]);
    expect(data.learners[0]?.summary?.cardsUnlocked).toBe(2);
    expect(data.learners[1]?.summary).toBeNull();
    expect(data.joinCode).toBe(cls.joinCode);
    expect(JSON.stringify(roster.body)).not.toContain('secret-1'); // payload never leaves through the roster

    expect((await get(`/api/spaces/${cls.space.id}/roster`, bearer('stranger'))).status).toBe(403);
    expect((await get('/api/spaces/space:nope/roster', bearer('teacher'))).status).toBe(404);
  });

  it('a school admin reads a child class roster without its code; archived spaces disappear', async () => {
    const sch = await createSpace('principal', 'school', 'School');
    const schCode = await issueCode('principal', sch.space.id);
    await joinAs(sch.space.id, bearer('t2'), { code: schCode });
    const cls = await createSpace('t2', 'class', 'Class B', { parentSpaceId: sch.space.id });
    const suni = await registerLearner('device-suni0001', 'Suni');
    await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });

    const roster = await get(`/api/spaces/${cls.space.id}/roster`, bearer('principal'));
    expect(roster.status).toBe(200);
    expect(roster.body.data).toMatchObject({ joinCode: null, learners: [{ id: suni.learnerId }] });

    const space = store.spaces.get(cls.space.id);
    if (space) space.archivedAt = '2026-09-21T00:00:00.000Z';
    expect(((await get(`/api/sync/learners/${suni.learnerId}/inbox`, suni.auth)).body.data as { memberships: unknown[] }).memberships).toEqual([]);
    expect((await post('/api/spaces/lookup', json, { code: cls.joinCode })).body.error?.code).toBe('code_not_found');
    expect((await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId })).status).toBe(404);
    expect((await get(`/api/spaces/${cls.space.id}/roster`, bearer('principal'))).status).toBe(200); // archived rosters stay readable (F-TCH-001 §10.3)
  });
});

describe('settings, archive, learner data (F-TCH-001 §10.3)', () => {
  it('patches settings, archives and unarchives with the right effects', async () => {
    const cls = await createSpace('teacher', 'class', 'A');
    expect((await call('PATCH', `/api/spaces/${cls.space.id}/settings`, bearer('teacher'), {})).status).toBe(422);
    expect((await call('PATCH', `/api/spaces/${cls.space.id}/settings`, bearer('stranger'), { anonymizeRoster: true })).status).toBe(403);
    const patched = await call('PATCH', `/api/spaces/${cls.space.id}/settings`, bearer('teacher'), { anonymizeRoster: true, consentMode: 'school' });
    expect((patched.body.data as { space: { settings: unknown } }).space.settings).toEqual({ consentMode: 'school', anonymizeRoster: true });

    const suni = await registerLearner('device-suni0001', 'Suni Park');
    await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });
    const lookup = (await post('/api/spaces/lookup', json, { code: cls.joinCode })).body.data as { roster: Array<{ name: string }> };
    expect(lookup.roster).toEqual([{ learnerId: suni.learnerId, name: 'S. P.' }]);

    expect((await post(`/api/spaces/${cls.space.id}/archive`, bearer('teacher'))).status).toBe(200);
    expect((await post('/api/spaces/lookup', json, { code: cls.joinCode })).status).toBe(404);
    expect((await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId })).status).toBe(404);
    const roster = await get(`/api/spaces/${cls.space.id}/roster`, bearer('teacher'));
    expect(roster.status).toBe(200); // archived rosters stay readable
    expect((roster.body.data as { learners: Array<{ displayName: string }> }).learners[0]?.displayName).toBe('S. P.');
    const listed = (await get('/api/spaces', bearer('teacher'))).body.data as { spaces: Array<{ space: { archivedAt: string | null } }> };
    expect(listed.spaces[0]?.space.archivedAt).not.toBeNull();
    expect((await post(`/api/spaces/${cls.space.id}/unarchive`, bearer('teacher'))).status).toBe(200);
    expect((await post('/api/spaces/lookup', json, { code: cls.joinCode })).status).toBe(200);
    expect((await post('/api/spaces/space:nope/archive', bearer('teacher'))).status).toBe(404);
  });

  it('deletes a learner everywhere for a caregiver, and for a teacher only under school consent', async () => {
    const fam = await createSpace('mom', 'family', 'Kim family');
    const famCode = await issueCode('mom', fam.space.id);
    const cls = await createSpace('teacher', 'class', 'A');
    const suni = await registerLearner('device-suni0001', 'Suni');
    await joinAs(fam.space.id, suni.auth, { code: famCode, learnerId: suni.learnerId });
    await joinAs(cls.space.id, suni.auth, { code: cls.joinCode, learnerId: suni.learnerId });

    expect((await call('DELETE', `/api/spaces/${cls.space.id}/learners/${suni.learnerId}/data`, bearer('teacher'))).status).toBe(403);
    expect((await call('DELETE', `/api/spaces/${cls.space.id}/learners/profile:nobody/data`, bearer('teacher'))).status).toBe(404);
    expect((await call('DELETE', `/api/spaces/${fam.space.id}/learners/${suni.learnerId}/data`, bearer('stranger'))).status).toBe(403);
    await call('PATCH', `/api/spaces/${cls.space.id}/settings`, bearer('teacher'), { consentMode: 'school' });
    expect((await call('DELETE', `/api/spaces/${cls.space.id}/learners/${suni.learnerId}/data`, bearer('teacher'))).body.data).toEqual({ deleted: true });
    expect(store.learners.has(suni.learnerId)).toBe(false);
    expect(store.membersOf(fam.space.id).some((m) => m.memberId === suni.learnerId)).toBe(false);
    expect(store.device(suni.learnerId, suni.deviceId)).toBeUndefined();
    expect((await get(`/api/sync/learners/${suni.learnerId}/snapshot`, suni.auth)).status).toBe(404);

    const minho = await registerLearner('device-minho001', 'Minho');
    await joinAs(fam.space.id, minho.auth, { code: famCode, learnerId: minho.learnerId });
    expect((await call('DELETE', `/api/spaces/${fam.space.id}/learners/${minho.learnerId}/data`, bearer('mom'))).body.data).toEqual({ deleted: true });
  });
});
