import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The reported rename end to end against the real Worker (F-PROF-001, F-SYNC-001 section 3.7 SYNC-PROF-1): the app's
 * profile-store, sync-store and sync-api, with every request answered by the backend's Hono app on its in-memory
 * store. A learner registered as 'test' joins a class and a family; the teacher's class roster, the learner report and
 * the family console read the name the app last sent. Each test is a fresh device with its own storage.
 */
const device = vi.hoisted(() => ({ storage: new Map<string, unknown>(), id: 'device-e2e-0001' }));
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => device.storage.get(k) ?? null),
  readJsonStrict: vi.fn(async (k: string) => device.storage.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    device.storage.set(k, v);
  }),
}));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => device.id) }));
vi.mock('../../config/flags', () => ({
  flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false, contentGatingEnabled: false, notesEnabled: false },
  bundleOs: () => undefined,
  gatingActive: () => false,
}));

/** The backend modules this test drives, typed here: the Worker sources are not part of the app's type project. */
interface BackendApp {
  request: (path: string, init?: RequestInit) => Response | Promise<Response>;
}
interface Backend {
  app: BackendApp;
  reset: () => void;
}

// Variable specifiers keep the Worker sources (Cloudflare types) out of the app's typecheck; vitest resolves them.
const BACKEND = '../../../../../packages/backend/src';
async function loadBackend(): Promise<Backend> {
  const runtime = (await import(/* @vite-ignore */ `${BACKEND}/lib/runtime`)) as { setDevFallbacksDefaultForTests: (on: boolean) => void };
  // The backend's own test setup: a bearer token is the user id, and the Db is the in-memory fallback.
  runtime.setDevFallbacksDefaultForTests(true);
  const app = ((await import(/* @vite-ignore */ `${BACKEND}/index`)) as { default: BackendApp }).default;
  const { store } = (await import(/* @vite-ignore */ `${BACKEND}/store`)) as { store: { reset: () => void } };
  return { app, reset: () => store.reset() };
}

const ORIGIN = 'https://api.example.com';
const ORIGINAL_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
const json = { 'content-type': 'application/json' };
const bearer = (user: string): Record<string, string> => ({ ...json, authorization: `Bearer ${user}` });
const snap = (profileId: string): ProgressSnapshot => ({ profileId, updatedAt: '2026-10-01T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 });

let backend: Backend;
const patchBodies: unknown[] = [];

async function worker(method: string, path: string, headers: Record<string, string>, body?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await backend.app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const parsed = (await res.json()) as { data?: Record<string, unknown> };
  return { status: res.status, data: parsed.data ?? {} };
}

type Stores = {
  profiles: typeof import('../profile-store');
  progress: typeof import('../progress-store');
  sync: typeof import('../sync-store');
};

/** A fresh device: its own storage and id, freshly loaded stores. */
async function freshDevice(id: string): Promise<Stores> {
  device.storage = new Map();
  device.id = id;
  vi.resetModules();
  const stores: Stores = { profiles: await import('../profile-store'), progress: await import('../progress-store'), sync: await import('../sync-store') };
  stores.sync.setSyncApiForTests(null);
  return stores;
}

/** A class (teacher) and a family (mom), each with a join code. */
async function spaces(): Promise<{ cls: { id: string; code: string }; fam: { id: string; code: string } }> {
  const make = async (user: string, kind: string, name: string) => {
    const created = await worker('POST', '/api/spaces', bearer(user), { kind, name });
    expect(created.status).toBe(201);
    const id = (created.data.space as { id: string }).id;
    const code = await worker('POST', `/api/spaces/${id}/code`, bearer(user));
    expect(code.status).toBe(200);
    return { id, code: String(code.data.joinCode) };
  };
  return { cls: await make('teacher', 'class', 'Room 3'), fam: await make('mom', 'family', 'Kim family') };
}

/** The name the teacher's class roster, the class learner report, the family console roster and the family report show. */
async function namesSeen(world: { cls: { id: string }; fam: { id: string } }, learnerId: string) {
  const fromRoster = (data: Record<string, unknown>) => (data.learners as Array<{ id: string; displayName: string }>).find((l) => l.id === learnerId)?.displayName;
  const roster = await worker('GET', `/api/spaces/${world.cls.id}/roster`, bearer('teacher'));
  const report = await worker('GET', `/api/spaces/${world.cls.id}/learners/${learnerId}/report`, bearer('teacher'));
  const family = await worker('GET', `/api/spaces/${world.fam.id}/roster`, bearer('mom'));
  const familyReport = await worker('GET', `/api/spaces/${world.fam.id}/learners/${learnerId}/report`, bearer('mom'));
  for (const r of [roster, report, family, familyReport]) expect(r.status).toBe(200);
  return {
    teacherRoster: fromRoster(roster.data),
    learnerReport: (report.data.learner as { displayName: string }).displayName,
    familyConsole: fromRoster(family.data),
    familyReport: (familyReport.data.learner as { displayName: string }).displayName,
  };
}
const everywhere = (name: string) => ({ teacherRoster: name, learnerReport: name, familyConsole: name, familyReport: name });

/** Create the learner on the device, sync (registration), join the class and the family the way the app does. */
async function registeredInSpaces(stores: Stores, name: string) {
  const created = stores.profiles.useProfileStore.getState().createProfile({ displayName: name, ageGroup: '8-9', avatar: 'hoya-orange' });
  stores.progress.useProgressStore.setState({ byProfile: { [created.id]: snap(created.id) }, hydratedFor: new Set([created.id]) });
  const first = await stores.sync.useSyncStore.getState().syncNow(created.id);
  expect(first.status).toBe('synced');
  const world = await spaces();
  const client = stores.sync.syncApi();
  if (!client || !first.secret) throw new Error('not registered');
  const creds = { deviceId: device.id, secret: first.secret };
  expect((await client.joinSpace(world.cls.id, { code: world.cls.code, learnerId: created.id }, creds)).status).toBe('ok');
  expect((await client.joinSpace(world.fam.id, { code: world.fam.code, learnerId: created.id }, creds)).status).toBe('ok');
  return { learnerId: created.id, secret: first.secret, world };
}

beforeAll(async () => {
  backend = await loadBackend();
  process.env.EXPO_PUBLIC_API_BASE_URL = ORIGIN;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (init?.method === 'PATCH') patchBodies.push(JSON.parse(String(init.body)));
      return backend.app.request(`${url.pathname}${url.search}`, init);
    }),
  );
});
beforeEach(() => {
  backend.reset();
  patchBodies.length = 0;
});
afterAll(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_BASE;
  vi.unstubAllGlobals();
});

