import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, unknown>();
vi.mock('../storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  readJsonStrict: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, JSON.parse(JSON.stringify(v)));
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
vi.mock('../app-visibility', () => ({ subscribeAppVisibility: () => () => undefined, isAppVisible: () => true }));
vi.mock('../sync-api', () => ({ apiBaseUrl: () => null }));

/**
 * The app's clip store over the generated map (AMENDMENTS-AUDIO-CLIPS AC-B6, row AC-6): the start map's jamo-s1 clips,
 * and each pack map chunk loaded on demand under its switch (AC-B8).
 */
const ORIGINAL_ENV = { ...process.env };
const NA = 'audio/say/1098bbe54520ab2a.mp3';
const loads: string[] = [];

function mockMap(): void {
  vi.doMock('../../content/__generated__/audio-assets', () => ({
    AUDIO_ASSETS: { 'audio/jamo/giyeok.mp3': 7 },
    AUDIO_ASSET_PACKS: { 'audio/jamo/giyeok.mp3': 'jamo-s1' },
    AUDIO_CLIP_COUNT: 2,
    AUDIO_CHUNK_PACKS: ['stage1'],
  }));
  vi.doMock('../../content/__generated__/audio-pack-loaders', () => ({
    loadAudioPackChunk: (pack: string) => {
      loads.push(pack);
      return pack === 'stage1' ? Promise.resolve({ AUDIO_PACK: { pack: 'stage1', clips: { [NA]: 9 }, units: { 'quest:stage1-letters-q1': [0] } } }) : undefined;
    },
  }));
  vi.doMock('../audio', () => ({ warmClips: (refs: readonly string[]) => (warmed.push(...refs), Promise.resolve()) }));
}

const warmed: string[] = [];

async function load() {
  vi.resetModules();
  mockMap();
  const store = await import('../audio-assets-store');
  const chunk = await import('../clip-packs-chunk');
  const config = await import('../../store/remote-config-store');
  return { store, chunk, config };
}

const copy = (flags: Record<string, { on: boolean; pct: number }>) => ({ v: 1 as const, fetchedAt: Date.now(), maxAgeS: 300, flags });

beforeEach(() => {
  mem.clear();
  loads.length = 0;
  warmed.length = 0;
  process.env = { ...ORIGINAL_ENV };
  delete process.env.EXPO_PUBLIC_AUDIO_CLIPS;
  delete process.env.EXPO_PUBLIC_AUDIO_CLIP_PACKS;
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.doUnmock('../../content/__generated__/audio-assets');
  vi.doUnmock('../../content/__generated__/audio-pack-loaders');
  vi.doUnmock('../audio');
});

describe('platform/audio-assets-store and the clip pack loader chunk', { timeout: 20_000 }, () => {
  it("the registry reads the start map, own keys only, and a chunk's clips once it is loaded", async () => {
    const { store, chunk } = await load();
    expect(store.clipRegistry.packOf('audio/jamo/giyeok.mp3')).toBe('jamo-s1');
    expect(store.clipRegistry.packOf('audio/jamo/nieun.mp3')).toBeUndefined();
    expect(store.clipRegistry.packOf('toString')).toBeUndefined();
    expect(store.clipRegistry.packOf(NA)).toBeUndefined();
    expect(store.clipRegistry.packHas('stage1')).toBe(true);
    expect(store.clipRegistry.packHas('stories')).toBe(false);
    expect(store.clipRegistry.size).toBe(2);
    await chunk.prepareClips({ scopes: ['stage1'], units: ['quest:stage1-letters-q1'] });
    expect(loads).toEqual(['stage1']);
    expect(store.clipRegistry.packOf(NA)).toBe('stage1');
    expect(store.clipRegistry.asset(NA)).toBe(9);
    // The warm-up runs after the packs are in: the lesson's clips, through warmClips.
    await vi.waitFor(() => expect(warmed).toEqual([NA]));
  });

  it('a lesson opening loads its stage and warms its own and the next lesson\'s clips (lessonClipPlan)', async () => {
    const { chunk } = await load();
    await chunk.prepareClips({ questId: 'quest:stage1-letters-q1' });
    expect(loads).toEqual(['stage1']);
    await vi.waitFor(() => expect(warmed).toEqual([NA]));
  });

  it('the store counts the loader chunk and its packs as pending while they load', async () => {
    const { store } = await load();
    store.prepareClips({ scopes: ['stage1'], units: [] });
    const pending = store.clipRegistry.pending();
    expect(pending).not.toBeNull();
    await pending;
    expect(store.clipRegistry.has(NA)).toBe(true);
  });

  it('a pack switched off remotely is never loaded (AC-B8)', async () => {
    const { chunk, config, store } = await load();
    config.useRemoteConfigStore.setState({ hydrated: true, cache: copy({ 'audioPack.stage1': { on: false, pct: 100 } }) });
    await expect(chunk.clipPackLoader.loadPack('stage1')).resolves.toBe(false);
    expect(loads).toEqual([]);
    expect(store.clipRegistry.has(NA)).toBe(false);
  });

  it('a pack off at the build ceiling (EXPO_PUBLIC_AUDIO_CLIP_PACKS) is never loaded', async () => {
    process.env.EXPO_PUBLIC_AUDIO_CLIP_PACKS = 'jamo-s1';
    const { chunk } = await load();
    await chunk.clipPackLoader.loadFor('stage1');
    expect(loads).toEqual([]);
  });
});
