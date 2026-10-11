import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSpeechSynthesis, FakeUtterance, type FakeVoice } from '../../test-support/fake-speech-synthesis';

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

import { useAudioStore } from '../../store/audio-store';
import { createWebAudio, type WebAudioEnv } from '../audio.web';

const voice = (name: string, lang: string, over: Partial<FakeVoice> = {}): FakeVoice => ({
  name,
  lang,
  voiceURI: name,
  localService: true,
  default: false,
  ...over,
});

// `say -v '?'`: the eight Apple novelty ko_KR voices come before Yuna.
const APPLE_KO = ['Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley'].map((n) =>
  voice(`${n} (한국어(한국))`, 'ko-KR'),
);
const YUNA = voice('Yuna', 'ko-KR');
const SAMANTHA = voice('Samantha', 'en-US', { default: true });

class FakeDoc extends EventTarget {
  visibilityState: 'visible' | 'hidden' = 'visible';
}

interface Rig {
  synth: FakeSpeechSynthesis;
  doc: FakeDoc;
  win: EventTarget;
  online: { value: boolean };
  audio: ReturnType<typeof createWebAudio>;
}

function rig(opts: { voices?: FakeVoice[]; noSynth?: boolean; requireGesture?: boolean; online?: boolean } = {}): Rig {
  const synth = new FakeSpeechSynthesis();
  synth.setVoices(opts.voices ?? [...APPLE_KO, YUNA, SAMANTHA]);
  synth.requireGesture = opts.requireGesture ?? false;
  const doc = new FakeDoc();
  const win = new EventTarget();
  const online = { value: opts.online ?? true };
  const env: WebAudioEnv = {
    synth: opts.noSynth ? null : (synth as unknown as WebAudioEnv['synth']),
    Utterance: opts.noSynth ? null : (FakeUtterance as unknown as NonNullable<WebAudioEnv['Utterance']>),
    doc: doc as unknown as WebAudioEnv['doc'],
    win: win as unknown as WebAudioEnv['win'],
    isOnline: () => online.value,
  };
  return { synth, doc, win, online, audio: createWebAudio(env) };
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

describe('platform/audio.web: voice choice (AD5)', () => {
  it('picks Yuna from the real Apple list and never a novelty voice', async () => {
    const { synth, audio } = rig();
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('played');
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]?.voice?.name).toBe('Yuna');
    expect(synth.spoken[0]?.lang).toBe('ko-KR');
    audio.dispose();
  });

  it('speaks at the sound rate for a sound prompt, pitch 1.0, and scales with the learner level', async () => {
    const { synth, audio } = rig();
    await audio.playPrompt({ text: '가', kind: 'sound' });
    expect(synth.spoken[0]).toMatchObject({ rate: 0.75, pitch: 1 });
    useAudioStore.getState().setLevelOrder(0);
    await audio.playPrompt({ text: '가', kind: 'sound' });
    expect(synth.spoken[1]?.rate).toBeCloseTo(0.675, 5);
    await audio.playPrompt({ text: '가', kind: 'sound', slow: true });
    // 0.75 x 0.9 x 0.7 = 0.4725, clamped to the 0.5 floor
    expect(synth.spoken[2]?.rate).toBe(0.5);
    audio.dispose();
  });

  it('never calls the engine when only novelty Korean voices exist', async () => {
    const { synth, audio } = rig({ voices: [...APPLE_KO, SAMANTHA] });
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(synth.spoken).toHaveLength(0);
    expect(useAudioStore.getState().lastFailure?.reason).toBe('no_voice');
    expect(useAudioStore.getState().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });
    audio.dispose();
  });

  it('reads an English prompt with an English voice (narration), not a Korean one', async () => {
    const { synth, audio } = rig();
    await audio.playPrompt({ text: 'sun', language: 'en-US', kind: 'narration' });
    expect(synth.spoken[0]?.voice?.name).toBe('Samantha');
    expect(synth.spoken[0]?.lang).toBe('en-US');
    audio.dispose();
  });

  it('waits for voices that arrive after the first prompt (Chrome)', async () => {
    const { synth, audio } = rig({ voices: [] });
    const result = audio.playPrompt({ text: '가' });
    await flush();
    expect(synth.spoken).toHaveLength(0);
    synth.setVoices([YUNA]);
    synth.fireVoicesChanged();
    await expect(result).resolves.toBe('played');
    expect(synth.spoken[0]?.voice?.name).toBe('Yuna');
    audio.dispose();
  });

  it('no voices ever: unavailable after the wait, engine never called', async () => {
    vi.useFakeTimers();
    const { synth, audio } = rig({ voices: [] });
    const result = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(1600);
    await expect(result).resolves.toBe('unavailable');
    expect(synth.spoken).toHaveLength(0);
    expect(audio.getCapability().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });
    audio.dispose();
  });

  it('drops a network voice while offline and brings it back online', async () => {
    const google = voice('Google 한국의', 'ko-KR', { localService: false });
    const { synth, win, online, audio } = rig({ voices: [google], online: true });
    await flush();
    expect(audio.getCapability().tts).toMatchObject({ state: 'ready', voiceName: 'Google 한국의', local: false });
    online.value = false;
    win.dispatchEvent(new Event('offline'));
    expect(audio.getCapability().tts).toEqual({ state: 'none', reason: 'offline_network_only' });
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(synth.spoken).toHaveLength(0);
    online.value = true;
    win.dispatchEvent(new Event('online'));
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('played');
    audio.dispose();
  });

  it('no speechSynthesis: unavailable, capability none/no_engine, speak() still calls onDone', async () => {
    const { audio } = rig({ noSynth: true });
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(audio.getCapability().tts).toEqual({ state: 'none', reason: 'no_engine' });
    const onDone = vi.fn();
    const onError = vi.fn();
    audio.speak('가', { onDone, onError });
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    audio.unlockAudio();
    audio.dispose();
  });
});

