import * as contentSchema from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeAudioContext,
  FakeSpeechSynthesis,
  FakeUtterance,
  makeFakeFetch,
  type FakeVoice,
} from '../../test-support/fake-speech-synthesis';
import type { ClipFailure, ClipPlayer } from '../../logic/audio/controller';

const mem = vi.hoisted(() => new Map<string, unknown>());
const tracked = vi.hoisted(() => [] as Array<{ name: string; payload?: Record<string, unknown> }>);
vi.mock('../storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));
// The module-level instance resolves bundled clips through expo-asset (a native module tree vitest cannot load).
// On web Metro makes `require('x.mp3')` a URL string; natively it is a registry number.
vi.mock('expo-asset', () => ({
  Asset: { fromModule: (id: number | string) => ({ uri: typeof id === 'string' ? id : `/assets/clip-${id}.mp3` }) },
}));
vi.mock('../telemetry', () => ({
  track: vi.fn(async (e: { name: string; payload?: Record<string, unknown> }) => {
    tracked.push(e);
    return true;
  }),
}));

import { useAudioStore } from '../../store/audio-store';
import { createWebAudio, type WebAudioEnv } from '../audio.web';

/**
 * The suites that reset the module registry and import the module again (the default instance is made when the
 * module loads) re-evaluate its whole import graph in the test body. Most of that graph is
 * `@hangul-route/content-schema`, loaded from source and stateless, so these suites hand back the copy this file
 * already loaded: the reset still gives a fresh module, store and clip map, at a fraction of the cost. What is
 * left is still a cold module load, which a busy CI runner slows, so these suites allow 15 s, not the 5 s default.
 */
const RELOAD_SUITE = { timeout: 15_000 } as const;
function pinContentSchema(): void {
  vi.doMock('@hangul-route/content-schema', () => contentSchema);
}

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

/** A clip player double: each play settles as `next` says ('ok' = played to the end). */
class FakeClipPlayer implements ClipPlayer {
  next: 'ok' | ClipFailure | 'hold' = 'ok';
  readonly played: string[] = [];
  readonly warmed: string[][] = [];
  unlocks = 0;
  stops = 0;
  play(ref: string, h: { onStart(): void; onDone(): void; onError(reason: ClipFailure): void }): { stop(): void } {
    this.played.push(ref);
    const outcome = this.next;
    queueMicrotask(() => {
      if (outcome === 'hold') return;
      if (outcome === 'ok') {
        h.onStart();
        h.onDone();
      } else h.onError(outcome);
    });
    return { stop: () => undefined };
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

interface ClipRigOptions {
  player: FakeClipPlayer;
  refs?: string[];
  enabled?: boolean;
  /** The browser has Web Audio and fetch (default true). */
  supported?: boolean;
}

function rig(
  opts: {
    voices?: FakeVoice[];
    noSynth?: boolean;
    requireGesture?: boolean;
    online?: boolean;
    clips?: ClipRigOptions;
    /** `navigator.userActivation.isActive` as the browser reports it (absent: a browser with no such API). */
    userActive?: () => boolean | null;
  } = {},
): Rig {
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
  if (opts.userActive) env.userActive = opts.userActive;
  if (opts.clips) {
    const refs = new Set(opts.clips.refs ?? [GIYEOK_CLIP]);
    const enabled = opts.clips.enabled ?? true;
    env.clips = {
      player: opts.clips.player,
      assets: { has: (ref) => refs.has(ref), size: refs.size },
      enabled: () => enabled,
      supported: opts.clips.supported ?? true,
    };
  }
  return { synth, doc, win, online, audio: createWebAudio(env) };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A pointer event with its `pointerType` (Node has no PointerEvent). */
function pointer(type: string, pointerType: 'mouse' | 'touch' | 'pen'): Event {
  return Object.assign(new Event(type), { pointerType });
}

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

  it('a touch pointerdown speaks nothing and keeps listening (it carries no activation on a touch screen)', async () => {
    const { synth, doc, audio } = rig();
    audio.installGestureUnlock();
    doc.dispatchEvent(pointer('pointerdown', 'touch'));
    await flush();
    expect(synth.spoken).toHaveLength(0);
    expect(useAudioStore.getState().unlocked).toBe(false);
    // Still listening: the tap's touchend unlocks.
    doc.dispatchEvent(new Event('touchend'));
    expect(synth.spoken).toHaveLength(1);
    audio.dispose();
  });

  it('the tap\'s touchend speaks one silent Korean utterance; unlocked only after its onstart; then the listeners go', async () => {
    const { synth, doc, audio } = rig({ requireGesture: true });
    await flush();
    const uninstall = audio.installGestureUnlock();
    expect(useAudioStore.getState().unlocked).toBe(false);

    synth.markUserGesture();
    doc.dispatchEvent(new Event('touchend'));
    expect(synth.spoken).toHaveLength(1);
    // The unlock also warms the Korean engine: Korean language, the ranked Korean voice.
    expect(synth.spoken[0]).toMatchObject({ text: ' ', volume: 0, lang: 'ko-KR' });
    expect(synth.spoken[0]?.voice?.name).toBe('Yuna');
    expect(useAudioStore.getState().unlocked).toBe(false);
    await flush();
    expect(useAudioStore.getState().unlocked).toBe(true);

    // listeners are gone: a second gesture speaks nothing more
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) doc.dispatchEvent(new Event(type));
    doc.dispatchEvent(pointer('pointerdown', 'mouse'));
    expect(synth.spoken).toHaveLength(1);

    // and a later prompt plays
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('played');
    uninstall();
    audio.dispose();
  });

  it.each(['pointerup', 'touchend', 'click', 'keydown'])('%s unlocks', (type) => {
    const { synth, doc, audio } = rig();
    audio.installGestureUnlock();
    doc.dispatchEvent(new Event(type));
    expect(synth.spoken[0]).toMatchObject({ text: ' ', volume: 0, lang: 'ko-KR' });
    audio.dispose();
  });

  it('a mouse pointerdown unlocks (a mouse press is an activation)', () => {
    const { synth, doc, audio } = rig();
    audio.installGestureUnlock();
    doc.dispatchEvent(pointer('pointerdown', 'mouse'));
    expect(synth.spoken[0]).toMatchObject({ text: ' ', volume: 0 });
    audio.dispose();
  });

  it('one tap speaks one unlock: the tap\'s later events wait for the answer of the one the engine holds', async () => {
    const { synth, doc, audio } = rig();
    synth.autoEnd = false;
    audio.installGestureUnlock();
    for (const type of ['pointerup', 'touchend', 'click']) doc.dispatchEvent(new Event(type));
    audio.unlockAudio();
    expect(synth.spoken.map((u) => u.text)).toEqual([' ']);
    audio.dispose();
  });

  it('an unlock the engine dropped without a word (iOS outside the gesture) is tried again on the next activation', async () => {
    const { synth, doc, audio } = rig({ requireGesture: true });
    audio.installGestureUnlock();
    doc.dispatchEvent(new Event('pointerup'));
    expect(synth.dropped).toHaveLength(1);
    synth.markUserGesture();
    doc.dispatchEvent(new Event('touchend'));
    expect(synth.spoken.map((u) => u.text)).toEqual([' ']);
    await flush();
    expect(useAudioStore.getState().unlocked).toBe(true);
    audio.dispose();
  });

  it('a not-allowed unlock keeps the listeners, and the next activation unlocks', async () => {
    const { synth, doc, audio } = rig();
    synth.requireActivation = true;
    audio.installGestureUnlock();
    doc.dispatchEvent(new Event('touchend'));
    await flush();
    expect(synth.refused).toHaveLength(1);
    expect(useAudioStore.getState().unlocked).toBe(false);
    synth.activate();
    doc.dispatchEvent(new Event('touchend'));
    await flush();
    expect(synth.spoken.map((u) => u.text)).toEqual([' ']);
    expect(useAudioStore.getState().unlocked).toBe(true);
    audio.dispose();
  });

  it('an unlock that ends with an engine error other than not-allowed counts (the engine took it)', async () => {
    const { synth, doc, audio } = rig();
    synth.failNext('synthesis-failed');
    audio.installGestureUnlock();
    doc.dispatchEvent(new Event('touchend'));
    await flush();
    expect(useAudioStore.getState().unlocked).toBe(true);
    doc.dispatchEvent(new Event('touchend'));
    expect(synth.spoken).toHaveLength(1);
    audio.dispose();
  });

  it('unlockAudio() from a click (the presenter Start) unlocks on its own, and installs nothing', async () => {
    const { synth, doc, audio } = rig();
    audio.unlockAudio();
    expect(synth.spoken[0]).toMatchObject({ text: ' ', volume: 0, lang: 'ko-KR' });
    await flush();
    expect(useAudioStore.getState().unlocked).toBe(true);
    // Unlocked already: installing later adds no speech listener, and a second call speaks nothing.
    audio.installGestureUnlock();
    doc.dispatchEvent(new Event('touchend'));
    audio.unlockAudio();
    expect(synth.spoken).toHaveLength(1);
    audio.dispose();
  });

  it('a prompt asked in the unlocking tap queues behind the silent unlock, and its clock waits for it: every utterance 2 s cold, no cancel, played', async () => {
    vi.useFakeTimers();
    const { synth, doc, audio } = rig();
    // A cold engine that holds every utterance 2 s before it starts, the unlock and the prompt alike.
    synth.startDelayMs = 2000;
    synth.endDelayMs = 400;
    audio.installGestureUnlock();
    await vi.advanceTimersByTimeAsync(0);
    doc.dispatchEvent(new Event('touchend'));
    const result = audio.playPrompt({ text: '안녕하세요', kind: 'word', source: 'presenter-check' });
    let settled: string | null = null;
    void result.then((v) => (settled = v));
    await vi.advanceTimersByTimeAsync(0);
    expect(synth.spoken.map((u) => u.text)).toEqual([' ', '안녕하세요']);
    // The engine took the unlock (it still holds it a second later): unlocked, before any event.
    await vi.advanceTimersByTimeAsync(1000);
    expect(useAudioStore.getState().unlocked).toBe(true);
    // The unlock starts at 2 s and ends at 2.4 s; the prompt then waits its own 2 s and starts at 4.4 s,
    // past the 4 s a prompt gets on its own: the unlock's cold start was not counted against it.
    await vi.advanceTimersByTimeAsync(3300);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(500);
    expect(settled).toBe('played');
    expect(synth.cancelCount).toBe(0);
    expect(useAudioStore.getState().lastFailure).toBeNull();
    audio.dispose();
  });

  it('an engine that gives the blank unlock no event but speaks a prompt: unlocked once the prompt starts, and the listeners go', async () => {
    const { synth, doc, audio } = rig();
    synth.blank = 'ignore';
    audio.installGestureUnlock();
    await flush();
    doc.dispatchEvent(new Event('touchend'));
    expect(synth.spoken.map((u) => u.text)).toEqual([' ']);
    expect(useAudioStore.getState().unlocked).toBe(false);
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('played');
    expect(useAudioStore.getState().unlocked).toBe(true);
    // Unlocked: a later tap sends no more unlocks.
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) doc.dispatchEvent(new Event(type));
    expect(synth.spoken.map((u) => u.text)).toEqual([' ', '가']);
    audio.dispose();
  });

  it('an engine that holds the blank unlock with no event (speaking, a stuck queue): the prompt asked in that tap is cleared once and plays, never blocked', async () => {
    vi.useFakeTimers();
    const { synth, doc, audio } = rig();
    synth.blank = 'hang';
    audio.installGestureUnlock();
    await vi.advanceTimersByTimeAsync(0);
    doc.dispatchEvent(new Event('touchend'));
    const first = audio.playPrompt({ text: '안녕하세요', source: 'presenter-check' });
    await vi.advanceTimersByTimeAsync(0);
    expect(synth.spoken.map((u) => u.text)).toEqual([' ', '안녕하세요']);
    expect(synth.speaking).toBe(true);
    // The engine held it for a second without refusing: unlocked.
    await vi.advanceTimersByTimeAsync(1000);
    expect(useAudioStore.getState().unlocked).toBe(true);
    // At 3 s the queue has not moved: it is cleared and the prompt is asked again.
    await vi.advanceTimersByTimeAsync(2100);
    await expect(first).resolves.toBe('played');
    expect(synth.cancelCount).toBe(1);
    expect(synth.spoken.map((u) => u.text)).toEqual([' ', '안녕하세요', '안녕하세요']);
    expect(useAudioStore.getState().lastFailure).toBeNull();
    // The next tap's prompt plays at once.
    const second = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(10);
    await expect(second).resolves.toBe('played');
    expect(synth.cancelCount).toBe(1);
    expect(tracked.filter((e) => e.name === 'audio.playback_failed')).toEqual([]);
    audio.dispose();
  });

  it('an ignored unlock leaves nothing ahead: a later prompt that starts late gets the plain wait and grace, not the warm-up wait', async () => {
    vi.useFakeTimers();
    const { synth, doc, audio } = rig({ userActive: () => true });
    synth.blank = 'ignore';
    audio.installGestureUnlock();
    await vi.advanceTimersByTimeAsync(0);
    doc.dispatchEvent(new Event('touchend'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(useAudioStore.getState().unlocked).toBe(true);
    // A cold engine now: the prompt is held 3.5 s, inside 1.5 s and the 2.5 s grace; never cancelled.
    synth.startDelayMs = 3500;
    const result = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(3600);
    await expect(result).resolves.toBe('played');
    expect(synth.cancelCount).toBe(0);
    expect(synth.spoken.map((u) => u.text)).toEqual([' ', '가']);
    audio.dispose();
  });

  it('a held unlock older than half a second counts as busy: a prompt from a later tap cancels it and plays at once', async () => {
    vi.useFakeTimers();
    const { synth, doc, audio } = rig();
    synth.blank = 'hang';
    audio.installGestureUnlock();
    await vi.advanceTimersByTimeAsync(0);
    doc.dispatchEvent(new Event('touchend'));
    await vi.advanceTimersByTimeAsync(2000);
    const result = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(0);
    expect(synth.cancelCount).toBe(1);
    await vi.advanceTimersByTimeAsync(60);
    await expect(result).resolves.toBe('played');
    expect(synth.spoken.map((u) => u.text)).toEqual([' ', '가']);
    audio.dispose();
  });

  it('an unlock that has started and is still ending is not cancelled by a prompt from a later tap: the prompt queues behind it', async () => {
    vi.useFakeTimers();
    const { synth, doc, audio } = rig();
    synth.startDelayMs = 2000;
    synth.endDelayMs = 400;
    audio.installGestureUnlock();
    await vi.advanceTimersByTimeAsync(0);
    doc.dispatchEvent(new Event('touchend'));
    await vi.advanceTimersByTimeAsync(2200);
    expect(synth.speaking).toBe(true);
    const result = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(4500);
    await expect(result).resolves.toBe('played');
    expect(synth.cancelCount).toBe(0);
    audio.dispose();
  });

  it('an unlock with no answer and an idle engine: unlocked when the browser said the tap was a user activation; otherwise the next tap sends again', async () => {
    vi.useFakeTimers();
    const active = rig({ userActive: () => true });
    active.synth.blank = 'ignore';
    active.audio.installGestureUnlock();
    active.doc.dispatchEvent(new Event('touchend'));
    await vi.advanceTimersByTimeAsync(999);
    expect(useAudioStore.getState().unlocked).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(useAudioStore.getState().unlocked).toBe(true);
    active.doc.dispatchEvent(new Event('touchend'));
    expect(active.synth.spoken).toHaveLength(1);
    active.audio.dispose();

    useAudioStore.setState({ unlocked: false });
    const unknown = rig();
    unknown.synth.blank = 'ignore';
    unknown.audio.installGestureUnlock();
    unknown.doc.dispatchEvent(new Event('touchend'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(useAudioStore.getState().unlocked).toBe(false);
    unknown.doc.dispatchEvent(new Event('touchend'));
    expect(unknown.synth.spoken.map((u) => u.text)).toEqual([' ', ' ']);
    unknown.audio.dispose();
  });

  it('installing twice registers once', () => {
    const { synth, doc, audio } = rig();
    synth.autoEnd = false;
    synth.neverStart = true;
    audio.installGestureUnlock();
    audio.installGestureUnlock();
    doc.dispatchEvent(new Event('touchend'));
    expect(synth.spoken).toHaveLength(1);
    audio.dispose();
  });

  it('uninstalling before a gesture removes the listeners', () => {
    const { synth, doc, audio } = rig();
    const uninstall = audio.installGestureUnlock();
    uninstall();
    doc.dispatchEvent(new Event('touchend'));
    doc.dispatchEvent(pointer('pointerdown', 'mouse'));
    expect(synth.spoken).toHaveLength(0);
    audio.dispose();
  });

  it('a page that goes to the background stops speech; coming back to an idle engine does not', () => {
    const { synth, doc, audio } = rig();
    audio.installGestureUnlock();
    const before = synth.cancelCount;
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(synth.cancelCount).toBe(before);
    expect(synth.resumeCount).toBe(0);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(synth.cancelCount).toBe(before + 1);
    audio.dispose();
  });

  it('coming back to a stuck pending queue cancels it, and a paused engine is resumed', () => {
    const { synth, doc, audio } = rig();
    audio.installGestureUnlock();
    // What the hidden page left in the engine: a queue that never started, paused.
    synth.neverStart = true;
    synth.speak(new FakeUtterance('stale'));
    synth.speak(new FakeUtterance('stale too'));
    synth.pause();
    expect(synth.pending).toBe(true);
    const before = synth.cancelCount;
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(synth.cancelCount).toBe(before + 1);
    expect(synth.pending).toBe(false);
    expect(synth.paused).toBe(false);
    audio.dispose();
  });
});

describe('platform/audio.web: the engine (F-AUDIO-004 section 3.5, 2026-10-17)', () => {
  it('a paused engine gets resume() before the speak, and the prompt plays', async () => {
    const { synth, audio } = rig();
    await flush();
    synth.pause();
    const result = audio.playPrompt({ text: '가' });
    await flush();
    expect(synth.resumeCount).toBe(1);
    await expect(result).resolves.toBe('played');
    expect(synth.spoken.map((u) => u.text)).toEqual(['가']);
    audio.dispose();
  });

  it('a cold engine that holds the prompt for 2 s is not cancelled: played', async () => {
    vi.useFakeTimers();
    const { synth, audio } = rig();
    await vi.advanceTimersByTimeAsync(0);
    synth.startDelayMs = 2000;
    synth.endDelayMs = 400;
    const result = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(2400);
    await expect(result).resolves.toBe('played');
    expect(synth.cancelCount).toBe(0);
    expect(synth.resumeCount).toBe(1);
    audio.dispose();
  });

  it('a prompt cancelled while speaking keeps the engine busy until its own interrupted arrives: the next one is spoken then, not at 50 ms', async () => {
    vi.useFakeTimers();
    const { synth, audio } = rig();
    await vi.advanceTimersByTimeAsync(0);
    synth.autoEnd = false;
    synth.cancelErrorDelayMs = 150;
    const a = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(10);
    const b = audio.playPrompt({ text: '나' });
    await expect(a).resolves.toBe('played');
    // Past the 50 ms floor: the platform has not said the first one stopped.
    await vi.advanceTimersByTimeAsync(100);
    expect(synth.spoken.map((u) => u.text)).toEqual(['가']);
    // Its canceled arrives at 160 ms; the next poll speaks.
    await vi.advanceTimersByTimeAsync(80);
    expect(synth.spoken.map((u) => u.text)).toEqual(['가', '나']);
    synth.endCurrent();
    await expect(b).resolves.toBe('played');
    audio.dispose();
  });

  it('a cancelled prompt whose interrupted never comes holds the next one at most 300 ms', async () => {
    vi.useFakeTimers();
    const { synth, audio } = rig();
    await vi.advanceTimersByTimeAsync(0);
    synth.autoEnd = false;
    synth.cancelError = null;
    const a = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(10);
    const b = audio.playPrompt({ text: '나' });
    await expect(a).resolves.toBe('played');
    await vi.advanceTimersByTimeAsync(280);
    expect(synth.spoken.map((u) => u.text)).toEqual(['가']);
    await vi.advanceTimersByTimeAsync(40);
    expect(synth.spoken.map((u) => u.text)).toEqual(['가', '나']);
    synth.endCurrent();
    await expect(b).resolves.toBe('played');
    audio.dispose();
  });

  it('Chrome\'s not-allowed is blocked (not error), and its code goes to telemetry with the source', async () => {
    const { synth, audio } = rig();
    await flush();
    synth.requireActivation = true;
    await expect(audio.playPrompt({ text: '가', source: 'discover' })).resolves.toBe('unavailable');
    expect(useAudioStore.getState().lastFailure?.reason).toBe('blocked');
    expect(tracked.filter((e) => e.name === 'audio.playback_failed')).toEqual([
      { name: 'audio.playback_failed', payload: { kind: 'tts', reason: 'blocked', code: 'not-allowed', source: 'discover' } },
    ]);
    audio.dispose();
  });

  it('an engine error keeps its Web Speech code, and an unknown code is other', async () => {
    const a = rig({ voices: [YUNA] });
    a.synth.failNext('audio-busy');
    await expect(a.audio.playPrompt({ text: '가', source: 'trace' })).resolves.toBe('unavailable');
    a.audio.dispose();
    const b = rig({ voices: [YUNA] });
    b.synth.failNext('something-new');
    await expect(b.audio.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    b.audio.dispose();
    expect(tracked.filter((e) => e.name === 'audio.playback_failed').map((e) => e.payload)).toEqual([
      { kind: 'tts', reason: 'engine', code: 'audio-busy', source: 'trace' },
      { kind: 'tts', reason: 'engine', code: 'other', source: 'unknown' },
    ]);
  });
});

describe('platform/audio.web: old and odd engines', () => {
  const lone = (extra: Record<string, unknown> = {}) => {
    const spoken: FakeUtterance[] = [];
    const synth = {
      speaking: false,
      pending: false,
      spoken,
      getVoices: () => [YUNA],
      speak: (u: FakeUtterance) => {
        spoken.push(u);
        queueMicrotask(() => u.onend?.({}));
      },
      cancel: () => undefined,
      ...extra,
    };
    const env: WebAudioEnv = {
      synth: synth as unknown as WebAudioEnv['synth'],
      Utterance: FakeUtterance as unknown as NonNullable<WebAudioEnv['Utterance']>,
      doc: null,
      win: null,
      isOnline: () => true,
    };
    return { synth, audio: createWebAudio(env) };
  };

  it('a speechSynthesis without addEventListener (Safari before 14.1) works through onvoiceschanged', async () => {
    const { synth, audio } = lone();
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('played');
    expect(synth.spoken[0]?.voice?.name).toBe('Yuna');
    expect(typeof (synth as { onvoiceschanged?: unknown }).onvoiceschanged).toBe('function');
    audio.dispose();
    expect((synth as { onvoiceschanged?: unknown }).onvoiceschanged).toBeNull();
  });

  it('late voices reach every listener through the single onvoiceschanged slot', async () => {
    let voices: FakeVoice[] = [];
    const { synth, audio } = lone({ getVoices: () => voices });
    await flush();
    expect(audio.getCapability().tts.state).toBe('unknown');
    voices = [YUNA];
    (synth as { onvoiceschanged?: () => void }).onvoiceschanged?.();
    expect(audio.getCapability().tts).toMatchObject({ state: 'ready', voiceName: 'Yuna' });
    audio.dispose();
  });

  it('a getVoices() that throws reads as no voices, not a crash', async () => {
    vi.useFakeTimers();
    const { audio } = lone({
      getVoices: () => {
        throw new Error('not ready');
      },
    });
    const result = audio.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(1600);
    await expect(result).resolves.toBe('unavailable');
    expect(audio.getCapability().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });
    audio.dispose();
  });

  it('a voice the utterance will not take still speaks, with the language alone', async () => {
    class StrictUtterance extends FakeUtterance {}
    Object.defineProperty(StrictUtterance.prototype, 'voice', {
      set() {
        throw new TypeError('not a SpeechSynthesisVoice');
      },
      get: () => null,
    });
    const spoken: string[] = [];
    const env: WebAudioEnv = {
      synth: {
        speaking: false,
        pending: false,
        getVoices: () => [YUNA],
        speak: (u: { text?: string; onend: ((e: unknown) => void) | null }) => {
          spoken.push(String(u.text));
          queueMicrotask(() => u.onend?.({}));
        },
        cancel: () => undefined,
      } as unknown as WebAudioEnv['synth'],
      Utterance: StrictUtterance as unknown as NonNullable<WebAudioEnv['Utterance']>,
      doc: null,
      win: null,
      isOnline: () => true,
    };
    const audio = createWebAudio(env);
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('played');
    expect(spoken).toEqual(['가']);
    audio.dispose();
  });

  it('an utterance the engine refuses to build or speak is a failed prompt, not an exception', async () => {
    const { audio } = lone({
      speak: () => {
        throw new Error('refused');
      },
    });
    await expect(audio.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(useAudioStore.getState().lastFailure?.reason).toBe('error');
    audio.dispose();
  });

  it('an engine that throws on the unlock utterance is ignored', () => {
    const { audio } = lone({
      speak: () => {
        throw new Error('refused');
      },
    });
    expect(() => audio.unlockAudio()).not.toThrow();
    expect(useAudioStore.getState().unlocked).toBe(true);
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

  it('refreshCapability on Chrome\'s empty first list waits for voiceschanged: unknown to ready, never none, one capability_checked', async () => {
    vi.useFakeTimers();
    const { synth, audio } = rig({ voices: [] });
    const seen: string[] = [];
    const off = audio.subscribeCapability((c) => seen.push(c.tts.state));
    synth.voicesLoadDelayMs = 800;
    synth.setVoices([YUNA]);
    let done = false;
    void audio.refreshCapability().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(799);
    expect(done).toBe(false);
    expect(audio.getCapability().tts.state).toBe('unknown');
    expect(useAudioStore.getState().tts.state).toBe('unknown');
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(audio.getCapability().tts).toMatchObject({ state: 'ready', voiceName: 'Yuna' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(seen).toEqual(['ready']);
    expect(tracked.filter((e) => e.name === 'audio.capability_checked')).toEqual([
      { name: 'audio.capability_checked', payload: { platform: 'web', engine: 'tts', koVoice: 'local' } },
    ]);
    off();
    audio.dispose();
  });

  it('refreshCapability with no voices at all ends none after the 1.5 s wait', async () => {
    vi.useFakeTimers();
    const { audio } = rig({ voices: [] });
    let done = false;
    void audio.refreshCapability().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(audio.getCapability().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });
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

  it('warmClips resolves when the build has no clip player', async () => {
    const { audio } = rig();
    await expect(audio.warmClips(['audio/jamo/giyeok.mp3'])).resolves.toBeUndefined();
    expect(audio.hasClip('audio/jamo/giyeok.mp3')).toBe(false);
    audio.dispose();
  });
});

describe('platform/audio.web: bundled clips (A-6, AD4: clip > voice > text)', () => {
  it('a ref with a bundled clip plays the clip and the voice stays silent', async () => {
    const player = new FakeClipPlayer();
    const { synth, audio } = rig({ clips: { player } });
    await expect(audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP, kind: 'sound' })).resolves.toBe('played');
    expect(player.played).toEqual([GIYEOK_CLIP]);
    expect(synth.spoken).toHaveLength(0);
    audio.dispose();
  });

  it('playJamo uses the jamo audioRef', async () => {
    const player = new FakeClipPlayer();
    const { synth, audio } = rig({ clips: { player } });
    const giyeok = { char: 'ㄱ', romanization: 'g/k', nameEn: 'giyeok', spokenKo: '가', spokenKind: 'sound' as const, audioRef: GIYEOK_CLIP };
    await expect(audio.playJamo(giyeok, 'sound')).resolves.toBe('played');
    expect(player.played).toEqual([GIYEOK_CLIP]);
    expect(synth.spoken).toHaveLength(0);
    audio.dispose();
  });

  it('a clip that fails to decode falls through to the voice and is reported once', async () => {
    const player = new FakeClipPlayer();
    player.next = 'decode';
    const { synth, audio } = rig({ clips: { player } });
    await expect(audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP })).resolves.toBe('played');
    expect(synth.spoken.map((u) => u.text)).toEqual(['가']);
    expect(tracked.filter((e) => e.name === 'audio.playback_failed')).toEqual([
      { name: 'audio.playback_failed', payload: { kind: 'clip', reason: 'decode', code: 'none', source: 'unknown' } },
    ]);
    audio.dispose();
  });

  it('a ref with no bundled file goes straight to the voice', async () => {
    const player = new FakeClipPlayer();
    const { synth, audio } = rig({ clips: { player } });
    await audio.playPrompt({ text: '나', audioRef: 'audio/jamo/nieun.mp3' });
    expect(player.played).toEqual([]);
    expect(synth.spoken.map((u) => u.text)).toEqual(['나']);
    audio.dispose();
  });

  it('a clip plays on a device with no Korean voice', async () => {
    const player = new FakeClipPlayer();
    const { synth, audio } = rig({ voices: [SAMANTHA], clips: { player } });
    await expect(audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP })).resolves.toBe('played');
    expect(synth.spoken).toHaveLength(0);
    expect(audio.getCapability().clips).toBe(true);
    expect(useAudioStore.getState().clips).toBe(true);
    audio.dispose();
  });

  it('muted never touches the clip player', async () => {
    const player = new FakeClipPlayer();
    const { audio } = rig({ clips: { player } });
    useAudioStore.getState().setMuted(true, 'profile');
    await expect(audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP })).resolves.toBe('muted');
    expect(player.played).toEqual([]);
    audio.dispose();
  });

  it('flags.audioClips off: the voice speaks, no clip is counted, nothing is warmed', async () => {
    const player = new FakeClipPlayer();
    const { synth, audio } = rig({ clips: { player, enabled: false } });
    await audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP });
    expect(player.played).toEqual([]);
    expect(synth.spoken.map((u) => u.text)).toEqual(['가']);
    expect(audio.getCapability().clips).toBe(false);
    expect(audio.hasClip(GIYEOK_CLIP)).toBe(false);
    await audio.warmClips([GIYEOK_CLIP]);
    expect(player.warmed).toEqual([]);
    audio.dispose();
  });

  it('an empty clip map counts as no clips', () => {
    const player = new FakeClipPlayer();
    const { audio } = rig({ clips: { player, refs: [] } });
    expect(audio.getCapability().clips).toBe(false);
    audio.dispose();
  });

  it('hasClip is true only for a bundled ref', () => {
    const { audio } = rig({ clips: { player: new FakeClipPlayer() } });
    expect(audio.hasClip(GIYEOK_CLIP)).toBe(true);
    expect(audio.hasClip('audio/jamo/nieun.mp3')).toBe(false);
    expect(audio.hasClip(undefined)).toBe(false);
    audio.dispose();
  });

  it('warmClips pre-decodes only the bundled refs', async () => {
    const player = new FakeClipPlayer();
    const { audio } = rig({ clips: { player } });
    await audio.warmClips([GIYEOK_CLIP, 'audio/jamo/nieun.mp3']);
    expect(player.warmed).toEqual([[GIYEOK_CLIP]]);
    await audio.warmClips(['audio/jamo/nieun.mp3']);
    expect(player.warmed).toHaveLength(1);
    audio.dispose();
  });

  it('the first gesture unlocks the clip player too', () => {
    const player = new FakeClipPlayer();
    const { doc, audio } = rig({ clips: { player } });
    audio.installGestureUnlock();
    doc.dispatchEvent(new Event('touchend'));
    expect(player.unlocks).toBe(1);
    audio.unlockAudio();
    expect(player.unlocks).toBe(2);
    audio.dispose();
  });

  it('stop, a hidden page and switching the sound off all stop clips', async () => {
    const player = new FakeClipPlayer();
    const { doc, audio } = rig({ clips: { player } });
    audio.installGestureUnlock();
    player.next = 'hold';
    const pending = audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP });
    await flush();
    audio.stop();
    await expect(pending).resolves.toBe('played');
    const afterStop = player.stops;
    expect(afterStop).toBeGreaterThan(0);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(player.stops).toBeGreaterThan(afterStop);
    const afterHide = player.stops;
    useAudioStore.getState().setMuted(true, 'profile');
    expect(player.stops).toBeGreaterThan(afterHide);
    audio.dispose();
  });
});

