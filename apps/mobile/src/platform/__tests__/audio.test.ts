import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn(),
  getAvailableVoicesAsync: vi.fn(async () => []),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
// The clip player (A-7) loads expo-av and expo-asset: native module trees vitest cannot load.
const av = vi.hoisted(() => ({
  modes: [] as unknown[],
  loaded: [] as unknown[],
}));
vi.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: vi.fn(async (mode: unknown) => {
      av.modes.push(mode);
    }),
    Sound: {
      createAsync: vi.fn(async (source: unknown, _initial: unknown, onStatus: (s: { isLoaded: boolean; didJustFinish?: boolean }) => void) => {
        av.loaded.push(source);
        return {
          sound: {
            playAsync: vi.fn(async () => {
              queueMicrotask(() => onStatus({ isLoaded: true, didJustFinish: true }));
              return { isLoaded: true };
            }),
            stopAsync: vi.fn(async () => ({ isLoaded: true })),
            unloadAsync: vi.fn(async () => ({ isLoaded: false })),
            setOnPlaybackStatusUpdate: vi.fn(),
          },
        };
      }),
    },
  },
  InterruptionModeIOS: { MixWithOthers: 0, DoNotMix: 1, DuckOthers: 2 }, InterruptionModeAndroid: { DoNotMix: 1, DuckOthers: 2 },
}));
vi.mock('expo-asset', () => ({
  Asset: {
    fromModule: (id: number | string) => ({
      uri: `asset:/clip-${String(id)}.mp3`,
      localUri: `file:///bundle/clip-${String(id)}.mp3`,
      downloadAsync: async () => undefined,
    }),
  },
}));

