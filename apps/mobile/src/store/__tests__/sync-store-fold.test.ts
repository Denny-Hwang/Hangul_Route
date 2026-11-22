import { SnapshotPutSchema, type ProgressSnapshot, type ProgressSummary } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.2, row DP-1a (tests 3, 13 and the adopt half of 4 of section 6): when AU-3
 * starts a damaged record fresh, the learner's next push folds the server copy in first (`getSnapshot`, then the same
 * merge and plan reconcile a conflict uses) and pushes from the server's own `rev`; never an invented one. The stores
 * run on the web storage wrapper over an IndexedDB stand-in holding raw strings, so the damaged bytes, the kept copy
 * (`hr:progress-corrupt:<id>`) and the sync record (`hr:sync:<id>`) are what is stored.
 */
const idb = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  /** While set, every read and every transaction of a key that matches rejects. */
  failing: null as RegExp | null,
  /** While set, a write of a key that matches rejects (the read before it works): a full disk. */
  failingWrite: null as RegExp | null,
  /** While set, a transaction of a key that matches waits for it before it writes. */
  gate: null as { key: RegExp; until: Promise<void> } | null,
}));
vi.mock('idb-keyval', () => {
  const broken = (k: string): boolean => idb.failing !== null && idb.failing.test(k);
  return {
    get: vi.fn(async (k: string) => {
      if (broken(k)) throw new Error('idb read failed');
      return idb.mem.get(k);
    }),
    set: vi.fn(async (k: string, v: string) => {
      if (broken(k)) throw new Error('idb write failed');
      idb.mem.set(k, v);
    }),
    del: vi.fn(async (k: string) => {
      idb.mem.delete(k);
    }),
    keys: vi.fn(async () => [...idb.mem.keys()]),
    clear: vi.fn(async () => idb.mem.clear()),
    createStore: vi.fn(),
    update: vi.fn(async (k: string, next: (old: string | undefined) => string) => {
      await Promise.resolve();
      if (broken(k)) throw new Error('idb read failed');
      const value = next(idb.mem.get(k));
      if (idb.gate && idb.gate.key.test(k)) await idb.gate.until;
      if (idb.failingWrite && idb.failingWrite.test(k)) throw new Error('idb write failed');
      idb.mem.set(k, value);
    }),
  };
});
vi.mock('../../platform/storage', async () => await import('../../platform/storage.web'));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../platform/sync-api', () => ({
  apiBaseUrl: vi.fn(() => 'https://api.example.com'),
  createSyncApi: vi.fn(),
}));
vi.mock('../../config/flags', () => ({
  flags: { syncEnabled: true, telemetryEnabled: false, telemetryNetwork: false, voiceEchoEnabled: false, contentGatingEnabled: false },
  bundleOs: () => undefined,
  gatingActive: () => false,
}));

const ID = 'profile:a';
const PROGRESS = `hr:progress:${ID}`;
const KEPT = `hr:progress-corrupt:${ID}`;
const SYNC = `hr:sync:${ID}`;
const STORED_REV = 7;
const SERVER_REV = 9;

const quest = (questId: string, at: string) => ({ questId, episodeId: 'episode:e', startedAt: at, completedAt: at, stars: 3 as const, attempts: 1, accuracy: 1 });
const snapOf = (quests: string[], cards: string[]): ProgressSnapshot => ({
  profileId: ID,
  updatedAt: '2026-11-01T09:00:00.000Z',
  episodes: [],
  quests: quests.map((q) => quest(q, '2026-11-01T09:05:00.000Z')),
  cards: cards.map((cardId) => ({ cardId, unlockedAt: '2026-11-01T09:05:00.000Z', newSinceLastView: false })),
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 2,
  questDoneAt: Object.fromEntries(quests.map((q) => [q, '2026-11-01T09:05:00.000Z'])),
});
/** What the cloud holds for the learner: everything earned before the record on this device was damaged. */
const SERVER = snapOf(['quest:a', 'quest:b'], ['card:book', 'card:moon']);
const TRUNCATED = JSON.stringify(SERVER).slice(0, 60);

