import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClipFailure } from '../../logic/audio/controller';

/** F-AUDIO-004 §3.10: the native clip player over expo-av; vitest cannot load the native module tree. */
const av = vi.hoisted(() => ({
  setAudioModeAsync: vi.fn(async (_mode: unknown) => undefined),
  createAsync: vi.fn(async (_source: unknown, _initial: unknown, _onStatus: unknown, _downloadFirst: unknown) => ({
    sound: { playAsync: vi.fn(), stopAsync: vi.fn(), unloadAsync: vi.fn(), setOnPlaybackStatusUpdate: vi.fn() },
  })),
}));
const assets = vi.hoisted(() => ({
  fromModule: vi.fn((id: number | string) => ({
    uri: `http://metro/clip-${String(id)}.mp3`,
    localUri: null as string | null,
    downloadAsync: vi.fn(async function (this: { localUri: string | null }) {
      this.localUri = `file:///bundle/clip-${String(id)}.mp3`;
    }),
  })),
}));
vi.mock('expo-av', () => ({ Audio: { setAudioModeAsync: av.setAudioModeAsync, Sound: { createAsync: av.createAsync } } }));
vi.mock('expo-asset', () => ({ Asset: { fromModule: assets.fromModule } }));

import {
  createNativeClipPlayer,
  expoAvClipEnv,
  type NativeClipEnv,
  type NativePlaybackStatus,
  type NativeSoundLike,
} from '../audio-player';

const GIYEOK = 'audio/jamo/giyeok.mp3';
const NIEUN = 'audio/jamo/nieun.mp3';
const DIGEUT = 'audio/jamo/digeut.mp3';
const MODULES: Record<string, number> = { [GIYEOK]: 11, [NIEUN]: 12, [DIGEUT]: 13 };

class FakeSound implements NativeSoundLike {
  plays = 0;
  stops = 0;
  unloads = 0;
  status: ((s: NativePlaybackStatus) => void) | null = null;
  failPlay = false;
  constructor(readonly uri: string) {}
  playAsync(): Promise<unknown> {
    this.plays += 1;
    return this.failPlay ? Promise.reject(new Error('session refused')) : Promise.resolve({ isLoaded: true });
  }
  stopAsync(): Promise<unknown> {
    this.stops += 1;
    return Promise.resolve({ isLoaded: true });
  }
  unloadAsync(): Promise<unknown> {
    this.unloads += 1;
    return Promise.reject(new Error('already unloaded'));
  }
  setOnPlaybackStatusUpdate(fn: ((s: NativePlaybackStatus) => void) | null): void {
    this.status = fn;
  }
  emit(s: NativePlaybackStatus): void {
    this.status?.(s);
  }
}

interface Rig {
  env: NativeClipEnv;
  sounds: FakeSound[];
  modes: unknown[];
  downloads: Array<number | string>;
}

function rig(
  opts: {
    failDownload?: boolean;
    failCreate?: boolean;
    failMode?: number;
    holdCreate?: boolean;
    holdDownload?: boolean;
    failPlay?: boolean;
    playInSilentMode?: boolean;
  } = {},
): Rig {
  const sounds: FakeSound[] = [];
  const modes: unknown[] = [];
  const downloads: Array<number | string> = [];
  let modeFailures = opts.failMode ?? 0;
  const env: NativeClipEnv = {
    source: (ref) => MODULES[ref] ?? null,
    localUri: (source) => {
      downloads.push(source);
      if (opts.holdDownload) return new Promise<string>(() => undefined);
      return opts.failDownload ? Promise.reject(new Error('offline')) : Promise.resolve(`file:///bundle/${String(source)}.mp3`);
    },
    audio: {
      setAudioModeAsync: (mode) => {
        modes.push(mode);
        if (modeFailures > 0) {
          modeFailures -= 1;
          return Promise.reject(new Error('session busy'));
        }
        return Promise.resolve();
      },
      createSound: (uri, onStatus) => {
        if (opts.holdCreate) return new Promise<NativeSoundLike>(() => undefined);
        if (opts.failCreate) return Promise.reject(new Error('unsupported format'));
        const sound = new FakeSound(uri);
        sound.failPlay = opts.failPlay ?? false;
        sound.setOnPlaybackStatusUpdate(onStatus);
        sounds.push(sound);
        return Promise.resolve(sound);
      },
    },
    playInSilentMode: opts.playInSilentMode ?? false,
    loadTimeoutMs: 50,
  };
  return { env, sounds, modes, downloads };
}