const mem = vi.hoisted(() => new Map<string, unknown>());
const tracked = vi.hoisted(() => [] as Array<{ name: string; payload?: Record<string, unknown> }>);
vi.mock('../storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));
vi.mock('../telemetry', () => ({
  track: vi.fn(async (e: { name: string; payload?: Record<string, unknown> }) => {
    tracked.push(e);
    return true;
  }),
}));

import * as Speech from 'expo-speech';
import { useAudioStore } from '../../store/audio-store';
import type { ClipFailure, ClipPlayer } from '../../logic/audio/controller';
import { createNativeAudio, type NativeClipSetup, type NativeSpeechApi } from '../audio';

interface NativeVoice {
  identifier: string;
  name: string;
  language: string;
  quality: string;
}
const nv = (identifier: string, name: string, language: string, quality = 'Default'): NativeVoice => ({ identifier, name, language, quality });

// `say -v '?'` novelty voices as an iOS device lists them, then Yuna.
const NOVELTY = ['Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley'].map((n) =>
  nv(`com.apple.eloquence.ko-KR.${n}`, n, 'ko-KR'),
);
const YUNA = nv('com.apple.voice.compact.ko-KR.Yuna', 'Yuna', 'ko-KR');
const SAMANTHA = nv('com.apple.voice.compact.en-US.Samantha', 'Samantha', 'en-US');

type Opts = {
  language?: string;
  rate?: number;
  pitch?: number;
  voice?: string;
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (e: Error) => void;
};

class FakeSpeech implements NativeSpeechApi {
  voices: NativeVoice[] = [];
  /** Successive results of getAvailableVoicesAsync; the last one repeats. */
  reads: Array<NativeVoice[] | Error> | null = null;
  readCount = 0;
  calls: Array<{ text: string; opts: Opts }> = [];
  stopCount = 0;
  mode: 'auto' | 'manual' | 'error' | 'stopped' | 'never' | 'throw' = 'auto';
  current: Opts | null = null;

  speak = (text: string, opts: Opts = {}): void => {
    this.calls.push({ text, opts });
    if (this.mode === 'throw') throw new Error('invalid voice');
    this.current = opts;
    if (this.mode === 'never') return;
    queueMicrotask(() => {
      if (this.mode === 'error') return opts.onError?.(new Error('synth'));
      opts.onStart?.();
      if (this.mode === 'stopped') return opts.onStopped?.();
      if (this.mode === 'auto') queueMicrotask(() => opts.onDone?.());
    });
  };
  stop = (): void => {
    this.stopCount += 1;
    const cur = this.current;
    this.current = null;
    if (cur) queueMicrotask(() => cur.onStopped?.());
  };
  getAvailableVoicesAsync = async (): Promise<NativeVoice[]> => {
    const script = this.reads;
    if (script === null) return this.voices;
    const step = script[Math.min(this.readCount, script.length - 1)]!;
    this.readCount += 1;
    if (step instanceof Error) throw step;
    return step;
  };
  endCurrent(): void {
    const cur = this.current;
    this.current = null;
    cur?.onDone?.();
  }
}

/** A clip player double: each play settles as `next` says ('ok' = played to the end). */
class FakeClipPlayer implements ClipPlayer {
  next: 'ok' | ClipFailure | 'hold' = 'ok';
  readonly played: string[] = [];
  readonly warmed: string[][] = [];
  unlocks = 0;
  stops = 0;
  /** How many times each play's own handle was stopped, by play order. */
  readonly handleStops: number[] = [];
  play(ref: string, h: { onStart(): void; onDone(): void; onError(reason: ClipFailure): void }): { stop(): void } {
    this.played.push(ref);
    const index = this.handleStops.push(0) - 1;
    const outcome = this.next;
    queueMicrotask(() => {
      if (outcome === 'hold') return;
      if (outcome === 'ok') {
        h.onStart();
        h.onDone();
      } else h.onError(outcome);
    });
    return {
      stop: () => {
        this.handleStops[index] = (this.handleStops[index] ?? 0) + 1;
      },
    };
  }
  warm(refs: readonly string[]): Promise<void> {
    this.warmed.push([...refs]);
    return Promise.resolve();
  }
  unlock(): void {
    this.unlocks += 1;
  }
  stopAll(): void {
    this.stops += 1;
  }
}

const GIYEOK_CLIP = 'audio/jamo/giyeok.mp3';
const NIEUN_CLIP = 'audio/jamo/nieun.mp3';

interface ClipRigOptions {
  player: FakeClipPlayer;
  refs?: string[];
  enabled?: boolean;
}

function clipSetup(opts: ClipRigOptions): NativeClipSetup {
  const refs = new Set(opts.refs ?? [GIYEOK_CLIP]);
  const enabled = opts.enabled ?? true;
  return { player: opts.player, assets: { has: (ref) => refs.has(ref), size: refs.size }, enabled: () => enabled };
}

function rig(voices: NativeVoice[] = [...NOVELTY, YUNA, SAMANTHA], platform: 'ios' | 'android' = 'ios', clips?: ClipRigOptions) {
  const speech = new FakeSpeech();
  speech.voices = voices;
  const audio = createNativeAudio({ speech, platform, ...(clips === undefined ? {} : { clips: clipSetup(clips) }) });
  return { speech, audio };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mem.clear();
  tracked.length = 0;
  useAudioStore.setState({ muted: false, hydrated: true, levelOrder: null, lastFailure: null, unlocked: false, clips: false, tts: { state: 'unknown' } });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('platform/audio (native): explicit voice, never an English voice on Hangul', () => {
  it('passes the ranked voice id from the list read this session, never a novelty voice', async () => {
    const { speech, audio } = rig();
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('played');
    expect(speech.calls).toHaveLength(1);
    expect(speech.calls[0]?.text).toBe('가');
    expect(speech.calls[0]?.opts).toMatchObject({ language: 'ko-KR', voice: YUNA.identifier, pitch: 1 });
    audio.dispose();
  });

  it('does not call Speech.speak when there is no Korean voice, or only novelty voices', async () => {
    for (const voices of [[SAMANTHA], [...NOVELTY, SAMANTHA]]) {
      const { speech, audio } = rig(voices);
      await expect(audio.playPrompt({ text: '가' })).resolves.toBe('unavailable');
      expect(speech.calls).toHaveLength(0);
      expect(useAudioStore.getState().lastFailure?.reason).toBe('no_voice');
      expect(audio.getCapability().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });
      audio.dispose();
    }
  });

  it('sound rate, pitch 1.0 and the learner level come from speechParams', async () => {
    const { speech, audio } = rig();
    await audio.playPrompt({ text: '가', kind: 'sound' });
    expect(speech.calls[0]?.opts).toMatchObject({ rate: 0.75, pitch: 1 });
    useAudioStore.getState().setLevelOrder(2);
    await audio.playPrompt({ text: '가', kind: 'sound' });
    expect(speech.calls[1]?.opts.rate).toBeCloseTo(0.7875, 5);
    audio.dispose();
  });

  it('speaks the carrier syllable for a jamo, never its name', async () => {
    const { speech, audio } = rig();
    await audio.playJamo({ char: 'ㄱ', romanization: 'g/k', nameEn: 'giyeok', spokenKo: '가', spokenKind: 'sound', nameKo: '기역' });
    expect(speech.calls[0]?.text).toBe('가');
    audio.dispose();
  });

  it('an English prompt uses an English voice id', async () => {
    const { speech, audio } = rig();
    await audio.playPrompt({ text: 'sun', language: 'en-US', kind: 'narration' });
    expect(speech.calls[0]?.opts).toMatchObject({ language: 'en-US', voice: SAMANTHA.identifier });
    audio.dispose();
  });
});

describe('platform/audio (native): the voice list is read lazily (Android)', () => {
  it('an empty list is read again at 500 ms; a prompt waiting for the capability then plays', async () => {
    vi.useFakeTimers();
    const speech = new FakeSpeech();
    speech.reads = [[], [YUNA]];
    const audio = createNativeAudio({ speech, platform: 'android' });
    const result = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(600);
    await expect(result).resolves.toBe('played');
    expect(speech.readCount).toBe(2);
    expect(speech.calls[0]?.opts.voice).toBe(YUNA.identifier);
    audio.dispose();
  });

  it('a voice that appears only on the third read (1500 ms) still becomes the capability', async () => {
    vi.useFakeTimers();
    const speech = new FakeSpeech();
    speech.reads = [[], [], [YUNA]];
    const audio = createNativeAudio({ speech, platform: 'android' });
    await vi.advanceTimersByTimeAsync(1600);
    expect(speech.readCount).toBe(3);
    expect(audio.getCapability().tts).toMatchObject({ state: 'ready', voiceName: 'Yuna' });
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('played');
    audio.dispose();
  });

  it('an unreadable list is none/no_engine and nothing is spoken', async () => {
    const speech = new FakeSpeech();
    speech.reads = [new Error('engine not ready')];
    const audio = createNativeAudio({ speech, platform: 'android' });
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(speech.calls).toHaveLength(0);
    expect(audio.getCapability().tts).toEqual({ state: 'none', reason: 'no_engine' });
    audio.dispose();
  });

  it('ranks an Android local voice over a network one', async () => {
    const network = nv('ko-kr-x-kod-network', 'ko-kr-x-kod-network', 'ko-KR');
    const local = nv('ko-kr-x-koc-local', 'ko-kr-x-koc-local', 'ko-KR');
    const speech = new FakeSpeech();
    speech.voices = [network, local];
    const audio = createNativeAudio({ speech, platform: 'android' });
    await flush();
    expect(audio.getCapability().tts).toMatchObject({ state: 'ready', local: true });
    audio.dispose();
  });

  it('refreshCapability re-reads the list (voice data was installed)', async () => {
    const speech = new FakeSpeech();
    speech.reads = [[SAMANTHA], [SAMANTHA, YUNA]];
    const audio = createNativeAudio({ speech, platform: 'ios' });
    await flush();
    expect(audio.getCapability().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });
    await audio.refreshCapability();
    expect(audio.getCapability().tts).toMatchObject({ state: 'ready', voiceName: 'Yuna' });
    audio.dispose();
  });

  it('refreshCapability with an unreadable engine reports none/no_engine', async () => {
    const speech = new FakeSpeech();
    speech.reads = [[YUNA], new Error('gone')];
    const audio = createNativeAudio({ speech, platform: 'ios' });
    await flush();
    await audio.refreshCapability();
    expect(audio.getCapability().tts).toEqual({ state: 'none', reason: 'no_engine' });
    audio.dispose();
  });
});