describe('platform/audio.web: playJamo (sound first)', () => {
  const giyeok = { char: 'ㄱ', romanization: 'g/k', nameEn: 'giyeok', spokenKo: '가', spokenRomanization: 'ga', spokenKind: 'sound' as const, nameKo: '기역' };

  it('speaks the carrier syllable 가, never the letter name 기역', async () => {
    const { synth, audio } = rig();
    await audio.playJamo(giyeok, 'sound');
    expect(synth.spoken[0]?.text).toBe('가');
    expect(synth.spoken[0]?.rate).toBe(0.75);
    await audio.playJamo(giyeok, 'name');
    expect(synth.spoken[1]?.text).toBe('기역');
    audio.dispose();
  });
});

describe('platform/audio.web: mute is the store (AD7)', () => {
  it('muted resolves muted without touching the engine, and records the failure', async () => {
    const { synth, audio } = rig();
    useAudioStore.getState().setMuted(true, 'profile');
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('muted');
    expect(synth.spoken).toHaveLength(0);
    expect(useAudioStore.getState().lastFailure?.reason).toBe('muted');
    audio.dispose();
  });

  it('switching the sound off stops what is speaking', async () => {
    const { synth, audio } = rig();
    synth.autoEnd = false;
    void audio.playPrompt({ text: '가' });
    await flush();
    const before = synth.cancelCount;
    useAudioStore.getState().setMuted(true, 'profile');
    expect(synth.cancelCount).toBeGreaterThan(before);
    audio.dispose();
  });

  it('setMuted / isMuted on the platform read and write the store', () => {
    const { audio } = rig();
    expect(audio.isMuted()).toBe(false);
    audio.setMuted(true);
    expect(useAudioStore.getState().muted).toBe(true);
    expect(audio.isMuted()).toBe(true);
    audio.dispose();
  });
});