interface Outcome {
  started: number;
  done: number;
  errors: ClipFailure[];
}
function handlers(): Outcome & { h: { onStart(): void; onDone(): void; onError(reason: ClipFailure): void } } {
  const out = {
    started: 0,
    done: 0,
    errors: [] as ClipFailure[],
    h: {
      onStart: () => {
        out.started += 1;
      },
      onDone: () => {
        out.done += 1;
      },
      onError: (reason: ClipFailure) => {
        out.errors.push(reason);
      },
    },
  };
  return out;
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe('platform/audio-player (native): play, stop, unload', () => {
  it('sets the audio session once, respecting the silent switch, before the first sound loads', async () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    const a = handlers();
    player.play(GIYEOK, a.h);
    await flush();
    expect(r.modes).toEqual([{ playsInSilentModeIOS: false, staysActiveInBackground: false }]);
    r.sounds[0]!.emit({ isLoaded: true, didJustFinish: true });
    const b = handlers();
    player.play(NIEUN, b.h);
    await flush();
    await player.warm([DIGEUT]);
    expect(r.modes).toHaveLength(1);
  });

  it('the silent-switch choice comes from the one constant', async () => {
    const r = rig({ playInSilentMode: true });
    const player = createNativeClipPlayer(r.env);
    player.play(GIYEOK, handlers().h);
    await flush();
    expect(r.modes).toEqual([{ playsInSilentModeIOS: true, staysActiveInBackground: false }]);
  });

  it('a session that refuses is asked again on the next play, and the clip still plays', async () => {
    const r = rig({ failMode: 1 });
    const player = createNativeClipPlayer(r.env);
    const a = handlers();
    player.play(GIYEOK, a.h);
    await flush();
    expect(a.started).toBe(1);
    r.sounds[0]!.emit({ isLoaded: true, didJustFinish: true });
    player.play(NIEUN, handlers().h);
    await flush();
    expect(r.modes).toHaveLength(2);
  });

  it('plays the bundled file, reports start then done, and unloads the sound', async () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play(GIYEOK, out.h);
    await flush();
    expect(r.sounds).toHaveLength(1);
    expect(r.sounds[0]!.uri).toBe('file:///bundle/11.mp3');
    expect(r.sounds[0]!.plays).toBe(1);
    expect(out.started).toBe(1);
    r.sounds[0]!.emit({ isLoaded: true, isPlaying: true, durationMillis: 900 });
    expect(out.done).toBe(0);
    r.sounds[0]!.emit({ isLoaded: true, didJustFinish: true });
    r.sounds[0]!.emit({ isLoaded: true, didJustFinish: true });
    expect(out.done).toBe(1);
    expect(out.errors).toEqual([]);
    expect(r.sounds[0]!.unloads).toBe(1);
    expect(r.sounds[0]!.status).toBeNull();
  });

  it('a ref with no bundled file is `missing` and loads nothing', async () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play('audio/jamo/mieum.mp3', out.h);
    await flush();
    expect(out.errors).toEqual(['missing']);
    expect(r.downloads).toEqual([]);
    expect(r.modes).toEqual([]);
  });

  it('a file that cannot be made local is `fetch`', async () => {
    const r = rig({ failDownload: true });
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play(GIYEOK, out.h);
    await flush();
    expect(out.errors).toEqual(['fetch']);
    expect(r.sounds).toHaveLength(0);
  });

  it('a file the player cannot load is `decode`', async () => {
    const r = rig({ failCreate: true });
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play(GIYEOK, out.h);
    await flush();
    expect(out.errors).toEqual(['decode']);
  });

  it('a load error reported after start is `decode` and the sound is unloaded', async () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play(GIYEOK, out.h);
    await flush();
    r.sounds[0]!.emit({ isLoaded: false, error: 'corrupt frame' });
    expect(out.errors).toEqual(['decode']);
    expect(out.done).toBe(0);
    expect(r.sounds[0]!.unloads).toBe(1);
  });

  it('an unloaded status with no error (the sound was released) is ignored', async () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play(GIYEOK, out.h);
    await flush();
    r.sounds[0]!.emit({ isLoaded: false });
    expect(out.errors).toEqual([]);
    r.sounds[0]!.emit({ isLoaded: true, didJustFinish: true });
    expect(out.done).toBe(1);
  });

  it('a play the audio session refuses is `blocked`', async () => {
    const r = rig({ failPlay: true });
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play(GIYEOK, out.h);
    await flush();
    expect(out.errors).toEqual(['blocked']);
    expect(out.started).toBe(0);
    expect(r.sounds[0]!.unloads).toBe(1);
  });

  it('a download that never settles gives way to the voice as `fetch` after the load timeout', async () => {
    vi.useFakeTimers();
    const r = rig({ holdDownload: true });
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play(GIYEOK, out.h);
    await vi.advanceTimersByTimeAsync(60);
    expect(out.errors).toEqual(['fetch']);
  });

  it('a sound that never loads gives way as `decode` after the load timeout', async () => {
    vi.useFakeTimers();
    const r = rig({ holdCreate: true });
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play(GIYEOK, out.h);
    await vi.advanceTimersByTimeAsync(60);
    expect(out.errors).toEqual(['decode']);
  });

  it('a started clip that never reports its end still settles after its length plus a margin', async () => {
    vi.useFakeTimers();
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play(GIYEOK, out.h);
    await vi.advanceTimersByTimeAsync(0);
    r.sounds[0]!.emit({ isLoaded: true, isPlaying: true, durationMillis: 900 });
    await vi.advanceTimersByTimeAsync(2300);
    expect(out.done).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(out.done).toBe(1);
    expect(r.sounds[0]!.unloads).toBe(1);
  });

  it('with no length reported the play still settles at the ceiling', async () => {
    vi.useFakeTimers();
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play(GIYEOK, out.h);
    await vi.advanceTimersByTimeAsync(0);
    expect(out.started).toBe(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(out.done).toBe(1);
  });

  it('stop() stops and unloads the sound and reports nothing', async () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    const handle = player.play(GIYEOK, out.h);
    await flush();
    handle.stop();
    handle.stop();
    await flush();
    r.sounds[0]!.emit({ isLoaded: true, didJustFinish: true });
    expect(r.sounds[0]!.stops).toBe(1);
    expect(r.sounds[0]!.unloads).toBe(1);
    expect(out.done).toBe(0);
    expect(out.errors).toEqual([]);
  });

  it('a play stopped while it loads unloads the sound once it arrives and never plays it', async () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    const handle = player.play(GIYEOK, out.h);
    handle.stop();
    await flush();
    expect(r.sounds.length).toBeLessThanOrEqual(1);
    for (const s of r.sounds) {
      expect(s.plays).toBe(0);
      expect(s.unloads).toBe(1);
    }
    expect(out.started + out.done + out.errors.length).toBe(0);
  });

  it('a missing ref stopped at once reports nothing', async () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    const out = handlers();
    player.play('audio/jamo/mieum.mp3', out.h).stop();
    await flush();
    expect(out.errors).toEqual([]);
  });

  it('stopAll stops every playing clip', async () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    const a = handlers();
    const b = handlers();
    player.play(GIYEOK, a.h);
    player.play(NIEUN, b.h);
    await flush();
    player.stopAll();
    await flush();
    expect(r.sounds.map((s) => s.stops)).toEqual([1, 1]);
    expect(r.sounds.map((s) => s.unloads)).toEqual([1, 1]);
    expect(a.done + b.done).toBe(0);
  });

  it('unlock is a no-op on native (nothing to unlock)', () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    expect(player.unlock()).toBeUndefined();
    expect(r.modes).toEqual([]);
  });
});