type Body = { baseRev: number; snapshot: ProgressSnapshot; summary: ProgressSummary };
type GetAnswer = { status: 'ok'; rev: number; snapshot: ProgressSnapshot; summary: null } | { status: 'none' } | { status: 'error'; code: string };

/** Every body any test in this file pushed, with the revisions the stored record and the mocked server had given by then (test 13). */
const pushes: { body: Body; given: number[] }[] = [];

function fakeApi(get: GetAnswer = { status: 'ok', rev: SERVER_REV, snapshot: SERVER, summary: null }) {
  const calls: string[] = [];
  const given = [STORED_REV, ...(get.status === 'ok' ? [get.rev] : [])];
  const api = {
    register: vi.fn(async () => ({ status: 'ok', learnerId: ID, secret: 'sec-new' })),
    getSnapshot: vi.fn(async () => {
      calls.push('get');
      return get;
    }),
    putSnapshot: vi.fn(async (_id: string, body: Body) => {
      calls.push('put');
      pushes.push({ body: structuredClone(body), given: [...given] });
      const rev = body.baseRev + 1;
      // The rev this answer gives is one the device may push from next.
      given.push(rev);
      return { status: 'ok', rev };
    }),
    issueRescueCode: vi.fn(async () => ({ status: 'ok', code: 'TIGER-MOON-4821' })),
    claimRescueCode: vi.fn(),
    getInbox: vi.fn(async () => ({ status: 'error', code: 'network' })),
    updateLearnerProfile: vi.fn(async () => ({ status: 'ok', applied: true })),
  };
  return { api, calls };
}

const syncRecord = (): Record<string, unknown> => JSON.parse(idb.mem.get(SYNC) as string) as Record<string, unknown>;
const storeSync = (extra: Record<string, unknown> = {}): void => {
  idb.mem.set(SYNC, JSON.stringify({ secret: 'sec', rev: STORED_REV, lastSyncedAt: '2026-11-01T10:00:00.000Z', rescueCode: 'TIGER-MOON-4821', pendingProfile: null, profileAt: null, ...extra }));
};

async function settle(): Promise<void> {
  for (let i = 0; i < 60; i += 1) await Promise.resolve();
}