describe('a learner rename reaches the real Worker (memory backend, F-PROF-001)', () => {
  it("registered as 'test', renamed to 'Sungjoo' on the device, synced: the teacher roster, the learner report and the family console say 'Sungjoo'", async () => {
    const one = await freshDevice('device-e2e-0001');
    one.sync.useSyncStore.setState({ byLearner: {} });
    const { learnerId, world } = await registeredInSpaces(one, 'test');
    expect(await namesSeen(world, learnerId)).toEqual(everywhere('test'));

    one.profiles.useProfileStore.getState().updateProfile(learnerId, { displayName: 'Sungjoo' });
    await vi.waitFor(() => expect(one.sync.useSyncStore.getState().byLearner[learnerId]?.pendingProfile).not.toBeNull());
    const synced = await one.sync.useSyncStore.getState().syncNow(learnerId);

    expect(synced.pendingProfile).toBeNull();
    expect(synced.lastError).toBeNull();
    expect(await namesSeen(world, learnerId)).toEqual(everywhere('Sungjoo'));
    // Only the name and its time went up: never who is learning, the PIN or consent.
    expect(patchBodies).toEqual([{ displayName: 'Sungjoo', at: expect.any(String) }]);
  });

  it('an edit the server already holds a newer one for answers applied false: the device takes the server name, clears the edit and never retries', async () => {
    const one = await freshDevice('device-e2e-0002');
    const { learnerId, secret, world } = await registeredInSpaces(one, 'test');
    // Queued on this device first, while offline...
    one.profiles.useProfileStore.getState().updateProfile(learnerId, { displayName: 'Sungjoo' });
    await vi.waitFor(() => expect(one.sync.useSyncStore.getState().byLearner[learnerId]?.pendingProfile).not.toBeNull());
    // ...and meanwhile a later edit reached the server from another of the learner's devices.
    const later = new Date(Date.now() + 1_000).toISOString();
    const other = await worker('PATCH', `/api/sync/learners/${learnerId}`, { ...json, authorization: `Device ${device.id}:${secret}` }, { displayName: 'Mina', at: later });
    expect(other.data.applied).toBe(true);
    patchBodies.length = 0;

    const synced = await one.sync.useSyncStore.getState().syncNow(learnerId);
    expect(patchBodies).toHaveLength(1);
    expect(synced.pendingProfile).toBeNull();
    expect(one.profiles.useProfileStore.getState().profiles[0]?.displayName).toBe('Mina');
    expect(await namesSeen(world, learnerId)).toEqual(everywhere('Mina'));
    await one.sync.useSyncStore.getState().syncNow(learnerId);
    await one.sync.useSyncStore.getState().syncAll();
    expect(patchBodies).toHaveLength(1);
    expect(one.sync.useSyncStore.getState().byLearner[learnerId]?.pendingProfile ?? null).toBeNull();
  });

  it('a stale row heals with no new edit: the first start of this build re-pushes the device name once, a legacy name included', async () => {
    const old = await freshDevice('device-e2e-0003');
    // The older build: registered as 'test' and joined; the device was renamed to a legacy name (longer than the
    // edit-screen rule allows) that never reached the server. The one-time re-push marker is not set yet.
    const { learnerId, world } = await registeredInSpaces(old, 'test');
    const legacy = 'Alexandria Mae';
    const profile = old.profiles.useProfileStore.getState().profiles[0]!;
    old.profiles.useProfileStore.setState({ profiles: [{ ...profile, displayName: legacy }], activeId: learnerId, hydrated: true });
    expect(await namesSeen(world, learnerId)).toEqual(everywhere('test'));
    expect(old.sync.useSyncStore.getState().byLearner[learnerId]?.pendingProfile ?? null).toBeNull();

    await old.sync.useSyncStore.getState().syncAll();
    expect(await namesSeen(world, learnerId)).toEqual(everywhere(legacy));
    expect(patchBodies).toEqual([{ displayName: legacy, at: expect.any(String) }]);
    expect(device.storage.get(old.sync.PROFILE_PUSH_REPAIR_KEY)).toBe(true);

    // Once only: later syncs send nothing.
    await old.sync.useSyncStore.getState().syncAll();
    expect(patchBodies).toHaveLength(1);
  });
});