describe('platform/audio-player (native): warm', () => {
  it('makes each bundled clip local once; a later play reuses it', async () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    await player.warm([GIYEOK, NIEUN, 'audio/jamo/mieum.mp3']);
    expect(r.downloads).toEqual([11, 12]);
    await player.warm([GIYEOK]);
    player.play(GIYEOK, handlers().h);
    await flush();
    expect(r.downloads).toEqual([11, 12]);
  });

  it('a warm that fails never rejects, and the next play tries again', async () => {
    const r = rig({ failDownload: true });
    const player = createNativeClipPlayer(r.env);
    await expect(player.warm([GIYEOK])).resolves.toBeUndefined();
    player.play(GIYEOK, handlers().h);
    await flush();
    expect(r.downloads).toEqual([11, 11]);
  });

  it('two plays of one ref while it loads share one download', async () => {
    const r = rig();
    const player = createNativeClipPlayer(r.env);
    player.play(GIYEOK, handlers().h);
    player.play(GIYEOK, handlers().h);
    await flush();
    expect(r.downloads).toEqual([11]);
  });
});

describe('platform/audio-player (native): the expo-av environment', () => {
  it('sets the mode and loads a sound through expo-av without downloading again', async () => {
    const env = expoAvClipEnv({ [GIYEOK]: 11 });
    await env.audio.setAudioModeAsync({ playsInSilentModeIOS: false, staysActiveInBackground: false });
    expect(av.setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentModeIOS: false, staysActiveInBackground: false });
    const onStatus = (): void => undefined;
    const sound = await env.audio.createSound('file:///bundle/clip-11.mp3', onStatus);
    expect(av.createAsync).toHaveBeenCalledWith({ uri: 'file:///bundle/clip-11.mp3' }, { shouldPlay: false }, onStatus, false);
    expect(typeof sound.playAsync).toBe('function');
  });

  it('resolves a bundled module to its local file through expo-asset', async () => {
    const env = expoAvClipEnv({ [GIYEOK]: 11 });
    expect(env.source(GIYEOK)).toBe(11);
    expect(env.source(NIEUN)).toBeNull();
    // An inherited key is not a bundled clip.
    expect(env.source('toString')).toBeNull();
    await expect(env.localUri(11)).resolves.toBe('file:///bundle/clip-11.mp3');
    expect(env.playInSilentMode).toBe(false);
  });

  it('falls back to the asset uri when expo-asset gives no local file', async () => {
    assets.fromModule.mockImplementationOnce((id: number | string) => ({
      uri: `http://metro/clip-${String(id)}.mp3`,
      localUri: null,
      downloadAsync: vi.fn(async () => undefined),
    }));
    const env = expoAvClipEnv({});
    await expect(env.localUri(12)).resolves.toBe('http://metro/clip-12.mp3');
  });
});