describe('platform/audio.web: the clip context is touched only when clips can play (review)', () => {
  it('flag off: a gesture never unlocks the clip player, and speech still unlocks', () => {
    const player = new FakeClipPlayer();
    const { synth, doc, audio } = rig({ clips: { player, enabled: false } });
    audio.installGestureUnlock();
    doc.dispatchEvent(new Event('pointerdown'));
    doc.dispatchEvent(new Event('click'));
    expect(player.unlocks).toBe(0);
    expect(synth.spoken[0]).toMatchObject({ text: ' ', volume: 0 });
    audio.dispose();
  });

  it('an empty clip map: a gesture never unlocks the clip player', () => {
    const player = new FakeClipPlayer();
    const { synth, doc, audio } = rig({ clips: { player, refs: [] } });
    audio.installGestureUnlock();
    doc.dispatchEvent(new Event('pointerdown'));
    doc.dispatchEvent(new Event('touchend'));
    audio.unlockAudio();
    expect(player.unlocks).toBe(0);
    expect(synth.spoken.length).toBeGreaterThan(0);
    audio.dispose();
  });

  it('a browser without Web Audio or fetch: no clip is claimed, tried or unlocked', async () => {
    const player = new FakeClipPlayer();
    const { synth, audio } = rig({ clips: { player, supported: false } });
    expect(audio.hasClip(GIYEOK_CLIP)).toBe(false);
    expect(audio.getCapability().clips).toBe(false);
    audio.unlockAudio();
    expect(player.unlocks).toBe(0);
    await expect(audio.playPrompt({ text: '가', audioRef: GIYEOK_CLIP })).resolves.toBe('played');
    expect(player.played).toEqual([]);
    expect(synth.spoken.map((u) => u.text)).toContain('가');
    audio.dispose();
  });

  it('a clip player that throws on unlock never stops the speech unlock', async () => {
    const player = new FakeClipPlayer();
    player.unlock = () => {
      throw new Error('NotAllowedError');
    };
    const { synth, audio } = rig({ clips: { player } });
    expect(() => audio.unlockAudio()).not.toThrow();
    expect(synth.spoken[0]).toMatchObject({ text: ' ', volume: 0 });
    await flush();
    expect(useAudioStore.getState().unlocked).toBe(true);
  });

  it('every later tap offers the clip context a restart (after the background, a call or a blocked clip)', () => {
    const player = new FakeClipPlayer();
    const { doc, audio } = rig({ clips: { player } });
    const uninstall = audio.installGestureUnlock();
    doc.dispatchEvent(new Event('pointerup'));
    expect(player.unlocks).toBe(1);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    // Touch screens: pointerup / touchend / click carry the activation pointerdown does not.
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) doc.dispatchEvent(new Event(type));
    expect(player.unlocks).toBe(5);
    uninstall();
    doc.dispatchEvent(new Event('click'));
    expect(player.unlocks).toBe(5);
    audio.dispose();
  });
});