describe('platform/audio (native): results', () => {
  it('an engine error is a failure (not a normal end): unavailable, reason error', async () => {
    const { speech, audio } = rig();
    speech.mode = 'error';
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(useAudioStore.getState().lastFailure?.reason).toBe('error');
    expect(tracked.some((e) => e.name === 'audio.playback_failed' && e.payload?.reason === 'engine')).toBe(true);
    audio.dispose();
  });

  it('Speech.speak throwing (voice gone) is a failure, not an exception', async () => {
    const { speech, audio } = rig();
    speech.mode = 'throw';
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    audio.dispose();
  });

  it('onStopped is an interruption, not a failure', async () => {
    const { speech, audio } = rig();
    speech.mode = 'stopped';
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('played');
    expect(useAudioStore.getState().lastFailure).toBeNull();
    audio.dispose();
  });

  it('legacy speak(): onDone at the end; an error goes to onError, or to onDone when none was given', async () => {
    const a = rig();
    const onDone = vi.fn();
    a.audio.speak('가', { onDone });
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
    a.audio.dispose();

    const b = rig();
    b.speech.mode = 'error';
    const done2 = vi.fn();
    const err2 = vi.fn();
    b.audio.speak('다', { onDone: done2, onError: err2 });
    await flush();
    expect(err2).toHaveBeenCalledTimes(1);
    expect(done2).not.toHaveBeenCalled();
    b.audio.dispose();

    const c = rig();
    c.speech.mode = 'error';
    const done3 = vi.fn();
    c.audio.speak('다', { onDone: done3 });
    await flush();
    expect(done3).toHaveBeenCalledTimes(1);
    c.audio.dispose();
  });

  it('a newer prompt stops the running one, the old resolves played, the new waits 50 ms', async () => {
    vi.useFakeTimers();
    const { speech, audio } = rig();
    speech.mode = 'manual';
    const first = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(0);
    expect(speech.calls).toHaveLength(1);
    const stopsBefore = speech.stopCount;
    const second = audio.playPrompt({ text: '나' });
    await expect(first).resolves.toBe('played');
    expect(speech.stopCount).toBeGreaterThan(stopsBefore);
    expect(speech.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60);
    expect(speech.calls).toHaveLength(2);
    speech.endCurrent();
    await expect(second).resolves.toBe('played');
    audio.dispose();
  });

  it('stop() stops the engine', () => {
    const { speech, audio } = rig();
    audio.stop();
    expect(speech.stopCount).toBe(1);
    audio.dispose();
  });

  it('a prompt that never starts is blocked after 1.5 s', async () => {
    vi.useFakeTimers();
    const { speech, audio } = rig();
    speech.mode = 'never';
    const result = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(1600);
    await expect(result).resolves.toBe('unavailable');
    expect(useAudioStore.getState().lastFailure?.reason).toBe('blocked');
    audio.dispose();
  });
});

