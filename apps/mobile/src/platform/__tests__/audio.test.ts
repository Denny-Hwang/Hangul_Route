import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn(),
  getAvailableVoicesAsync: vi.fn(async () => []),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

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
import { createNativeAudio, type NativeSpeechApi } from '../audio';

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

function rig(voices: NativeVoice[] = [...NOVELTY, YUNA, SAMANTHA], platform: 'ios' | 'android' = 'ios') {
  const speech = new FakeSpeech();
  speech.voices = voices;
  const audio = createNativeAudio({ speech, platform });
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