describe('platform/audio.web: the legacy speak() surface', () => {
  it('calls onDone once when the utterance ends', async () => {
    const { synth, audio } = rig();
    const onDone = vi.fn();
    audio.speak('ㄱ', { onDone });
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(synth.spoken[0]?.voice?.name).toBe('Yuna');
    audio.dispose();
  });

  it('muted: onDone fires, nothing is spoken', async () => {
    const { synth, audio } = rig();
    useAudioStore.getState().setMuted(true, 'profile');
    const onDone = vi.fn();
    audio.speak('ㄴ', { onDone });
    await flush();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(synth.spoken).toHaveLength(0);
    audio.dispose();
  });

  it('routes a real synthesis error to onError, or to onDone when no onError was given', async () => {
    const a = rig({ voices: [YUNA] });
    a.synth.failNext('synthesis-failed');
    const onDone = vi.fn();
    const onError = vi.fn();
    a.audio.speak('가', { onDone, onError });
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    a.audio.dispose();

    const b = rig({ voices: [YUNA] });
    b.synth.failNext('synthesis-failed');
    const onDone2 = vi.fn();
    b.audio.speak('가', { onDone: onDone2 });
    await flush();
    expect(onDone2).toHaveBeenCalledTimes(1);
    b.audio.dispose();
  });

  it('stop cancels current speech', () => {
    const { synth, audio } = rig();
    audio.stop();
    expect(synth.cancelCount).toBe(1);
    audio.dispose();
  });

  it('a newer prompt supersedes the running one: the old resolves played, the new starts after 50 ms', async () => {
    vi.useFakeTimers();
    const { synth, audio } = rig();
    synth.autoEnd = false;
    const first = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(0);
    expect(synth.spoken).toHaveLength(1);
    const second = audio.playPrompt({ text: '나' });
    await expect(first).resolves.toBe('played');
    expect(synth.spoken).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(60);
    expect(synth.spoken).toHaveLength(2);
    synth.endCurrent();
    await expect(second).resolves.toBe('played');
    audio.dispose();
  });
});

describe('platform/audio.web: first-gesture unlock (AD8, §3.6)', () => {
  it('before any gesture a prompt is dropped by the browser: unavailable (blocked)', async () => {
    vi.useFakeTimers();
    const { synth, audio } = rig({ requireGesture: true });
    const result = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(1600);
    await expect(result).resolves.toBe('unavailable');
    expect(synth.dropped.length).toBeGreaterThan(0);
    expect(useAudioStore.getState().lastFailure?.reason).toBe('blocked');
    audio.dispose();
  });

  it('the first pointerdown unlocks speech silently, marks the store, and removes the listeners', async () => {
    const { synth, doc, audio } = rig({ requireGesture: true });
    const uninstall = audio.installGestureUnlock();
    expect(useAudioStore.getState().unlocked).toBe(false);

    synth.markUserGesture();
    doc.dispatchEvent(new Event('pointerdown'));
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]).toMatchObject({ text: ' ', volume: 0 });
    expect(useAudioStore.getState().unlocked).toBe(true);

    // listeners are gone: a second gesture speaks nothing more
    doc.dispatchEvent(new Event('pointerdown'));
    doc.dispatchEvent(new Event('touchend'));
    doc.dispatchEvent(new Event('keydown'));
    expect(synth.spoken).toHaveLength(1);

    // and a later prompt plays
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('played');
    uninstall();
    audio.dispose();
  });

  it.each(['touchend', 'keydown'])('%s also unlocks', (type) => {
    const { synth, doc, audio } = rig();
    audio.installGestureUnlock();
    doc.dispatchEvent(new Event(type));
    expect(synth.spoken[0]).toMatchObject({ text: ' ', volume: 0 });
    audio.dispose();
  });

  it('installing twice registers once', () => {
    const { synth, doc, audio } = rig();
    audio.installGestureUnlock();
    audio.installGestureUnlock();
    doc.dispatchEvent(new Event('pointerdown'));
    expect(synth.spoken).toHaveLength(1);
    audio.dispose();
  });

  it('uninstalling before a gesture removes the listeners', () => {
    const { synth, doc, audio } = rig();
    const uninstall = audio.installGestureUnlock();
    uninstall();
    doc.dispatchEvent(new Event('pointerdown'));
    expect(synth.spoken).toHaveLength(0);
    audio.dispose();
  });

  it('a page that goes to the background stops speech; coming back does not', () => {
    const { synth, doc, audio } = rig();
    audio.installGestureUnlock();
    const before = synth.cancelCount;
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(synth.cancelCount).toBe(before);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(synth.cancelCount).toBe(before + 1);
    audio.dispose();
  });
});