describe('platform/audio (native): mute is the store (AD7)', () => {
  it('muted resolves muted without calling the engine; switching off stops speech', async () => {
    const { speech, audio } = rig();
    useAudioStore.getState().setMuted(true, 'profile');
    expect(speech.stopCount).toBe(1);
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('muted');
    expect(speech.calls).toHaveLength(0);
    expect(audio.isMuted()).toBe(true);
    audio.setMuted(false);
    expect(useAudioStore.getState().muted).toBe(false);
    audio.dispose();
  });

  it('while muted, legacy speak() still calls onDone', async () => {
    const { speech, audio } = rig();
    useAudioStore.getState().setMuted(true, 'profile');
    const onDone = vi.fn();
    audio.speak('나', { onDone });
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(speech.calls).toHaveLength(0);
    audio.dispose();
  });
});

describe('platform/audio (native): capability, unlock, telemetry', () => {
  it('nothing to unlock on native: the store reads unlocked and the unlock calls are safe no-ops', async () => {
    const { audio } = rig();
    expect(useAudioStore.getState().unlocked).toBe(true);
    audio.unlockAudio();
    audio.installGestureUnlock()();
    await expect(audio.warmClips(['audio/jamo/giyeok.mp3'])).resolves.toBeUndefined();
    // The native clip path lands in A-7: no ref has a clip yet, so the voice is always used.
    expect(audio.hasClip('audio/jamo/giyeok.mp3')).toBe(false);
    audio.dispose();
  });

  it('pushes the capability to the store and subscribers', async () => {
    const { audio } = rig();
    const seen: string[] = [];
    const off = audio.subscribeCapability((c) => seen.push(c.tts.state));
    await flush();
    expect(seen).toEqual(['ready']);
    expect(useAudioStore.getState().tts).toMatchObject({ state: 'ready', voiceName: 'Yuna' });
    off();
    audio.dispose();
  });

  it('sends audio.capability_checked with the platform, and the fallback event once per source and reason', async () => {
    const { audio } = rig([SAMANTHA], 'android');
    await flush();
    audio.noteFallbackShown('match-sound', 'no_voice');
    audio.noteFallbackShown('match-sound', 'no_voice');
    expect(tracked).toEqual([
      { name: 'audio.capability_checked', payload: { platform: 'android', engine: 'none', koVoice: 'none', reason: 'no_korean_voice' } },
      { name: 'audio.fallback_shown', payload: { source: 'match-sound', reason: 'no_voice' } },
    ]);
    audio.dispose();
  });
});

