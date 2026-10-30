import { AUDIO_PACKS, type AudioPack } from '@hangul-route/content-schema/audio-packs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClipRegistry } from '../../../platform/audio-assets-store';
import { PACK_WAIT_MS } from '../controller';
import type { AudioPackChunk } from '../clip-assets';
import { createClipPackLoader, packsUpTo, type ClipPackLoaderDeps } from '../clip-pack-loader';

/** AMENDMENTS-AUDIO-CLIPS AC-B6 (row AC-6): the start map plus the per-pack map chunks, loaded on demand. */

const GIYEOK = 'audio/jamo/giyeok.mp3';
const AE = 'audio/jamo/ae.mp3';
const NA = 'audio/say/1098bbe54520ab2a.mp3';
const GA = 'audio/say/64ee5293d31bc58b.mp3';
const GABANG = 'audio/say/6852b2954fc85566.mp3';

const CHUNKS: Partial<Record<AudioPack, AudioPackChunk>> = {
  'jamo-wb': { pack: 'jamo-wb', clips: { [AE]: 'ae.mp3' }, units: {} },
  stage1: { pack: 'stage1', clips: { [GA]: 'ga.mp3', [NA]: 'na.mp3' }, units: { 'quest:stage1-letters-q1': [1], 'minigame:s1-letters-q1-check': [0, 1] } },
  stage2: { pack: 'stage2', clips: { [GABANG]: 'gabang.mp3' }, units: { 'episode:stage2-life': [0] } },
};

