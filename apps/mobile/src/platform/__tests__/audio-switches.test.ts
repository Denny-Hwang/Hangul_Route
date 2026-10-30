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
 * The clip switches the audio adapters hand the controller (AMENDMENTS-AUDIO-CLIPS AC-B8, row AC-1): `audioClips` and
 * `audioPack.<pack>` from the remote config through `currFlagOn`, under the build ceiling, read at each prompt.
 */
const ORIGINAL_ENV = { ...process.env };

async function load() {
  vi.resetModules();
  const switches = await import('../audio-switches');
  const store = await import('../../store/remote-config-store');
  return { switches, store };
}

const copy = (flags: Record<string, { on: boolean; pct: number }>) => ({ v: 1 as const, fetchedAt: 0, maxAgeS: 300, flags });

beforeEach(() => {
  mem.clear();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.EXPO_PUBLIC_AUDIO_CLIPS;
  delete process.env.EXPO_PUBLIC_AUDIO_CLIP_PACKS;
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.doUnmock('../../content/__generated__/audio-assets');
});

describe('platform/audio-switches', () => {
  it('with no copy every switch is on (built-in pct 100), and the first read loads the stored copy', async () => {
    const { switches, store } = await load();
    mem.set('remote-config', copy({ 'audioPack.jamo-s1': { on: false, pct: 100 } }));
    expect(store.useRemoteConfigStore.getState().hydrated).toBe(false);
    expect(switches.clipsSwitchOn()).toBe(true);
    expect(switches.packSwitchOn('jamo-s1')).toBe(true);
    await vi.waitFor(() => expect(store.useRemoteConfigStore.getState().hydrated).toBe(true));
    // The stored copy (written by the learner app on this device) now holds: jamo-s1 is off.
    expect(switches.packSwitchOn('jamo-s1')).toBe(false);
    expect(switches.packSwitchOn('jamo-wb')).toBe(true);
  });

  it('a copy that switches a pack off turns only that pack off; audioClips off turns every pack off', async () => {
    const { switches, store } = await load();
    store.useRemoteConfigStore.setState({ hydrated: true, cache: copy({ 'audioPack.stage1': { on: false, pct: 100 } }) });
    expect(switches.packSwitchOn('stage1')).toBe(false);
    expect(switches.packSwitchOn('jamo-s1')).toBe(true);
    expect(switches.clipsSwitchOn()).toBe(true);
    store.useRemoteConfigStore.setState({ cache: copy({ audioClips: { on: false, pct: 100 } }) });
    expect(switches.clipsSwitchOn()).toBe(false);
    expect(switches.packSwitchOn('jamo-s1')).toBe(false);
  });

  it('the build ceiling excludes a pack whatever the remote copy says (remote can only reduce)', async () => {
    process.env.EXPO_PUBLIC_AUDIO_CLIP_PACKS = 'jamo-wb';
    const { switches, store } = await load();
    store.useRemoteConfigStore.setState({
      hydrated: true,
      cache: copy({ audioClips: { on: true, pct: 100 }, 'audioPack.jamo-s1': { on: true, pct: 100 }, 'audioPack.jamo-wb': { on: true, pct: 100 } }),
    });
    expect(switches.packSwitchOn('jamo-s1')).toBe(false);
    expect(switches.packSwitchOn('jamo-wb')).toBe(true);
  });

  it('EXPO_PUBLIC_AUDIO_CLIPS=false is off whatever the remote copy says', async () => {
    process.env.EXPO_PUBLIC_AUDIO_CLIPS = 'false';
    const { switches, store } = await load();
    store.useRemoteConfigStore.setState({ hydrated: true, cache: copy({ audioClips: { on: true, pct: 100 } }) });
    expect(switches.clipsSwitchOn()).toBe(false);
    expect(switches.packSwitchOn('jamo-s1')).toBe(false);
  });

  it('bundledPackOf reads the generated pack map, own keys only', async () => {
    vi.resetModules();
    vi.doMock('../../content/__generated__/audio-assets', () => ({
      AUDIO_ASSETS: { 'audio/jamo/giyeok.mp3': 7 },
      AUDIO_ASSET_PACKS: { 'audio/jamo/giyeok.mp3': 'jamo-s1' },
    }));
    const switches = await import('../audio-switches');
    expect(switches.bundledPackOf('audio/jamo/giyeok.mp3')).toBe('jamo-s1');
    expect(switches.bundledPackOf('audio/jamo/nieun.mp3')).toBeUndefined();
    expect(switches.bundledPackOf('toString')).toBeUndefined();
  });
});
