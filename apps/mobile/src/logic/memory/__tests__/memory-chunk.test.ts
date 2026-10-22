import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The memory chunk's wiring (F-CURR-002 row CM-12): the runtime on the app's stores, storage and
 * network. Storage is an in-memory map; the network is a spy.
 */
const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => (disk.has(k) ? JSON.parse(disk.get(k)!) : null)),
  readJsonStrict: vi.fn(async (k: string) => (disk.has(k) ? JSON.parse(disk.get(k)!) : null)),
  readJsonExact: vi.fn(async (k: string) => (disk.has(k) ? JSON.parse(disk.get(k)!) : null)),
  writeJson: vi.fn(async (k: string, v: unknown) => void disk.set(k, JSON.stringify(v))),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async (k: string) => void disk.delete(k)),
  listKeys: vi.fn(async () => [...disk.keys()]),
  setWriteFence: vi.fn(),
}));
const sent = vi.hoisted(() => [] as Array<{ name: string; payload?: unknown }>);
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async (e: { name: string }) => void sent.push(e)) }));
vi.mock('../../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined, isAppVisible: () => true }));
vi.mock('../../../platform/app-root', () => ({ peekBootIntent: () => null, consumeBootIntent: () => undefined }));
const api = vi.hoisted(() => ({ base: null as string | null }));
vi.mock('../../../platform/sync-api', async (original) => ({ ...(await original<object>()), apiBaseUrl: () => api.base }));

import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { useSyncStore } from '../../../store/sync-store';
import { MEMORY_KEY } from '../keys';
import { MEMORY_CHUNK, memoryRuntime } from '../memory-chunk';
import { finished } from './fixtures';

const ID = 'profile:mina';
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeEach(() => {
  disk.clear();
  sent.length = 0;
  api.base = null;
  useProfileStore.setState({ profiles: [{ id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-blue', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' }], activeId: ID, hydrated: true });
  useProgressStore.setState({ byProfile: { [ID]: { ...finished(12, ID), memSeededAt: undefined } }, hydratedFor: new Set([ID]) });
});

describe('the memory chunk', () => {
  it('carries its marker and holds one runtime', () => {
    expect(MEMORY_CHUNK).toBe('memory-chunk:runtime');
    expect(memoryRuntime()).toBe(memoryRuntime());
  });

  it('seeds through the progress store: memSeededAt and cellBest latched, items.seeded sent, the store saved', async () => {
    const rt = memoryRuntime();
    await rt.ensureSeeded(ID);
    const snap = useProgressStore.getState().byProfile[ID];
    expect(snap?.memSeededAt).toMatch(/^2026|^20\d\d-/);
    expect(sent.filter((e) => e.name === 'items.seeded')).toHaveLength(1);
    await rt.flush(ID);
    expect(disk.has(MEMORY_KEY(ID))).toBe(true);
    expect(JSON.parse(disk.get(`progress:${ID}`) ?? '{}').memSeededAt).toBe(snap?.memSeededAt);
  });

  it('a profile not on this device, or not hydrated, is never seeded', async () => {
    useProgressStore.setState({ hydratedFor: new Set() });
    useProgressStore.setState({ hydrate: async () => undefined } as never);
    await memoryRuntime().ensureSeeded('profile:gone');
    expect(sent.filter((e) => e.name === 'items.seeded')).toEqual([]);
  });

  it('records a word answer of a collected topic word through the progress store', async () => {
    const snap = useProgressStore.getState().byProfile[ID];
    useProgressStore.setState({
      byProfile: { [ID]: { ...(snap as NonNullable<typeof snap>), vocab: { v: 1, items: [{ id: 'vocab:sagwa-apple', first: '2026-10-01', seen: 1, right: 1, bestBox: 1, last: '2026-10-01', box: 1, due: '2026-10-02', at: '2026-10-01T00:00:00.000Z' }], topics: [] } } },
    });
    await memoryRuntime().recordAnswers(ID, [{ itemId: 'vocab:sagwa-apple', correct: true, rung: 'read' }], new Date());
    await settle();
    expect(useProgressStore.getState().byProfile[ID]?.vocab?.items[0]?.seen).toBe(2);
  });

  it('syncs only with an API, sync on and a registered learner', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { cursor: 0, shards: [] } }), { status: 200 }));
    await memoryRuntime().sync(ID);
    expect(fetchSpy).not.toHaveBeenCalled();
    api.base = 'https://api.test';
    useSyncStore.setState({ byLearner: {} });
    await memoryRuntime().sync(ID);
    expect(fetchSpy).not.toHaveBeenCalled();
    disk.set(`sync:${ID}`, JSON.stringify({ secret: 'device-secret', rev: 1 }));
    useSyncStore.setState({ byLearner: {} });
    await memoryRuntime().pull(ID);
    expect(fetchSpy).toHaveBeenCalledWith(`https://api.test/api/sync/learners/${encodeURIComponent(ID)}/memory?since=0`, expect.objectContaining({ headers: { Authorization: 'Device device-test:device-secret' } }));
    fetchSpy.mockRestore();
  });
});