describe('platform/audio (native): the module-level API', () => {
  it('uses expo-speech on the default instance and plays the jamo sound', async () => {
    vi.resetModules();
    vi.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([YUNA] as never);
    vi.mocked(Speech.speak).mockImplementation(((_t: string, opts?: Opts) => {
      opts?.onStart?.();
      opts?.onDone?.();
    }) as never);
    const store = await import('../../store/audio-store');
    store.useAudioStore.setState({ muted: false, hydrated: true, levelOrder: null, lastFailure: null });
    const mod = await import('../audio');
    await expect(mod.playPrompt({ text: '가' })).resolves.toBe('played');
    expect(vi.mocked(Speech.speak).mock.calls[0]?.[1]).toMatchObject({ voice: YUNA.identifier });
    await expect(mod.playJamo({ char: 'ㄷ', romanization: 'd/t', nameEn: 'digeut', spokenKo: '다', spokenKind: 'sound' }, 'sound')).resolves.toBe('played');
    expect(vi.mocked(Speech.speak).mock.calls.map((c) => c[0])).toContain('다');
    mod.speak('나');
    mod.stop();
    mod.setMuted(true);
    expect(mod.isMuted()).toBe(true);
    mod.setMuted(false);
    expect(mod.getCapability().tts.state).toBe('ready');
    await mod.refreshCapability();
    mod.subscribeCapability(() => undefined)();
    mod.unlockAudio();
    mod.installGestureUnlock()();
    await mod.warmClips([]);
    mod.noteFallbackShown('x', 'muted');
    expect(mod.hasClip('audio/jamo/giyeok.mp3')).toBe(false);
    await expect(mod.playJamo({ char: 'ㅏ', romanization: 'a', nameEn: 'a', spokenKo: '아', spokenKind: 'sound' })).resolves.toBe('played');
  });
});

