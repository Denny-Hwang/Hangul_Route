import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { STORAGE_TELEMETRY_PAYLOADS, type StorageTelemetryName } from '@hangul-route/content-schema/storage-telemetry';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.9 (row DP-3): where the learner app sends the storage events. The stores run
 * on the web storage wrapper over an IndexedDB stand-in holding raw strings (as `progress-store-durable.test.ts` and
 * `profile-store-durable.test.ts`), with fresh store modules per test, so nothing one test sent is remembered by the next.
 * - `storage.read_failed`: a profile record's `durableRead` ends `failed`; a learner's progress enters `loadFailedFor`
 *   (on the way in only); `withStored` answers `fresh` (once per learner per launch).
 * - `storage.write_failed`: the first `unsaved` of a run (never `step-failed`).
 * - `storage.write_recovered`: a write that lands after it, with the writes it took.
 * Every event is codes only: no profile id, and a payload the Worker's strict schema accepts.
 */
const idb = vi.hoisted(() => ({
  mem: new Map<string, string>(),
  /** Keys whose reads (on any connection) and transactions reject. */
  failing: null as RegExp | null,
  /** Keys whose writes reject (the read before them works). */
  failingWrite: null as RegExp | null,
}));
vi.mock('idb-keyval', () => {
  const broken = (k: string): boolean => idb.failing !== null && idb.failing.test(k);
  const brokenWrite = (k: string): boolean => idb.failingWrite !== null && idb.failingWrite.test(k);
  return {
    get: vi.fn(async (k: string) => {
      if (broken(k)) throw new Error('idb read failed');
      return idb.mem.get(k);
    }),
    set: vi.fn(async (k: string, v: string) => {
      if (broken(k) || brokenWrite(k)) throw new Error('idb write failed');
      idb.mem.set(k, v);
    }),
    del: vi.fn(async (k: string) => {
      if (broken(k)) throw new Error('idb delete failed');
      idb.mem.delete(k);
    }),
    keys: vi.fn(async () => [...idb.mem.keys()]),
    clear: vi.fn(async () => idb.mem.clear()),
    createStore: vi.fn(() => vi.fn(async () => undefined)),
    update: vi.fn(async (k: string, next: (old: string | undefined) => string) => {
      await Promise.resolve();
      if (broken(k)) throw new Error('idb read failed');
      const value = next(idb.mem.get(k));
      if (brokenWrite(k)) throw new Error('idb write failed');
      idb.mem.set(k, value);
    }),
  };
});
vi.mock('../../platform/storage', async () => await import('../../platform/storage.web'));
vi.mock('../grown-up-session', () => ({ closeGrownUpSession: vi.fn() }));
vi.mock('../../platform/profiles-channel', () => ({ postProfilesChanged: vi.fn(), subscribeProfilesChanged: vi.fn(() => () => undefined) }));
type Sent = { name: string; profileId?: string; payload?: Record<string, unknown> };
const sent = vi.hoisted(() => [] as Sent[]);
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async (event: Sent) => {
    sent.push(event);
    return true;
  }),
}));

import type * as ProfileStore from '../profile-store';
import type * as ProgressStore from '../progress-store';

let useProfileStore: typeof ProfileStore.useProfileStore;
let progress: typeof ProgressStore;

const LIST = 'hr:profiles';
const ACTIVE = 'hr:profiles:active';
const TOMBSTONES = 'hr:profiles:tombstones';
const KEY = 'hr:progress:p1';
const learner = (id: string) => ({ id, displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-pink', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' });

const saved = (): ProgressSnapshot => ({
  profileId: 'p1',
  updatedAt: '2026-11-01T09:00:00.000Z',
  episodes: [],
  quests: [{ questId: 'quest:a', episodeId: 'episode:e', startedAt: '2026-11-01T09:00:00.000Z', completedAt: '2026-11-01T09:05:00.000Z', stars: 3, attempts: 1, accuracy: 1 }],
  cards: [{ cardId: 'card:book', unlockedAt: '2026-11-01T09:05:00.000Z', newSinceLastView: false }],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 4,
  questDoneAt: { 'quest:a': '2026-11-01T09:05:00.000Z' },
});
const TRUNCATED = JSON.stringify(saved()).slice(0, 60);