describe('platform/audio.web: capability', () => {
  it('pushes every change into the store and to subscribers', async () => {
    const { synth, audio } = rig({ voices: [] });
    const seen: string[] = [];
    const off = audio.subscribeCapability((c) => seen.push(c.tts.state));
    expect(useAudioStore.getState().tts.state).toBe('unknown');
    synth.setVoices([YUNA]);
    synth.fireVoicesChanged();
    expect(seen).toEqual(['ready']);
    expect(useAudioStore.getState().tts).toMatchObject({ state: 'ready', voiceName: 'Yuna' });
    off();
    audio.dispose();
  });

  it('refreshCapability re-reads the voice list (a voice pack was installed)', async () => {
    const { synth, audio } = rig({ voices: [SAMANTHA] });
    await flush();
    expect(audio.getCapability().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });
    synth.setVoices([SAMANTHA, YUNA]);
    await audio.refreshCapability();
    expect(audio.getCapability().tts).toMatchObject({ state: 'ready', voiceName: 'Yuna' });
    audio.dispose();
  });

  it('refreshCapability with no engine stays none/no_engine', async () => {
    const { audio } = rig({ noSynth: true });
    await audio.refreshCapability();
    expect(audio.getCapability().tts).toEqual({ state: 'none', reason: 'no_engine' });
    audio.dispose();
  });

  it('sends audio.capability_checked once, with classes only', async () => {
    const { audio } = rig();
    await flush();
    const checked = tracked.filter((e) => e.name === 'audio.capability_checked');
    expect(checked).toEqual([{ name: 'audio.capability_checked', payload: { platform: 'web', engine: 'tts', koVoice: 'local' } }]);
    audio.dispose();
  });

  it('fires audio.fallback_shown once per source and reason', () => {
    const { audio } = rig();
    audio.noteFallbackShown('match-sound', 'no_voice');
    audio.noteFallbackShown('match-sound', 'no_voice');
    audio.noteFallbackShown('match-sound', 'muted');
    expect(tracked.filter((e) => e.name === 'audio.fallback_shown')).toHaveLength(2);
    audio.dispose();
  });

  it('warmClips resolves (no clip path yet)', async () => {
    const { audio } = rig();
    await expect(audio.warmClips(['audio/jamo/giyeok.mp3'])).resolves.toBeUndefined();
    audio.dispose();
  });
});

describe('platform/audio.web: the module-level API (browser globals)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function load(withSynth: boolean) {
    vi.resetModules();
    const synth = new FakeSpeechSynthesis();
    synth.setVoices([...APPLE_KO, YUNA]);
    if (withSynth) {
      vi.stubGlobal('speechSynthesis', synth);
      vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    }
    vi.stubGlobal('document', new FakeDoc());
    const store = await import('../../store/audio-store');
    store.useAudioStore.setState({ muted: false, hydrated: true, levelOrder: null, lastFailure: null });
    const mod = await import('../audio.web');
    return { mod, synth, store };
  }

  it('playPrompt, speak, stop, setMuted and isMuted work on the default instance', async () => {
    const { mod, synth } = await load(true);
    await expect(mod.playPrompt({ text: '가' })).resolves.toBe('played');
    expect(synth.spoken[0]?.voice?.name).toBe('Yuna');
    mod.speak('나');
    mod.stop();
    mod.setMuted(true);
    expect(mod.isMuted()).toBe(true);
    await expect(mod.playPrompt({ text: '가' })).resolves.toBe('muted');
    mod.setMuted(false);
    await expect(mod.playJamoSound('ㄷ')).resolves.toBeUndefined();
    expect(synth.spoken.map((u) => u.text)).toContain('ㄷ');
  });

  it('without speechSynthesis every call is safe', async () => {
    const { mod } = await load(false);
    await expect(mod.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(mod.getCapability().tts).toEqual({ state: 'none', reason: 'no_engine' });
    mod.installGestureUnlock()();
    mod.unlockAudio();
    await mod.refreshCapability();
    await mod.warmClips([]);
    mod.noteFallbackShown('x', 'muted');
    expect(mod.subscribeCapability(() => undefined)()).toBeUndefined();
    await expect(mod.playJamo({ char: 'ㅏ', romanization: 'a', nameEn: 'a', spokenKind: 'sound' })).resolves.toBe('unavailable');
  });
});