describe('platform/audio (native): bundled clips (A-7, AD4: clip > voice > text)', () => {
  it('a ref with a bundled clip plays the clip and the voice stays silent', async () => {
    const player = new FakeClipPlayer();
    const { speech, audio } = rig(undefined, 'ios', { player });
    await expect(audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP, kind: 'sound' })).resolves.toBe('played');
    expect(player.played).toEqual([GIYEOK_CLIP]);
    expect(speech.calls).toHaveLength(0);
    audio.dispose();
  });

  it('playJamo uses the jamo audioRef', async () => {
    const player = new FakeClipPlayer();
    const { speech, audio } = rig(undefined, 'ios', { player });
    const giyeok = { char: 'ㄱ', romanization: 'g/k', nameEn: 'giyeok', spokenKo: '가', spokenKind: 'sound' as const, audioRef: GIYEOK_CLIP };
    await expect(audio.playJamo(giyeok, 'sound')).resolves.toBe('played');
    expect(player.played).toEqual([GIYEOK_CLIP]);
    expect(speech.calls).toHaveLength(0);
    audio.dispose();
  });

  it('a clip that fails to decode falls through to the voice and is reported', async () => {
    const player = new FakeClipPlayer();
    player.next = 'decode';
    const { speech, audio } = rig(undefined, 'ios', { player });
    await expect(audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP })).resolves.toBe('played');
    expect(speech.calls.map((c) => c.text)).toEqual(['가']);
    expect(tracked.filter((e) => e.name === 'audio.playback_failed')).toEqual([
      { name: 'audio.playback_failed', payload: { kind: 'clip', reason: 'decode' } },
    ]);
    audio.dispose();
  });

  it('a ref with no bundled file goes straight to the voice', async () => {
    const player = new FakeClipPlayer();
    const { speech, audio } = rig(undefined, 'ios', { player });
    await audio.playPrompt({ text: '나', audioRef: 'audio/jamo/nieun.mp3' });
    expect(player.played).toEqual([]);
    expect(speech.calls.map((c) => c.text)).toEqual(['나']);
    audio.dispose();
  });

  it('a clip plays on a device with no Korean voice, and the capability counts clips', async () => {
    const player = new FakeClipPlayer();
    const { speech, audio } = rig([SAMANTHA], 'android', { player });
    await expect(audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP })).resolves.toBe('played');
    expect(speech.calls).toHaveLength(0);
    expect(audio.getCapability().clips).toBe(true);
    expect(useAudioStore.getState().clips).toBe(true);
    audio.dispose();
  });

  it('muted never touches the clip player; switching the sound off and stop() stop clips', async () => {
    const player = new FakeClipPlayer();
    const { audio } = rig(undefined, 'ios', { player });
    player.next = 'hold';
    const pending = audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP });
    await flush();
    audio.stop();
    await expect(pending).resolves.toBe('played');
    const afterStop = player.stops;
    expect(afterStop).toBeGreaterThan(0);
    useAudioStore.getState().setMuted(true, 'profile');
    expect(player.stops).toBeGreaterThan(afterStop);
    player.next = 'ok';
    await expect(audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP })).resolves.toBe('muted');
    expect(player.played).toEqual([GIYEOK_CLIP]);
    audio.dispose();
  });

  it('a newer prompt stops the running clip through its own handle', async () => {
    const player = new FakeClipPlayer();
    const { audio } = rig(undefined, 'ios', { player, refs: [GIYEOK_CLIP, NIEUN_CLIP] });
    player.next = 'hold';
    const first = audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP });
    await flush();
    expect(player.handleStops).toEqual([0]);
    player.next = 'ok';
    const second = audio.playPrompt({ text: '나', audioRef: NIEUN_CLIP });
    await expect(first).resolves.toBe('played');
    await expect(second).resolves.toBe('played');
    expect(player.played).toEqual([GIYEOK_CLIP, NIEUN_CLIP]);
    expect(player.handleStops[0]).toBe(1);
    audio.dispose();
  });

  it('flags.audioClips off: the voice speaks, no clip is counted, nothing is warmed', async () => {
    const player = new FakeClipPlayer();
    const { speech, audio } = rig(undefined, 'ios', { player, enabled: false });
    await audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP });
    expect(player.played).toEqual([]);
    expect(speech.calls.map((c) => c.text)).toEqual(['가']);
    expect(audio.getCapability().clips).toBe(false);
    expect(audio.hasClip(GIYEOK_CLIP)).toBe(false);
    await audio.warmClips([GIYEOK_CLIP]);
    expect(player.warmed).toEqual([]);
    audio.dispose();
  });

  it('an empty clip map counts as no clips', () => {
    const { audio } = rig(undefined, 'ios', { player: new FakeClipPlayer(), refs: [] });
    expect(audio.getCapability().clips).toBe(false);
    audio.dispose();
  });

  it('hasClip is true only for a bundled ref; warmClips loads only bundled refs', async () => {
    const player = new FakeClipPlayer();
    const { audio } = rig(undefined, 'ios', { player });
    expect(audio.hasClip(GIYEOK_CLIP)).toBe(true);
    expect(audio.hasClip('audio/jamo/nieun.mp3')).toBe(false);
    expect(audio.hasClip(undefined)).toBe(false);
    await audio.warmClips([GIYEOK_CLIP, 'audio/jamo/nieun.mp3']);
    expect(player.warmed).toEqual([[GIYEOK_CLIP]]);
    await audio.warmClips(['audio/jamo/nieun.mp3']);
    expect(player.warmed).toHaveLength(1);
    audio.dispose();
  });

  it('the unlock calls stay no-ops on native even with clips', () => {
    const player = new FakeClipPlayer();
    const { audio } = rig(undefined, 'ios', { player });
    audio.unlockAudio();
    audio.installGestureUnlock()();
    expect(player.unlocks).toBe(0);
    audio.dispose();
  });
});

describe('platform/audio (native): the module-level clip path', () => {
  it('resolves a bundled clip through expo-asset and plays it with expo-av, once the session is set', async () => {
    vi.resetModules();
    av.modes.length = 0;
    av.loaded.length = 0;
    vi.doMock('../../content/__generated__/audio-assets', () => ({ AUDIO_ASSETS: { [GIYEOK_CLIP]: 7 } }));
    vi.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([YUNA] as never);
    vi.mocked(Speech.speak).mockReset();
    const store = await import('../../store/audio-store');
    store.useAudioStore.setState({ muted: false, hydrated: true, levelOrder: null, lastFailure: null });
    const mod = await import('../audio');
    expect(mod.hasClip(GIYEOK_CLIP)).toBe(true);
    expect(mod.getCapability().clips).toBe(true);
    await mod.warmClips([GIYEOK_CLIP]);
    await expect(mod.playPrompt({ text: '가', audioRef: GIYEOK_CLIP })).resolves.toBe('played');
    expect(av.modes).toEqual([
      {
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        interruptionModeIOS: 0,
        interruptionModeAndroid: 2,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
      },
    ]);
    expect(av.loaded).toEqual([{ uri: 'file:///bundle/clip-7.mp3' }]);
    expect(vi.mocked(Speech.speak)).not.toHaveBeenCalled();
    vi.doUnmock('../../content/__generated__/audio-assets');
  });
});