describe('platform/audio.web: the module-level API (browser globals)', RELOAD_SUITE, () => {
  beforeEach(pinContentSchema);
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('@hangul-route/content-schema');
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
    await expect(mod.playJamo({ char: 'ㄷ', romanization: 'd/t', nameEn: 'digeut', spokenKo: '다', spokenKind: 'sound' }, 'sound')).resolves.toBe('played');
    expect(synth.spoken.map((u) => u.text)).toContain('다');
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
    expect(mod.hasClip('audio/jamo/giyeok.mp3')).toBe(false);
    expect(mod.subscribeCapability(() => undefined)()).toBeUndefined();
    await expect(mod.playJamo({ char: 'ㅏ', romanization: 'a', nameEn: 'a', spokenKind: 'sound' })).resolves.toBe('unavailable');
  });

  it('resolves a bundled clip through expo-asset and plays it with Web Audio and fetch', async () => {
    vi.resetModules();
    vi.doMock('../../content/__generated__/audio-assets', () => ({ AUDIO_ASSETS: { 'audio/jamo/giyeok.mp3': 7 } }));
    const contexts: FakeAudioContext[] = [];
    class RecordingContext extends FakeAudioContext {
      constructor() {
        super();
        contexts.push(this);
      }
    }
    vi.stubGlobal('AudioContext', RecordingContext);
    const fetchFn = makeFakeFetch({ '/assets/clip-7.mp3': new ArrayBuffer(64) });
    vi.stubGlobal('fetch', fetchFn);
    const { mod, synth } = await load(true);
    expect(mod.hasClip('audio/jamo/giyeok.mp3')).toBe(true);
    expect(mod.getCapability().clips).toBe(true);
    mod.unlockAudio();
    const result = mod.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' });
    await vi.waitFor(() => expect(contexts[0]?.sources.length).toBe(2));
    expect(fetchFn.calls).toEqual(['/assets/clip-7.mp3']);
    contexts[0]!.sources[1]!.onended?.();
    await expect(result).resolves.toBe('played');
    // Only the silent unlock utterance: the clip played, the voice did not.
    expect(synth.spoken.map((u) => u.text)).toEqual([' ']);
    // A ref the map does not hold is spoken by the voice.
    await expect(mod.playPrompt({ text: '나', audioRef: 'audio/jamo/nieun.mp3' })).resolves.toBe('played');
    expect(synth.spoken.map((u) => u.text)).toEqual([' ', '나']);
    vi.doUnmock('../../content/__generated__/audio-assets');
  });

  it('with no bundled clips a gesture creates no AudioContext (production before A-9)', async () => {
    vi.resetModules();
    vi.doMock('../../content/__generated__/audio-assets', () => ({ AUDIO_ASSETS: {} }));
    const contexts: FakeAudioContext[] = [];
    class RecordingContext extends FakeAudioContext {
      constructor() {
        super();
        contexts.push(this);
      }
    }
    vi.stubGlobal('AudioContext', RecordingContext);
    const { mod, synth } = await load(true);
    mod.installGestureUnlock();
    mod.unlockAudio();
    expect(contexts).toHaveLength(0);
    expect(synth.spoken.map((u) => u.text)).toEqual([' ']);
    vi.doUnmock('../../content/__generated__/audio-assets');
  });

  it('a web asset module that is a URL string (Metro on web) resolves through expo-asset', async () => {
    vi.resetModules();
    const url = '/assets/assets/audio/jamo/giyeok.abc.mp3';
    vi.doMock('../../content/__generated__/audio-assets', () => ({ AUDIO_ASSETS: { 'audio/jamo/giyeok.mp3': url } }));
    const contexts: FakeAudioContext[] = [];
    class RecordingContext extends FakeAudioContext {
      constructor() {
        super();
        contexts.push(this);
      }
    }
    vi.stubGlobal('AudioContext', RecordingContext);
    const fetchFn = makeFakeFetch({ [url]: new ArrayBuffer(64) });
    vi.stubGlobal('fetch', fetchFn);
    const { mod } = await load(true);
    mod.unlockAudio();
    const result = mod.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' });
    await vi.waitFor(() => expect(contexts[0]?.sources.length).toBe(2));
    expect(fetchFn.calls).toEqual([url]);
    contexts[0]!.sources[1]!.onended?.();
    await expect(result).resolves.toBe('played');
    vi.doUnmock('../../content/__generated__/audio-assets');
  });

  it('an asset that expo-asset cannot resolve is a missing clip, and the voice speaks', async () => {
    vi.resetModules();
    vi.doMock('../../content/__generated__/audio-assets', () => ({ AUDIO_ASSETS: { 'audio/jamo/giyeok.mp3': 7 } }));
    vi.doMock('expo-asset', () => ({
      Asset: {
        fromModule: () => {
          throw new Error('no asset');
        },
      },
    }));
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { mod, synth } = await load(true);
    await expect(mod.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' })).resolves.toBe('played');
    expect(synth.spoken.map((u) => u.text)).toEqual(['가']);
    vi.doUnmock('../../content/__generated__/audio-assets');
    vi.doUnmock('expo-asset');
  });
});

describe('platform/audio.web: hasVoiceFor (F-PLC-001 section 3.1 step 2)', () => {
  it('reads the voices of the asked language once the list is known', async () => {
    const { audio } = rig({ voices: [YUNA, SAMANTHA] });
    await flush();
    expect(audio.hasVoiceFor('ko-KR')).toBe(true);
    expect(audio.hasVoiceFor('en-US')).toBe(true);
    expect(audio.hasVoiceFor('es-US')).toBe(false);
    audio.dispose();
  });

  it('is false without speech synthesis', async () => {
    const { audio } = rig({ noSynth: true });
    await flush();
    expect(audio.hasVoiceFor('en-US')).toBe(false);
    audio.dispose();
  });
});