function setup(over: Partial<ClipPackLoaderDeps> & { off?: Set<AudioPack>; fail?: Set<AudioPack> } = {}) {
  const loads: AudioPack[] = [];
  const registry = createClipRegistry({
    start: { [GIYEOK]: 'giyeok.mp3' },
    startPacks: { [GIYEOK]: 'jamo-s1' },
    count: 5,
    chunkPacks: ['jamo-wb', 'stage1', 'stage2'],
  });
  const loader = createClipPackLoader({
    registry,
    load: (pack) => {
      loads.push(pack);
      const chunk = CHUNKS[pack];
      if (chunk === undefined) return undefined;
      if (over.fail?.has(pack)) return Promise.reject(new Error('offline'));
      return Promise.resolve({ AUDIO_PACK: chunk });
    },
    packOn: (pack) => !(over.off?.has(pack) ?? false),
    ...over,
  });
  return { registry, loader, loads };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('logic/audio/clip-assets: the start-side registry', () => {
  it('starts with the start map only (jamo-s1), and counts every clip the build holds', () => {
    const { registry, loads } = setup();
    expect(registry.has(GIYEOK)).toBe(true);
    expect(registry.asset(GIYEOK)).toBe('giyeok.mp3');
    expect(registry.packOf(GIYEOK)).toBe('jamo-s1');
    expect(registry.has(NA)).toBe(false);
    expect(registry.packOf(NA)).toBeUndefined();
    expect(registry.size).toBe(5);
    expect(registry.pending()).toBeNull();
    expect(loads).toEqual([]);
    // A pack with a chunk counts as held before it loads (the level check's "has clips" question).
    expect(registry.packHas('jamo-s1')).toBe(true);
    expect(registry.packHas('stage1')).toBe(true);
    expect(registry.packHas('stories')).toBe(false);
  });

  it('counts a load as pending until it settles, a failed one too', async () => {
    const { registry } = setup();
    let finish: () => void = () => undefined;
    registry.track(new Promise<void>((resolve) => (finish = resolve)));
    const failing = Promise.reject(new Error('offline'));
    registry.track(failing);
    const pending = registry.pending();
    expect(pending).not.toBeNull();
    finish();
    await pending;
    await Promise.resolve();
    expect(registry.pending()).toBeNull();
  });

  it(`a load that never settles stops counting as pending after ${PACK_WAIT_MS} ms (a stalled chunk costs one wait at most)`, async () => {
    vi.useFakeTimers();
    const { registry } = setup();
    registry.track(new Promise<void>(() => undefined));
    expect(registry.pending()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(PACK_WAIT_MS - 10);
    expect(registry.pending()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(20);
    expect(registry.pending()).toBeNull();
  });

  it("tells its subscribers each time a chunk's clips are added, and bumps its version", () => {
    const { registry } = setup();
    const heard: number[] = [];
    const off = registry.subscribe(() => heard.push(registry.version()));
    expect(registry.version()).toBe(0);
    registry.add(CHUNKS.stage1!);
    expect(registry.has(NA)).toBe(true);
    expect(heard).toEqual([1]);
    off();
    registry.add(CHUNKS.stage2!);
    expect(registry.version()).toBe(2);
    expect(heard).toEqual([1]);
  });

  it('ignores inherited keys of the start map', () => {
    const { registry } = setup();
    expect(registry.has('toString')).toBe(false);
    expect(registry.packOf('toString')).toBeUndefined();
  });
});

describe('logic/audio/clip-pack-loader', () => {
  it('a scope loads its own pack and every pack before it (a text belongs to the first pack that uses it)', async () => {
    expect(packsUpTo('jamo-s1')).toEqual(['jamo-s1']);
    expect(packsUpTo('stage2')).toEqual(['jamo-s1', 'jamo-wb', 'stage1', 'placement', 'stage2']);
    expect(packsUpTo('cards')).toEqual([...AUDIO_PACKS]);
    const { registry, loader, loads } = setup();
    await loader.loadFor('stage2');
    expect(loads).toEqual(['jamo-wb', 'stage1', 'stage2']);
    expect(registry.has(NA)).toBe(true);
    expect(registry.has(GABANG)).toBe(true);
    expect(registry.packOf(NA)).toBe('stage1');
    expect(registry.asset(GABANG)).toBe('gabang.mp3');
  });

  it('loads a chunk once, shares a load in flight, and reports it pending until it settles', async () => {
    const { registry, loader, loads } = setup();
    const a = loader.loadPack('stage1');
    const b = loader.loadPack('stage1');
    expect(registry.pending()).not.toBeNull();
    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    await loader.loadPack('stage1');
    expect(loads).toEqual(['stage1']);
    await Promise.resolve();
    expect(registry.pending()).toBeNull();
  });

  it('never loads a pack switched off (the build ceiling or the remote audioPack.<pack>), and asks again once on', async () => {
    const off = new Set<AudioPack>(['stage1']);
    const { registry, loader, loads } = setup({ off });
    await expect(loader.loadPack('stage1')).resolves.toBe(false);
    await loader.loadFor('stage2');
    expect(loads).toEqual(['jamo-wb', 'stage2']);
    expect(registry.has(NA)).toBe(false);
    off.delete('stage1');
    await expect(loader.loadPack('stage1')).resolves.toBe(true);
    expect(registry.has(NA)).toBe(true);
  });

  it('a chunk that fails to load leaves its clips out (the device voice plays them) and is asked again next time', async () => {
    const fail = new Set<AudioPack>(['stage1']);
    const { registry, loader, loads } = setup({ fail });
    await expect(loader.loadPack('stage1')).resolves.toBe(false);
    expect(registry.has(NA)).toBe(false);
    fail.delete('stage1');
    await expect(loader.loadPack('stage1')).resolves.toBe(true);
    expect(loads).toEqual(['stage1', 'stage1']);
  });

  it('a pack with no chunk, a loader that throws, a switch that throws or a chunk of another pack loads nothing', async () => {
    await expect(setup().loader.loadPack('stories')).resolves.toBe(false);
    const throwing = setup({
      load: () => {
        throw new Error('boom');
      },
    });
    await expect(throwing.loader.loadPack('stage1')).resolves.toBe(false);
    const badSwitch = setup({
      packOn: () => {
        throw new Error('boom');
      },
    });
    await expect(badSwitch.loader.loadPack('stage1')).resolves.toBe(false);
    const wrong = setup({ load: () => Promise.resolve({ AUDIO_PACK: CHUNKS.stage2 as AudioPackChunk }) });
    await expect(wrong.loader.loadPack('stage1')).resolves.toBe(false);
    expect(wrong.registry.has(GABANG)).toBe(false);
  });

  it('answers the warm units of the loaded chunks, each clip once, in first-seen order', async () => {
    const { loader } = setup();
    expect(loader.unitRefs(['quest:stage1-letters-q1'])).toEqual([]);
    await loader.loadFor('stage2');
    expect(loader.unitRefs(['quest:stage1-letters-q1', 'minigame:s1-letters-q1-check', 'episode:stage2-life', 'story:none'])).toEqual([NA, GA, GABANG]);
  });

  it("lists a loaded pack's clips (CM-5B Save for offline)", async () => {
    const { loader } = setup();
    expect(loader.packRefs('stage1')).toEqual([]);
    await loader.loadPack('stage1');
    expect(loader.packRefs('stage1')).toEqual([GA, NA]);
  });
});
