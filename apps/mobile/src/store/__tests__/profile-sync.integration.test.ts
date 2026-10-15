import { LearnerProfilePatchSchema, type ProgressSnapshot } from '@hangul-route/content-schema';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The reported bug end to end (F-PROF-001): a learner renamed 'test' to 'Sungjoo' on the learner's device, and the
 * teacher's class roster kept 'test'. Real profile-store, sync-store and sync-api against an in-memory Worker that
 * implements register, PATCH, snapshot, Rescue Codes, join, the inbox and the class and family rosters. Each device
 * has its own storage; a second device loads fresh store modules.
 */
const devices = vi.hoisted(() => ({ current: new Map<string, unknown>(), id: 'device-one-0001' }));
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => devices.current.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    devices.current.set(k, v);
  }),
}));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => devices.id) }));
vi.mock('../../config/flags', () => ({
  flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false, contentGatingEnabled: false, notesEnabled: false },
  bundleOs: () => undefined,
  gatingActive: () => false,
}));

const ORIGIN = 'https://api.example.com';

interface LearnerRow { id: string; displayName: string; ageGroup: string; avatar: string; profileUpdatedAt: string | null }
function fakeWorker() {
  const learners = new Map<string, LearnerRow>();
  const devicesBySecret = new Map<string, { learnerId: string; deviceId: string }>();
  const members = new Map<string, Set<string>>([['space:class', new Set()], ['space:family', new Set()]]);
  const codes = new Map<string, string>();
  const patchBodies: unknown[] = [];
  let n = 0;
  const send = (status: number, data: unknown) => new Response(JSON.stringify(status < 300 ? { ok: true, data } : { ok: false, error: data }), { status, headers: { 'content-type': 'application/json' } });
  const auth = (init: RequestInit | undefined, learnerId: string): boolean => {
    const header = (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
    const [, pair] = header.split(' ');
    const [deviceId, secret] = (pair ?? '').split(':');
    const d = devicesBySecret.get(secret ?? '');
    return !!d && d.learnerId === learnerId && d.deviceId === deviceId;
  };
  const newDevice = (learnerId: string, deviceId: string): string => {
    const secret = `secret-${++n}`;
    devicesBySecret.set(secret, { learnerId, deviceId });
    return secret;
  };
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const path = url.pathname;
    if (method === 'POST' && path === '/api/sync/learners') {
      const l = body.learner as Omit<LearnerRow, 'profileUpdatedAt'>;
      learners.set(l.id, { id: l.id, displayName: l.displayName, ageGroup: l.ageGroup, avatar: l.avatar, profileUpdatedAt: null });
      return send(201, { learner: { id: l.id }, device: { secret: newDevice(l.id, String(body.deviceId)) } });
    }
    const m = path.match(/^\/api\/sync\/learners\/([^/]+)(\/[a-z-]+)?$/);
    if (m) {
      const id = decodeURIComponent(m[1] as string);
      if (!auth(init, id)) return send(401, { code: 'unauthorized' });
      const row = learners.get(id) as LearnerRow;
      if (method === 'PATCH' && !m[2]) {
        patchBodies.push(body);
        const parsed = LearnerProfilePatchSchema.safeParse(body);
        if (!parsed.success) return send(422, { code: 'bad_request' });
        const { at, ...fields } = parsed.data;
        const applied = row.profileUpdatedAt === null || Date.parse(at) >= Date.parse(row.profileUpdatedAt);
        if (applied) learners.set(id, { ...row, ...fields, profileUpdatedAt: at });
        return send(200, { learner: learners.get(id), applied });
      }
      if (method === 'PUT' && m[2] === '/snapshot') return send(200, { rev: Number(body.baseRev) + 1 });
      if (method === 'GET' && m[2] === '/inbox') {
        return send(200, { rev: 0, plans: [], memberships: [], tier: 'free', serverTime: new Date().toISOString(), deviceScope: 'full', learner: { displayName: row.displayName, ageGroup: row.ageGroup, avatar: row.avatar, profileUpdatedAt: row.profileUpdatedAt } });
      }
    }
    if (method === 'POST' && path === '/api/recovery/issue') {
      const code = `TIGER-MOON-${4800 + ++n}`;
      codes.set(code, String(body.learnerId));
      return send(201, { code });
    }
    if (method === 'POST' && path === '/api/recovery/claim') {
      const id = codes.get(String(body.code));
      if (!id) return send(404, { code: 'code_not_found' });
      const row = learners.get(id) as LearnerRow;
      return send(200, { learner: { id, displayName: row.displayName, ageGroup: row.ageGroup, avatar: row.avatar }, device: { secret: newDevice(id, String(body.deviceId)) }, snapshot: null });
    }
    const join = path.match(/^\/api\/spaces\/([^/]+)\/join$/);
    if (method === 'POST' && join) {
      const spaceId = decodeURIComponent(join[1] as string);
      members.get(spaceId)?.add(String(body.learnerId));
      return send(201, { alreadyMember: false, membership: { role: 'learner', joinedAt: 't' }, space: { id: spaceId, kind: spaceId === 'space:class' ? 'class' : 'family', name: 'Room 3' } });
    }
    return send(404, { code: 'not_found' });
  });
  /** What the teacher console and the family space list: the learner rows of the members. */
  const roster = (spaceId: string): string[] => [...(members.get(spaceId) ?? [])].map((id) => learners.get(id)?.displayName ?? '?');
  return { fetchImpl, roster, patchBodies, codes };
}