const reads = (): Record<string, unknown>[] => sent.filter((e) => e.name === 'storage.read_failed').map((e) => e.payload ?? {});
const names = (): string[] => sent.map((e) => e.name).filter((n) => n.startsWith('storage.'));
const finish = (questId: string): void =>
  progress.useProgressStore.getState().recordQuestComplete('p1', { questId, episodeId: 'episode:e', stars: 2, accuracy: 0.8, attempts: 1 });

async function settle(): Promise<void> {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

/** Every storage event sent is codes only: no profile id, nothing but its name and payload, and a payload the Worker keeps whole. */
function expectCodesOnly(): void {
  for (const event of sent.filter((e) => e.name.startsWith('storage.'))) {
    expect(event.profileId, event.name).toBeUndefined();
    expect(Object.keys(event).sort(), event.name).toEqual(['name', 'payload']);
    expect(STORAGE_TELEMETRY_PAYLOADS[event.name as StorageTelemetryName].safeParse(event.payload).success, JSON.stringify(event)).toBe(true);
  }
  expect(JSON.stringify(sent)).not.toMatch(/p1|Suni|profile:/);
}

beforeEach(async () => {
  idb.mem.clear();
  idb.failing = null;
  idb.failingWrite = null;
  sent.length = 0;
  vi.resetModules();
  ({ useProfileStore } = await import('../profile-store'));
  progress = await import('../progress-store');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('[DP] storage.read_failed: the profile records (section 3.1)', () => {
  it('a list read that fails twice sends read, once, however often it is tried again', async () => {
    idb.mem.set(LIST, JSON.stringify([learner('profile:a')]));
    idb.failing = /^hr:profiles$/;
    await useProfileStore.getState().hydrate();
    await useProfileStore.getState().hydrate();
    await useProfileStore.getState().hydrate();
    expect(useProfileStore.getState().loadFailed).toBe('read');
    expect(reads()).toEqual([{ record: 'profiles', cause: 'read', kept: false }]);
    expectCodesOnly();
  });

  it('damaged list bytes kept at profiles-corrupt send parse with kept, and never the bytes', async () => {
    idb.mem.set(LIST, '[{"id":"profile:a","displayName":"Suni"');
    await useProfileStore.getState().hydrate();
    expect(useProfileStore.getState().loadFailed).toBe('parse');
    expect(idb.mem.get('hr:profiles-corrupt')).toBe('[{"id":"profile:a","displayName":"Suni"');
    expect(reads()).toEqual([{ record: 'profiles', cause: 'parse', kept: true }]);
    expectCodesOnly();
  });

  it('the active key and the tombstones are named apart when they fail alone', async () => {
    idb.mem.set(LIST, JSON.stringify([learner('profile:a')]));
    idb.mem.set(ACTIVE, '"profile:a');
    idb.mem.set(TOMBSTONES, '{"v":1');
    idb.mem.set('hr:progress:profile:a', '{}');
    await useProfileStore.getState().hydrate();
    expect(useProfileStore.getState().hydrated).toBe(true);
    // [DP] Row DP-1e (OD-DP5): the hydrate keeps damaged tombstone bytes at `tombstones-corrupt` before it rebuilds
    // them (here the active key does not read, so nothing is rebuilt), so the tombstones say `kept`.
    expect(reads()).toEqual(
      expect.arrayContaining([
        { record: 'active', cause: 'parse', kept: false },
        { record: 'tombstones', cause: 'parse', kept: true },
      ]),
    );
    expect(reads()).toHaveLength(2);
    expectCodesOnly();
  });

  it('records that read send nothing', async () => {
    idb.mem.set(LIST, JSON.stringify([learner('profile:a')]));
    idb.mem.set(ACTIVE, JSON.stringify('profile:a'));
    await useProfileStore.getState().hydrate();
    expect(names()).toEqual([]);
  });
});

describe('[DP] storage.read_failed: progress (section 3.2)', () => {
  it('a read that fails sends read once, on the way into loadFailedFor; a re-read that fails again sends nothing', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    idb.failing = /^hr:progress:p1$/;
    await progress.useProgressStore.getState().hydrate('p1');
    expect(progress.useProgressStore.getState().loadFailedFor.has('p1')).toBe(true);
    await progress.useProgressStore.getState().hydrate('p1');
    await progress.useProgressStore.getState().hydrate('p1');
    expect(reads()).toEqual([{ record: 'progress', cause: 'read', kept: false }]);
    // The read works again: the learner leaves the set, and nothing more is sent.
    idb.failing = null;
    await progress.useProgressStore.getState().hydrate('p1');
    expect(progress.useProgressStore.getState().loadFailedFor.has('p1')).toBe(false);
    expect(reads()).toHaveLength(1);
    expectCodesOnly();
  });

  it('damaged bytes whose copy cannot be kept send parse without kept', async () => {
    idb.mem.set(KEY, TRUNCATED);
    idb.failing = /progress-corrupt/;
    await progress.useProgressStore.getState().hydrate('p1');
    expect(progress.useProgressStore.getState().loadFailedFor.has('p1')).toBe(true);
    expect(reads()).toEqual([{ record: 'progress', cause: 'parse', kept: false }]);
    expectCodesOnly();
  });

  it('a stored value that parses to no snapshot, whose copy cannot be kept, is parse too', async () => {
    idb.mem.set(KEY, '[1,2,3]');
    idb.failing = /progress-corrupt/;
    await progress.useProgressStore.getState().hydrate('p1');
    expect(reads()).toEqual([{ record: 'progress', cause: 'parse', kept: false }]);
  });

  it('a read step that throws on a stored record that parsed is parse, nothing kept', async () => {
    // An object (so no copy is made) the merge cannot read, and a write held in memory to merge with it.
    idb.mem.set(KEY, JSON.stringify({ profileId: 'p1', quests: 5 }));
    finish('quest:b');
    await progress.useProgressStore.getState().hydrate('p1');
    await settle();
    expect(progress.useProgressStore.getState().loadFailedFor.has('p1')).toBe(true);
    expect(reads()).toEqual([{ record: 'progress', cause: 'parse', kept: false }]);
  });

  it('AU-3 keeping a damaged record and starting it fresh sends parse with kept, once per learner per launch', async () => {
    idb.mem.set(KEY, TRUNCATED);
    await progress.useProgressStore.getState().hydrate('p1');
    expect(progress.useProgressStore.getState().freshFor.has('p1')).toBe(true);
    expect(progress.useProgressStore.getState().loadFailedFor.has('p1')).toBe(false);
    expect(reads()).toEqual([{ record: 'progress', cause: 'parse', kept: true }]);
    // Damaged again in the same launch (another tab, a bad write): the next write starts it fresh again, and sends nothing.
    idb.mem.set(KEY, TRUNCATED);
    await expect(progress.withStored('p1', () => saved())).resolves.toBe('fresh');
    expect(reads()).toHaveLength(1);
    expectCodesOnly();
  });

  it("withStored tells the cause, and kept once the damaged bytes were copied aside, even when the fresh start's step throws", async () => {
    const thrower = (): ProgressSnapshot => {
      throw new Error('merge cannot read this');
    };
    idb.mem.set(KEY, TRUNCATED);
    const damaged: { cause?: 'read' | 'parse'; kept?: boolean } = {};
    await expect(progress.withStored('p1', thrower, damaged)).resolves.toBe('step-failed');
    expect(damaged).toEqual({ cause: 'parse', kept: true });
    idb.mem.set(KEY, JSON.stringify(saved()));
    idb.failing = /^hr:progress:p1$/;
    const unreadable: { cause?: 'read' | 'parse'; kept?: boolean } = {};
    await expect(progress.withStored('p1', thrower, unreadable)).resolves.toBe('unread');
    expect(unreadable).toEqual({ cause: 'read' });
    // A fresh start whose step threw is no `fresh` answer: nothing is sent from withStored.
    expect(reads()).toEqual([]);
  });

  it('a read for a learner removed from this device sends nothing', async () => {
    idb.mem.set(KEY, JSON.stringify(saved()));
    idb.failing = /^hr:progress:p1$/;
    const { notifyProfileRemoved } = await import('../profile-removal');
    notifyProfileRemoved('p1');
    await progress.useProgressStore.getState().hydrate('p1');
    expect(reads()).toEqual([]);
  });
});

describe('[DP] storage.write_failed and storage.write_recovered (section 3.7)', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    idb.mem.set(KEY, JSON.stringify(saved()));
    await progress.useProgressStore.getState().hydrate('p1');
    await settle();
    sent.length = 0;
  });

  /** Moves the fake clock and lets the writes it starts run. */
  async function wait(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    await settle();
  }

  it('a full disk: one write_failed for the run, then write_recovered with the writes it took', async () => {
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:b');
    await settle();
    expect(progress.useProgressStore.getState().saveFailedFor.has('p1')).toBe(true);
    expect(names()).toEqual(['storage.write_failed']);
    // The first timed retry (1 s) and a new write both fail: still one write_failed.
    finish('quest:c');
    await settle();
    await wait(progress.SAVE_RETRY_DELAYS_MS[0] ?? 0);
    expect(names()).toEqual(['storage.write_failed']);
    // Space is freed: the second timed retry (4 s) lands, the third write after the failed one.
    idb.failingWrite = null;
    await wait(progress.SAVE_RETRY_DELAYS_MS[1] ?? 0);
    expect(progress.useProgressStore.getState().saveFailedFor.has('p1')).toBe(false);
    expect(sent.filter((e) => e.name.startsWith('storage.'))).toEqual([
      { name: 'storage.write_failed', payload: { record: 'progress' } },
      { name: 'storage.write_recovered', payload: { record: 'progress', tries: 3 } },
    ]);
    expectCodesOnly();
  });

  it('a save that lands on its first retry sends tries 1, and a later failure starts a new run', async () => {
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:b');
    await settle();
    idb.failingWrite = null;
    await wait(progress.SAVE_RETRY_DELAYS_MS[0] ?? 0);
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:c');
    await settle();
    expect(sent.filter((e) => e.name.startsWith('storage.')).map((e) => [e.name, e.payload?.tries])).toEqual([
      ['storage.write_failed', undefined],
      ['storage.write_recovered', 1],
      ['storage.write_failed', undefined],
    ]);
  });

  it('past the three timed retries, the landing write counts as four', async () => {
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:b');
    await settle();
    for (const delay of progress.SAVE_RETRY_DELAYS_MS) await wait(delay);
    idb.failingWrite = null;
    finish('quest:c');
    await settle();
    expect(sent.at(-1)).toEqual({ name: 'storage.write_recovered', payload: { record: 'progress', tries: 4 } });
  });

  it("a hydrate whose merged write does not land sends write_failed (the learner is hydrated, only the write is pending)", async () => {
    vi.resetModules();
    progress = await import('../progress-store');
    sent.length = 0;
    idb.failingWrite = /^hr:progress:p1$/;
    // A write held before the read: the hydrate merges it and writes the result, which does not land.
    finish('quest:b');
    await progress.useProgressStore.getState().hydrate('p1');
    await settle();
    expect(progress.useProgressStore.getState().hydratedFor.has('p1')).toBe(true);
    expect(progress.useProgressStore.getState().saveFailedFor.has('p1')).toBe(true);
    expect(names()).toEqual(['storage.write_failed']);
    expectCodesOnly();
  });

  it("a later write whose step throws ('step-failed') sends no write_failed, and is no try of a failed run", async () => {
    // Another tab stored an object the merge cannot read, and this tab holds a change of its own.
    const unreadable = JSON.stringify({ profileId: 'p1', quests: 5 });
    finish('quest:b');
    await settle();
    idb.mem.set(KEY, unreadable);
    finish('quest:c');
    await settle();
    expect(progress.useProgressStore.getState().saveFailedFor.has('p1')).toBe(false);
    expect(names()).toEqual([]);
    // A failed run, then a write whose step throws, then the write that lands: the throwing one is not counted.
    idb.mem.set(KEY, JSON.stringify(saved()));
    idb.failingWrite = /^hr:progress:p1$/;
    finish('quest:d');
    await settle();
    expect(names()).toEqual(['storage.write_failed']);
    idb.failingWrite = null;
    idb.mem.set(KEY, unreadable);
    finish('quest:e');
    await settle();
    expect(names()).toEqual(['storage.write_failed']);
    idb.mem.set(KEY, JSON.stringify(saved()));
    await wait(progress.SAVE_RETRY_DELAYS_MS[0] ?? 0);
    expect(sent.at(-1)).toEqual({ name: 'storage.write_recovered', payload: { record: 'progress', tries: 1 } });
  });

  it('writes that land send nothing', async () => {
    finish('quest:b');
    finish('quest:c');
    await settle();
    await wait(20_000);
    expect(names()).toEqual([]);
  });
});