/** Fresh store modules, as after a relaunch: every module-level set and every zustand store is new. */
async function launch() {
  vi.resetModules();
  const profiles = await import('../profile-store');
  const progress = await import('../progress-store');
  const sync = await import('../sync-store');
  const plans = await import('../plan-store');
  profiles.useProfileStore.setState({
    profiles: [{ id: ID, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' }],
    activeId: ID,
    hydrated: true,
  });
  plans.usePlanStore.setState({ byLearner: {}, notReady: {} });
  return { useProgressStore: progress.useProgressStore, useSyncStore: sync.useSyncStore, setSyncApiForTests: sync.setSyncApiForTests };
}

beforeEach(() => {
  idb.mem.clear();
  idb.failing = null;
  idb.failingWrite = null;
  idb.gate = null;
});

describe('[DP] a damaged record keeps its cloud copy (test 3)', () => {
  it('AU-3 starts fresh over a kept copy, and the next sync pulls the server copy, merges it and pushes from its rev', async () => {
    const { useProgressStore, useSyncStore, setSyncApiForTests } = await launch();
    storeSync({ copyFolded: true });
    idb.mem.set(PROGRESS, TRUNCATED);
    await useProgressStore.getState().hydrate(ID);
    expect(idb.mem.get(KEPT)).toBe(TRUNCATED);
    expect(useProgressStore.getState().freshFor.has(ID)).toBe(true);
    await settle();
    // The sync store marks the record at once, so a relaunch before the sync still folds.
    expect(syncRecord().copyFolded).toBe(false);

    // Something earned after the fresh start, which must not be lost either.
    useProgressStore.getState().recordQuestComplete(ID, { questId: 'quest:c', episodeId: 'episode:e', stars: 2, accuracy: 0.8, attempts: 1 });
    await settle();
    const { api, calls } = fakeApi();
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow(ID);

    expect(calls).toEqual(['get', 'put']);
    const body = api.putSnapshot.mock.calls[0]?.[1] as Body;
    expect(body.baseRev).toBe(SERVER_REV);
    expect(body.snapshot.quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:b', 'quest:c']);
    expect(body.snapshot.cards.map((c) => c.cardId)).toEqual(expect.arrayContaining(['card:book', 'card:moon']));
    const memory = useProgressStore.getState().byProfile[ID];
    expect(memory?.quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:b', 'quest:c']);
    expect(memory?.cards.map((c) => c.cardId)).toEqual(expect.arrayContaining(['card:book', 'card:moon']));
    expect(state).toMatchObject({ status: 'synced', rev: SERVER_REV + 1, copyFolded: true });
    await settle();
    expect(syncRecord()).toMatchObject({ rev: SERVER_REV + 1, copyFolded: true });
    expect(useProgressStore.getState().freshFor.size).toBe(0);
    // Memory took the fold, and so did the stored record.
    const stored = JSON.parse(idb.mem.get(PROGRESS) as string) as ProgressSnapshot;
    expect(stored.quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:b', 'quest:c']);

    // Folded once: the next run pushes as today.
    api.getSnapshot.mockClear();
    await useSyncStore.getState().syncNow(ID);
    expect(api.getSnapshot).not.toHaveBeenCalled();
  });

  it('a relaunch before the sync (copyFolded false on disk, the kept copy present) still folds', async () => {
    storeSync({ copyFolded: false });
    idb.mem.set(KEPT, TRUNCATED);
    idb.mem.set(PROGRESS, JSON.stringify(snapOf([], [])));
    const { useProgressStore, useSyncStore, setSyncApiForTests } = await launch();
    expect(useProgressStore.getState().freshFor.size).toBe(0);
    const { api, calls } = fakeApi();
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow(ID);
    expect(calls).toEqual(['get', 'put']);
    expect((api.putSnapshot.mock.calls[0]?.[1] as Body).baseRev).toBe(SERVER_REV);
    expect(state.copyFolded).toBe(true);
    expect(syncRecord().copyFolded).toBe(true);
  });

  it('a stored sync record from before this release (no copyFolded) reads false, so a kept copy folds once', async () => {
    storeSync();
    idb.mem.set(KEPT, TRUNCATED);
    idb.mem.set(PROGRESS, JSON.stringify(snapOf([], [])));
    const { useSyncStore, setSyncApiForTests } = await launch();
    const { api, calls } = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncNow(ID);
    expect(calls).toEqual(['get', 'put']);
    expect(syncRecord().copyFolded).toBe(true);
  });

  it('getSnapshot answers error: no push in that run, copyFolded stays false, and the next run folds again', async () => {
    storeSync({ copyFolded: false });
    idb.mem.set(KEPT, TRUNCATED);
    idb.mem.set(PROGRESS, JSON.stringify(snapOf([], [])));
    const { useSyncStore, setSyncApiForTests } = await launch();
    const { api } = fakeApi({ status: 'error', code: 'network' });
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow(ID);
    expect(api.putSnapshot).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: 'error', lastError: 'network', copyFolded: false });
    expect(syncRecord()).toMatchObject({ rev: STORED_REV, copyFolded: false });
    await useSyncStore.getState().syncNow(ID);
    expect(api.getSnapshot).toHaveBeenCalledTimes(2);
    expect(api.putSnapshot).not.toHaveBeenCalled();
  });

  it('getSnapshot answers none (no server copy): pushes from the stored rev, then copyFolded true', async () => {
    storeSync({ copyFolded: false });
    idb.mem.set(KEPT, TRUNCATED);
    idb.mem.set(PROGRESS, JSON.stringify(snapOf(['quest:c'], [])));
    const { useProgressStore, useSyncStore, setSyncApiForTests } = await launch();
    const { api, calls } = fakeApi({ status: 'none' });
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow(ID);
    expect(calls).toEqual(['get', 'put']);
    expect((api.putSnapshot.mock.calls[0]?.[1] as Body).baseRev).toBe(STORED_REV);
    expect(state.copyFolded).toBe(true);
    expect(syncRecord().copyFolded).toBe(true);
    expect(useProgressStore.getState().freshFor.size).toBe(0);
  });

  it('copyFolded true and no freshFor entry: no getSnapshot, push as today', async () => {
    storeSync({ copyFolded: true });
    idb.mem.set(KEPT, TRUNCATED);
    idb.mem.set(PROGRESS, JSON.stringify(snapOf(['quest:c'], [])));
    const { useSyncStore, setSyncApiForTests } = await launch();
    const { api, calls } = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncNow(ID);
    expect(calls).toEqual(['put']);
    expect((api.putSnapshot.mock.calls[0]?.[1] as Body).baseRev).toBe(STORED_REV);
  });

  it('a second damage in the same session folds again whatever copyFolded says (freshFor)', async () => {
    storeSync({ copyFolded: true });
    idb.mem.set(KEPT, '{"first":');
    idb.mem.set(PROGRESS, TRUNCATED);
    const { useProgressStore, useSyncStore, setSyncApiForTests } = await launch();
    await useProgressStore.getState().hydrate(ID);
    // The first copy is the one kept.
    expect(idb.mem.get(KEPT)).toBe('{"first":');
    expect(useProgressStore.getState().freshFor.has(ID)).toBe(true);
    // The fresh record holds the welcome card once the learner opens Home; a learner with nothing in memory pushes nothing.
    useProgressStore.getState().ensure(ID);
    const { api, calls } = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncNow(ID);
    expect(calls).toEqual(['get', 'put']);
    expect((api.putSnapshot.mock.calls[0]?.[1] as Body).baseRev).toBe(SERVER_REV);
  });

  it('a second damage whose fresh write is rejected (a full disk), after an earlier fold: the next push still folds first', async () => {
    storeSync({ copyFolded: true });
    idb.mem.set(KEPT, '{"first":');
    idb.mem.set(PROGRESS, TRUNCATED);
    idb.failingWrite = /^hr:progress:/;
    const { useProgressStore, useSyncStore, setSyncApiForTests } = await launch();
    // A quest finished before the record was read: the fresh start has something to write, and that write is refused.
    useProgressStore.getState().recordQuestComplete(ID, { questId: 'quest:c', episodeId: 'episode:e', stars: 2, accuracy: 0.8, attempts: 1 });
    await useProgressStore.getState().hydrate(ID);
    // The damaged path ran, though its write did not land: the learner must fold before any push.
    expect(useProgressStore.getState().freshFor.has(ID)).toBe(true);
    await settle();
    // Nothing fresh landed: the damaged bytes are still there, and the learner holds a near-blank record in memory.
    expect(idb.mem.get(PROGRESS)).toBe(TRUNCATED);
    expect(useProgressStore.getState().hydratedFor.has(ID)).toBe(true);
    const { api, calls } = fakeApi();
    setSyncApiForTests(api as never);
    await useSyncStore.getState().syncAll();
    expect(calls).toEqual(['get', 'put']);
    expect((api.putSnapshot.mock.calls[0]?.[1] as Body).baseRev).toBe(SERVER_REV);
    expect((api.putSnapshot.mock.calls[0]?.[1] as Body).snapshot.quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:b', 'quest:c']);
  });

  it('the copy read rejects (not a SyntaxError): no push in that run; the next run asks again', async () => {
    storeSync({ copyFolded: false });
    idb.mem.set(KEPT, TRUNCATED);
    idb.mem.set(PROGRESS, JSON.stringify(snapOf(['quest:c'], [])));
    const { useSyncStore, setSyncApiForTests } = await launch();
    const { api, calls } = fakeApi();
    setSyncApiForTests(api as never);
    idb.failing = /progress-corrupt/;
    await useSyncStore.getState().syncNow(ID);
    expect(calls).toEqual([]);
    idb.failing = null;
    await useSyncStore.getState().syncNow(ID);
    expect(calls).toEqual(['get', 'put']);
  });

  it('a learner without a kept copy pushes exactly as before: no getSnapshot, the stored rev', async () => {
    storeSync();
    idb.mem.set(PROGRESS, JSON.stringify(snapOf(['quest:c'], [])));
    const { useSyncStore, setSyncApiForTests } = await launch();
    const { api, calls } = fakeApi();
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow(ID);
    expect(calls).toEqual(['put']);
    expect((api.putSnapshot.mock.calls[0]?.[1] as Body).baseRev).toBe(STORED_REV);
    expect(state).toMatchObject({ status: 'synced', rev: STORED_REV + 1, copyFolded: false });
  });

  it('a learner registered in this pass has no server copy: no getSnapshot, the first push sets copyFolded and clears freshFor', async () => {
    idb.mem.set(PROGRESS, TRUNCATED);
    const { useProgressStore, useSyncStore, setSyncApiForTests } = await launch();
    await useProgressStore.getState().hydrate(ID);
    expect(useProgressStore.getState().freshFor.has(ID)).toBe(true);
    useProgressStore.getState().ensure(ID);
    const { api, calls } = fakeApi();
    setSyncApiForTests(api as never);
    const state = await useSyncStore.getState().syncNow(ID);
    expect(api.register).toHaveBeenCalled();
    expect(calls).toEqual(['put']);
    expect((api.putSnapshot.mock.calls[0]?.[1] as Body).baseRev).toBe(0);
    expect(state.copyFolded).toBe(true);
    expect(useProgressStore.getState().freshFor.size).toBe(0);
  });
});

describe('[DP] the fold never sends an invented revision (test 13)', () => {
  it("every push above had an integer baseRev >= 0 that the stored record or the server gave, and passes SnapshotPutSchema's rules; no -1", () => {
    expect(pushes.length).toBeGreaterThan(0);
    const wire = SnapshotPutSchema.omit({ schemaVer: true, contentVer: true });
    for (const { body, given } of pushes) {
      expect(Number.isInteger(body.baseRev)).toBe(true);
      expect(body.baseRev).toBeGreaterThanOrEqual(0);
      expect(body.baseRev).not.toBe(-1);
      // A learner registered in its own pass starts from 0, the rev the registration gave.
      expect([0, ...given]).toContain(body.baseRev);
      expect(wire.safeParse(body).success).toBe(true);
    }
  });
});

describe('[DP] adoptServerLearner waits for its write (test 4, adopt half)', () => {
  it('resolves only after the restored snapshot was written', async () => {
    storeSync({ copyFolded: true });
    idb.mem.set(PROGRESS, JSON.stringify(snapOf(['quest:c'], [])));
    const { useProgressStore, useSyncStore, setSyncApiForTests } = await launch();
    const { api } = fakeApi();
    setSyncApiForTests(api as never);
    await useProgressStore.getState().hydrate(ID);
    await settle();
    let release: () => void = () => undefined;
    const until = new Promise<void>((r) => {
      release = r;
    });
    idb.gate = { key: /^hr:progress:/, until };
    let resolved = false;
    try {
      const adopt = useSyncStore
        .getState()
        .adoptServerLearner({ learner: { id: ID, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' }, secret: 'sec', snapshot: { rev: SERVER_REV, snapshot: SERVER } })
        .then(() => {
          resolved = true;
        });
      // The record was read before; the gate holds the restore's write.
      await settle();
      await new Promise((r) => setTimeout(r, 0));
      expect(resolved).toBe(false);
      release();
      await adopt;
      expect(resolved).toBe(true);
      const stored = JSON.parse(idb.mem.get(PROGRESS) as string) as ProgressSnapshot;
      expect(stored.quests.map((q) => q.questId).sort()).toEqual(['quest:a', 'quest:b', 'quest:c']);
    } finally {
      release();
    }
  });
});