const worker = fakeWorker();
const snap = (profileId: string): ProgressSnapshot => ({ profileId, updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 });
const ORIGINAL_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;

type Stores = {
  profiles: typeof import('../profile-store');
  progress: typeof import('../progress-store');
  sync: typeof import('../sync-store');
  edit: typeof import('../../logic/profiles/edit-profile');
};

/** A fresh device: its own storage, its own id and freshly loaded stores. */
async function device(id: string): Promise<Stores> {
  devices.current = new Map();
  devices.id = id;
  vi.resetModules();
  const stores: Stores = {
    profiles: await import('../profile-store'),
    progress: await import('../progress-store'),
    sync: await import('../sync-store'),
    edit: await import('../../logic/profiles/edit-profile'),
  };
  stores.sync.setSyncApiForTests(null);
  return stores;
}

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = ORIGIN;
  vi.stubGlobal('fetch', worker.fetchImpl);
});
afterAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_BASE;
  vi.unstubAllGlobals();
});

describe('a learner rename reaches the class and family rosters (F-PROF-001)', () => {
  let learnerId = '';
  let rescueCode = '';

  it("create 'test', sync, join a class and a family, rename to 'Sungjoo' in the edit screen, sync: both rosters say 'Sungjoo'", async () => {
    const one = await device('device-one-0001');
    const created = one.profiles.useProfileStore.getState().createProfile({ displayName: 'test', ageGroup: '8-9', avatar: 'hoya-orange' });
    learnerId = created.id;
    one.progress.useProgressStore.setState({ byProfile: { [learnerId]: snap(learnerId) }, hydratedFor: new Set([learnerId]) });

    const first = await one.sync.useSyncStore.getState().syncNow(learnerId);
    expect(first.status).toBe('synced');
    rescueCode = first.rescueCode ?? '';
    const client = one.sync.syncApi();
    if (!client || !first.secret) throw new Error('not registered');
    const creds = { deviceId: 'device-one-0001', secret: first.secret };
    await client.joinSpace('space:class', { code: 'CLASS1', learnerId }, creds);
    await client.joinSpace('space:family', { code: 'FAM1', learnerId }, creds);
    expect(worker.roster('space:class')).toEqual(['test']);

    const original = one.profiles.useProfileStore.getState().profiles[0]!;
    const state = { original, draft: { ...one.edit.initialEditDraft(original), name: 'Sungjoo' }, agreed: false, pin: null, guardianAcceptedAt: 't', selfAcceptedAt: null, parentPinHash: 'hash' };
    const track = vi.fn();
    const result = await one.edit.submitEdit(state, {
      hashPin: async (p) => p,
      acceptGuardianConsent: () => undefined,
      acceptSelfConsent: () => undefined,
      setParentPinHash: () => undefined,
      updateProfile: (id, patch) => one.profiles.useProfileStore.getState().updateProfile(id, patch),
      track,
    });
    expect(result).toEqual({ ok: true });
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ name: 'profile.updated', payload: { field: 'name' } }));
    await vi.waitFor(() => expect(one.sync.useSyncStore.getState().byLearner[learnerId]?.pendingProfile).not.toBeNull());

    await one.sync.useSyncStore.getState().syncNow(learnerId);
    expect(worker.roster('space:class')).toEqual(['Sungjoo']);
    expect(worker.roster('space:family')).toEqual(['Sungjoo']);
    expect(one.sync.useSyncStore.getState().byLearner[learnerId]?.pendingProfile).toBeNull();
    // Only name and `at` went up: never who is learning, the PIN or consent.
    expect(worker.patchBodies).toEqual([{ displayName: 'Sungjoo', at: expect.any(String) }]);
  });

  it("a Rescue Code claimed on a new device after the rename restores 'Sungjoo'", async () => {
    const two = await device('device-two-0002');
    const claimed = await two.sync.useSyncStore.getState().claimRescueCode(rescueCode);
    expect(claimed.ok).toBe(true);
    expect(two.profiles.useProfileStore.getState().profiles.find((p) => p.id === learnerId)?.displayName).toBe('Sungjoo');
  });

  it("a second device that still says 'test' and has no edit waiting takes 'Sungjoo' from the inbox", async () => {
    const three = await device('device-three-03');
    // This device restored the learner before the rename: same id, the old name, no edit of its own.
    const code = [...worker.codes.keys()][0]!;
    three.profiles.useProfileStore.setState({ profiles: [{ id: learnerId, displayName: 'test', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: 't' }], activeId: learnerId, hydrated: true });
    const claim = await three.sync.syncApi()!.claimRescueCode(code, 'device-three-03');
    if (claim.status !== 'ok') throw new Error('claim failed');
    three.sync.useSyncStore.getState().adoptCredentials(learnerId, claim.secret, 0);
    // The restore over the existing profile is skipped here on purpose: only the inbox read changes the name.
    await three.sync.syncApi()!.getInbox(learnerId, { deviceId: 'device-three-03', secret: claim.secret });
    await vi.waitFor(() => expect(three.profiles.useProfileStore.getState().profiles[0]?.displayName).toBe('Sungjoo'));
    expect(three.sync.useSyncStore.getState().byLearner[learnerId]?.pendingProfile ?? null).toBeNull();
  });

  it("the reported learner: renamed on an older build that never sent it, the first start of this build fixes the roster with no new edit", async () => {
    const old = await device('device-four-004');
    // The older build: registered as 'test', renamed on the device only (no PATCH existed), the marker not set.
    const created = old.profiles.useProfileStore.getState().createProfile({ displayName: 'test', ageGroup: '8-9', avatar: 'hoya-orange' });
    old.progress.useProgressStore.setState({ byProfile: { [created.id]: snap(created.id) }, hydratedFor: new Set([created.id]) });
    await old.sync.useSyncStore.getState().syncNow(created.id);
    const client = old.sync.syncApi()!;
    const secret = old.sync.useSyncStore.getState().byLearner[created.id]!.secret!;
    await client.joinSpace('space:class', { code: 'CLASS1', learnerId: created.id }, { deviceId: 'device-four-004', secret });
    old.profiles.useProfileStore.setState({ profiles: [{ ...created, displayName: 'Sungjoo' }], hydrated: true });
    expect(worker.roster('space:class')).toContain('test');

    const before = worker.patchBodies.length;
    await old.sync.useSyncStore.getState().syncAll();
    expect(worker.roster('space:class').filter((name) => name === 'test')).toEqual([]);
    expect(worker.patchBodies.length).toBe(before + 1);
    await old.sync.useSyncStore.getState().syncAll();
    expect(worker.patchBodies.length).toBe(before + 1);
  });
});

