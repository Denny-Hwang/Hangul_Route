import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSpeechSynthesis, FakeUtterance, type FakeVoice } from '../../../test-support/fake-speech-synthesis';
import {
  attachWebVoices,
  createCapabilityTracker,
  type CapabilityTracker,
  type NetworkLike,
} from '../capability';
import {
  createAudioController,
  type AudioController,
  type AudioTelemetryEvent,
  type ClipFailure,
  type ClipPlayer,
  type TtsEngine,
  type TtsHandlers,
  type TtsRequest,
} from '../controller';
import type { FallbackReason } from '../prompt-state';
import type { SpokenJamo } from '../spoken';
import type { VoiceCandidate } from '../voice-rank';

// ---------------------------------------------------------------------------
// Doubles
// ---------------------------------------------------------------------------

const YUNA: VoiceCandidate = { id: 'yuna', name: 'Yuna', lang: 'ko-KR', local: true, isDefault: true, quality: 'standard' };
const GOOGLE: VoiceCandidate = { id: 'google', name: 'Google 한국의', lang: 'ko-KR', local: false, isDefault: false, quality: 'standard' };
const SAMANTHA: VoiceCandidate = { id: 'sam', name: 'Samantha', lang: 'en-US', local: true, isDefault: true, quality: 'standard' };

type EngineStep = 'ok' | 'error' | 'interrupted' | 'never' | 'start-only';

/** A scriptable TtsEngine: each speak() consumes the next step (default 'ok'). */
class ScriptEngine implements TtsEngine {
  requests: TtsRequest[] = [];
  handlers: TtsHandlers[] = [];
  cancelled: TtsRequest[] = [];
  cancelAllCount = 0;
  busyFlag = false;
  script: EngineStep[] = [];

  speak(req: TtsRequest, h: TtsHandlers): { cancel(): void } {
    this.requests.push(req);
    this.handlers.push(h);
    const step = this.script.shift() ?? 'ok';
    if (step === 'ok') {
      queueMicrotask(() => {
        h.onStart();
        queueMicrotask(() => h.onEnd());
      });
    } else if (step === 'start-only') {
      queueMicrotask(() => h.onStart());
    } else if (step === 'error') {
      queueMicrotask(() => h.onError('error'));
    } else if (step === 'interrupted') {
      queueMicrotask(() => h.onError('interrupted'));
    }
    return { cancel: () => void this.cancelled.push(req) };
  }

  cancelAll(): void {
    this.cancelAllCount += 1;
  }

  busy(): boolean {
    return this.busyFlag;
  }
}

type ClipStep = 'ok' | ClipFailure | 'hang' | 'sync-decode';

class ScriptClips implements ClipPlayer {
  played: string[] = [];
  stops = 0;
  stopAllCount = 0;
  script: ClipStep[] = [];
  warmed: string[] = [];
  unlocked = 0;

  play(ref: string, h: { onStart(): void; onDone(): void; onError(reason: ClipFailure): void }): { stop(): void } {
    this.played.push(ref);
    const step = this.script.shift() ?? 'ok';
    if (step === 'ok') {
      queueMicrotask(() => {
        h.onStart();
        h.onDone();
      });
    } else if (step === 'sync-decode') {
      h.onError('decode');
    } else if (step !== 'hang') {
      queueMicrotask(() => h.onError(step));
    }
    return { stop: () => void (this.stops += 1) };
  }

  warm(refs: readonly string[]): Promise<void> {
    this.warmed.push(...refs);
    return Promise.resolve();
  }

  unlock(): void {
    this.unlocked += 1;
  }

  stopAll(): void {
    this.stopAllCount += 1;
  }
}

interface Rig {
  ctl: AudioController;
  engine: ScriptEngine;
  clips: ScriptClips;
  tracker: CapabilityTracker;
  events: AudioTelemetryEvent[];
  failures: FallbackReason[];
  state: { muted: boolean; level: 0 | 1 | 2 | null; clipsEnabled: boolean; assets: Set<string> };
}

function rig(opts: { voices?: VoiceCandidate[] | 'unknown'; engine?: boolean; clips?: boolean; keepInitial?: boolean } = {}): Rig {
  const engine = new ScriptEngine();
  const clips = new ScriptClips();
  const tracker = createCapabilityTracker({ online: true, clips: false });
  const v = opts.voices ?? [YUNA];
  if (v !== 'unknown') tracker.setVoices(v);
  const events: AudioTelemetryEvent[] = [];
  const failures: FallbackReason[] = [];
  const state: Rig['state'] = { muted: false, level: 1, clipsEnabled: true, assets: new Set(['audio/jamo/giyeok.mp3']) };
  const ctl = createAudioController({
    engine: opts.engine === false ? null : engine,
    clips: opts.clips === false ? null : clips,
    assets: { has: (ref) => state.assets.has(ref) },
    clipsEnabled: () => state.clipsEnabled,
    voices: tracker,
    isMuted: () => state.muted,
    levelOrder: () => state.level,
    platform: 'web',
    emit: (e) => events.push(e),
    reportFailure: (r) => failures.push(r),
  });
  if (opts.keepInitial !== true) events.length = 0;
  return { ctl, engine, clips, tracker, events, failures, state };
}

const names = (events: AudioTelemetryEvent[]): string[] => events.map((e) => e.name);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// ---------------------------------------------------------------------------
// Resolution order: clip > TTS > text
// ---------------------------------------------------------------------------

describe('controller: clip first (AD4)', () => {
  it('plays a bundled clip and never touches the engine', async () => {
    const r = rig();
    await expect(r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3', kind: 'sound' })).resolves.toBe('played');
    expect(r.clips.played).toEqual(['audio/jamo/giyeok.mp3']);
    expect(r.engine.requests).toEqual([]);
    expect(r.failures).toEqual([]);
  });

  it('a clip that fails to decode falls through to TTS and reports it', async () => {
    const r = rig();
    r.clips.script = ['decode'];
    await expect(r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3', kind: 'sound' })).resolves.toBe('played');
    expect(r.engine.requests.map((q) => q.text)).toEqual(['가']);
    expect(r.events).toEqual([{ name: 'audio.playback_failed', payload: { kind: 'clip', reason: 'decode' } }]);
  });

  it.each(['missing', 'fetch', 'blocked'] as const)('a clip failure of %s also falls through to TTS', async (reason) => {
    const r = rig();
    r.clips.script = [reason];
    await expect(r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' })).resolves.toBe('played');
    expect(r.events[0]).toEqual({ name: 'audio.playback_failed', payload: { kind: 'clip', reason } });
  });

  it('a ref that is not in the asset map is skipped silently (a ref may exist before its file)', async () => {
    const r = rig();
    await expect(r.ctl.playPrompt({ text: '나', audioRef: 'audio/jamo/nieun.mp3' })).resolves.toBe('played');
    expect(r.clips.played).toEqual([]);
    expect(r.engine.requests).toHaveLength(1);
    expect(r.events).toEqual([]);
  });

  it('flags.audioClips off skips the clip path', async () => {
    const r = rig();
    r.state.clipsEnabled = false;
    await r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' });
    expect(r.clips.played).toEqual([]);
    expect(r.engine.requests).toHaveLength(1);
  });

  it('no clip player (null) skips the clip path', async () => {
    const r = rig({ clips: false });
    await expect(r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' })).resolves.toBe('played');
    expect(r.engine.requests).toHaveLength(1);
  });

  it('a clip that fails with no usable voice is unavailable, and the engine is never called', async () => {
    const r = rig({ voices: [] });
    r.clips.script = ['decode'];
    await expect(r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' })).resolves.toBe('unavailable');
    expect(r.engine.requests).toEqual([]);
    expect(r.failures).toEqual(['no_voice']);
  });

  it('a clip plays even when there is no Korean voice at all', async () => {
    const r = rig({ voices: [] });
    await expect(r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' })).resolves.toBe('played');
    expect(r.engine.requests).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mute
// ---------------------------------------------------------------------------

describe('controller: muted', () => {
  it('returns muted without touching the engine or a clip, and records the failure', async () => {
    const r = rig();
    r.state.muted = true;
    await expect(r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' })).resolves.toBe('muted');
    expect(r.engine.requests).toEqual([]);
    expect(r.engine.cancelAllCount).toBe(0);
    expect(r.clips.played).toEqual([]);
    expect(r.failures).toEqual(['muted']);
  });
});

// ---------------------------------------------------------------------------
// TTS
// ---------------------------------------------------------------------------

describe('controller: TTS request', () => {
  it('speaks the ranked voice with rate from speechParams and pitch 1', async () => {
    const r = rig();
    await r.ctl.playPrompt({ text: '가', kind: 'sound' });
    expect(r.engine.requests).toEqual([{ text: '가', lang: 'ko-KR', rate: 0.75, pitch: 1, voice: YUNA }]);
  });

  it('the level reaches the rate through the controller, not the caller', async () => {
    const r = rig();
    r.state.level = 0;
    await r.ctl.playPrompt({ text: '고양이', kind: 'word' });
    expect(r.engine.requests[0]?.rate).toBeCloseTo(0.85 * 0.9, 10);
    r.state.level = null;
    await r.ctl.playPrompt({ text: '고양이', kind: 'word', slow: true });
    expect(r.engine.requests[1]?.rate).toBeCloseTo(0.85 * 0.7, 10);
  });

  it('defaults to Korean and the word kind', async () => {
    const r = rig();
    await r.ctl.playPrompt({ text: '고양이' });
    expect(r.engine.requests[0]).toMatchObject({ lang: 'ko-KR', rate: 0.85 });
  });

  it('speaks UI-language narration with no Korean-only voice requirement', async () => {
    const r = rig({ voices: [SAMANTHA] });
    await expect(r.ctl.playPrompt({ text: 'Hello', language: 'en-US', kind: 'narration' })).resolves.toBe('played');
    expect(r.engine.requests[0]).toMatchObject({ lang: 'en-US', voice: SAMANTHA, rate: 1 });
  });

  it('narration with no ranked voice for its language speaks with the engine default (voice null)', async () => {
    const r = rig({ voices: [YUNA] });
    await expect(r.ctl.playPrompt({ text: 'Hola', language: 'es-US', kind: 'narration' })).resolves.toBe('played');
    expect(r.engine.requests[0]?.voice).toBeNull();
  });

  it('no Korean voice: the engine is never called (an English voice must not read Hangul)', async () => {
    const r = rig({ voices: [SAMANTHA] });
    await expect(r.ctl.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(r.engine.requests).toEqual([]);
    expect(r.engine.cancelAllCount).toBe(0);
    expect(r.failures).toEqual(['no_voice']);
  });

  it('no speech engine at all is unavailable', async () => {
    const r = rig({ engine: false });
    await expect(r.ctl.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(r.failures).toEqual(['no_voice']);
  });

  it('while the capability is unknown the first call waits (bounded) and speaks once voices arrive', async () => {
    const r = rig({ voices: 'unknown' });
    const p = r.ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(500);
    expect(r.engine.requests).toEqual([]);
    r.tracker.setVoices([YUNA]);
    await expect(p).resolves.toBe('played');
    expect(r.engine.requests).toHaveLength(1);
  });

  it('an unknown capability that never resolves ends unavailable after 1.5 s without calling the engine', async () => {
    const r = rig({ voices: 'unknown' });
    const p = r.ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(1499);
    expect(r.failures).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe('unavailable');
    expect(r.engine.requests).toEqual([]);
    expect(r.failures).toEqual(['no_voice']);
  });
});

describe('controller: TTS outcomes', () => {
  it('no onstart and no onend within 1.5 s is unavailable/blocked and the dead utterance is cancelled', async () => {
    const r = rig();
    r.engine.script = ['never'];
    const p = r.ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(1499);
    expect(r.failures).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toBe('unavailable');
    expect(r.failures).toEqual(['blocked']);
    expect(r.engine.cancelled).toHaveLength(1);
    expect(r.events).toEqual([{ name: 'audio.playback_failed', payload: { kind: 'tts', reason: 'blocked' } }]);
  });

  it('started but no onend: played at 2000 + 400 * chars / rate ms, without cutting the audio', async () => {
    const r = rig();
    r.engine.script = ['start-only'];
    const p = r.ctl.playPrompt({ text: '가나', kind: 'sound' });
    const limit = 2000 + (400 * 2) / 0.75;
    await vi.advanceTimersByTimeAsync(Math.floor(limit) - 1);
    expect(r.failures).toEqual([]);
    let settled = false;
    void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(Math.ceil(limit) - Math.floor(limit) + 1);
    await expect(p).resolves.toBe('played');
    expect(r.engine.cancelled).toEqual([]);
    expect(r.events).toEqual([{ name: 'audio.playback_failed', payload: { kind: 'tts', reason: 'timeout' } }]);
  });

  it('onend before onstart still counts as played', async () => {
    const r = rig();
    r.engine.script = ['never'];
    const p = r.ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(0);
    r.engine.handlers[0]?.onEnd();
    await expect(p).resolves.toBe('played');
  });

  it('a duplicate onstart is ignored', async () => {
    const r = rig();
    r.engine.script = ['never'];
    const p = r.ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(0);
    r.engine.handlers[0]?.onStart();
    r.engine.handlers[0]?.onStart();
    r.engine.handlers[0]?.onEnd();
    await expect(p).resolves.toBe('played');
  });

  it('a canceled/interrupted error is not a failure: no retry, no failure record', async () => {
    const r = rig();
    r.engine.script = ['interrupted'];
    await expect(r.ctl.playPrompt({ text: '가' })).resolves.toBe('played');
    expect(r.engine.requests).toHaveLength(1);
    expect(r.failures).toEqual([]);
    expect(r.events).toEqual([]);
  });

  it('an error on a local voice is unavailable/error with no retry', async () => {
    const r = rig({ voices: [YUNA, { ...YUNA, id: 'other', name: 'Other', isDefault: false }] });
    r.engine.script = ['error'];
    await expect(r.ctl.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(r.engine.requests).toHaveLength(1);
    expect(r.failures).toEqual(['error']);
    expect(r.events).toEqual([{ name: 'audio.playback_failed', payload: { kind: 'tts', reason: 'engine' } }]);
  });

  it('an error on a network voice marks it failed and retries once with the next candidate', async () => {
    const r = rig({ voices: [GOOGLE, YUNA] });
    r.engine.script = ['error', 'ok'];
    // Yuna scores higher than the network voice, so make the network voice the best choice.
    r.tracker.setVoices([GOOGLE, { ...YUNA, name: 'Plain', local: null, isDefault: false }]);
    expect(r.tracker.ranked('ko-KR')[0]?.id).toBe('google');
    await expect(r.ctl.playPrompt({ text: '가' })).resolves.toBe('played');
    expect(r.engine.requests.map((q) => q.voice?.id)).toEqual(['google', 'yuna']);
    expect(r.tracker.ranked('ko-KR').map((v) => v.id)).toEqual(['yuna']);
    expect(r.failures).toEqual([]);
  });

  it('a second error after the one retry is unavailable/error', async () => {
    const r = rig();
    r.tracker.setVoices([GOOGLE, { ...YUNA, name: 'Plain', local: null, isDefault: false }, { ...YUNA, id: 'third', name: 'Third', local: null, isDefault: false }]);
    r.engine.script = ['error', 'error'];
    await expect(r.ctl.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(r.engine.requests).toHaveLength(2);
    expect(r.failures).toEqual(['error']);
  });

  it('a network voice that fails with no next candidate is unavailable and leaves no Korean voice', async () => {
    const r = rig({ voices: [GOOGLE] });
    r.engine.script = ['error'];
    await expect(r.ctl.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(r.engine.requests).toHaveLength(1);
    expect(r.tracker.get().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });
    await expect(r.ctl.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(r.engine.requests).toHaveLength(1);
  });

  it('a voice-less narration error is unavailable without a retry', async () => {
    const r = rig({ voices: [YUNA] });
    r.engine.script = ['error'];
    await expect(r.ctl.playPrompt({ text: 'Hola', language: 'es-US', kind: 'narration' })).resolves.toBe('unavailable');
    expect(r.engine.requests).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Supersede and stop
// ---------------------------------------------------------------------------

describe('controller: supersede', () => {
  it('a newer call resolves the older one as played, stops the engine, and starts after 50 ms', async () => {
    const r = rig();
    r.engine.script = ['start-only', 'ok'];
    const first = r.ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(0);
    expect(r.engine.requests).toHaveLength(1);

    const second = r.ctl.playPrompt({ text: '나' });
    await expect(first).resolves.toBe('played');
    expect(r.engine.cancelAllCount).toBe(1);
    expect(r.engine.cancelled).toHaveLength(1);
    expect(r.engine.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(49);
    expect(r.engine.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(r.engine.requests.map((q) => q.text)).toEqual(['가', '나']);
    await expect(second).resolves.toBe('played');
    expect(r.failures).toEqual([]);
  });

  it('defers 50 ms when the engine reports a busy queue even with no earlier call', async () => {
    const r = rig();
    r.engine.busyFlag = true;
    const p = r.ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(49);
    expect(r.engine.requests).toEqual([]);
    expect(r.engine.cancelAllCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(r.engine.requests).toHaveLength(1);
    await expect(p).resolves.toBe('played');
  });

  it('an idle engine is started at once, with no cancel and no delay', async () => {
    const r = rig();
    const p = r.ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(0);
    expect(r.engine.requests).toHaveLength(1);
    expect(r.engine.cancelAllCount).toBe(0);
    await p;
  });

  it('a call superseded during the 50 ms wait never reaches the engine and resolves played', async () => {
    const r = rig();
    r.engine.busyFlag = true;
    const a = r.ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(10);
    const b = r.ctl.playPrompt({ text: '나' });
    await expect(a).resolves.toBe('played');
    await vi.advanceTimersByTimeAsync(50);
    await expect(b).resolves.toBe('played');
    expect(r.engine.requests.map((q) => q.text)).toEqual(['나']);
  });

  it('a call superseded while waiting for the capability resolves played and never speaks', async () => {
    const r = rig({ voices: 'unknown' });
    const a = r.ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(100);
    const b = r.ctl.playPrompt({ text: '나' });
    await expect(a).resolves.toBe('played');
    r.tracker.setVoices([YUNA]);
    await vi.advanceTimersByTimeAsync(50);
    await expect(b).resolves.toBe('played');
    expect(r.engine.requests.map((q) => q.text)).toEqual(['나']);
  });

  it('a call superseded between two awaits never reaches the engine and resolves played', async () => {
    const r = rig();
    r.clips.script = ['sync-decode']; // settles before the second call arrives, so only the ticket flag can stop it
    const a = r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' });
    const b = r.ctl.playPrompt({ text: '나' });
    await expect(a).resolves.toBe('played');
    await vi.advanceTimersByTimeAsync(50);
    await expect(b).resolves.toBe('played');
    expect(r.engine.requests.map((q) => q.text)).toEqual(['나']);
  });

  it('a newer call stops a running clip', async () => {
    const r = rig();
    r.clips.script = ['hang'];
    const a = r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' });
    await vi.advanceTimersByTimeAsync(0);
    const b = r.ctl.playPrompt({ text: '나' });
    await expect(a).resolves.toBe('played');
    expect(r.clips.stops).toBe(1);
    expect(r.clips.stopAllCount).toBe(1);
    await vi.advanceTimersByTimeAsync(50);
    await expect(b).resolves.toBe('played');
  });

  it('stop() resolves the running prompt as played and stops the engine and the clips', async () => {
    const r = rig();
    r.engine.script = ['start-only'];
    const p = r.ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(0);
    r.ctl.stop();
    await expect(p).resolves.toBe('played');
    expect(r.engine.cancelled).toHaveLength(1);
    expect(r.engine.cancelAllCount).toBe(1);
    expect(r.clips.stopAllCount).toBe(1);
    expect(r.failures).toEqual([]);
  });

  it('stop() with nothing running is harmless, and with no engine or clips too', () => {
    const r = rig({ engine: false, clips: false });
    expect(() => r.ctl.stop()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// playJamo
// ---------------------------------------------------------------------------

describe('controller: playJamo', () => {
  const giyeok: SpokenJamo = {
    char: 'ㄱ',
    romanization: 'g/k',
    nameEn: 'giyeok',
    spokenKo: '가',
    spokenRomanization: 'ga',
    spokenKind: 'sound',
    nameKo: '기역',
    audioRef: 'audio/jamo/giyeok.mp3',
  };

  it('sound mode speaks the carrier syllable, never the name', async () => {
    const r = rig();
    r.state.assets.clear();
    await r.ctl.playJamo(giyeok);
    expect(r.engine.requests[0]).toMatchObject({ text: '가', rate: 0.75 });
  });

  it('name mode speaks nameKo', async () => {
    const r = rig();
    await r.ctl.playJamo(giyeok, 'name');
    expect(r.engine.requests[0]).toMatchObject({ text: '기역', rate: 0.75 });
  });

  it('passes the clip ref so a recording wins when it is bundled', async () => {
    const r = rig();
    await r.ctl.playJamo(giyeok, 'sound');
    expect(r.clips.played).toEqual(['audio/jamo/giyeok.mp3']);
    expect(r.engine.requests).toEqual([]);
  });

  it('a jamo with no spoken fields falls back to char', async () => {
    const r = rig();
    await r.ctl.playJamo({ char: 'ㄴ', romanization: 'n', nameEn: 'nieun', spokenKind: 'sound' });
    expect(r.engine.requests[0]?.text).toBe('ㄴ');
  });
});

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

describe('controller: telemetry', () => {
  it('audio.capability_checked fires when the capability first leaves unknown, and again only when the class changes', () => {
    const r = rig({ voices: 'unknown' });
    expect(r.events).toEqual([]);
    r.tracker.setVoices([YUNA]);
    expect(r.events).toEqual([{ name: 'audio.capability_checked', payload: { platform: 'web', engine: 'tts', koVoice: 'local' } }]);
    r.tracker.setVoices([YUNA, SAMANTHA]); // same class
    r.tracker.setUnlocked(true); // same class
    expect(r.events).toHaveLength(1);
    r.tracker.setVoices([]);
    expect(r.events[1]).toEqual({
      name: 'audio.capability_checked',
      payload: { platform: 'web', engine: 'none', koVoice: 'none', reason: 'no_korean_voice' },
    });
  });

  it('reports the capability that is already known when the controller is created', () => {
    const r = rig({ voices: [YUNA], keepInitial: true });
    expect(names(r.events)).toEqual(['audio.capability_checked']);
  });

  it('dispose() stops observing the capability', () => {
    const r = rig({ voices: 'unknown' });
    r.ctl.dispose();
    r.tracker.setVoices([YUNA]);
    expect(r.events).toEqual([]);
  });

  it('audio.fallback_shown fires once per (source, reason)', () => {
    const r = rig();
    r.events.length = 0;
    r.ctl.noteFallbackShown('match-sound', 'no_voice');
    r.ctl.noteFallbackShown('match-sound', 'no_voice');
    r.ctl.noteFallbackShown('match-sound', 'muted');
    r.ctl.noteFallbackShown('discover', 'no_voice');
    expect(r.events).toEqual([
      { name: 'audio.fallback_shown', payload: { source: 'match-sound', reason: 'no_voice' } },
      { name: 'audio.fallback_shown', payload: { source: 'match-sound', reason: 'muted' } },
      { name: 'audio.fallback_shown', payload: { source: 'discover', reason: 'no_voice' } },
    ]);
  });

  it('audio.playback_failed is capped at 3 per session', async () => {
    const r = rig();
    r.events.length = 0;
    for (let i = 0; i < 5; i++) {
      r.clips.script = ['decode'];
      await r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' });
    }
    expect(r.events.filter((e) => e.name === 'audio.playback_failed')).toHaveLength(3);
  });

  it('never puts text, voice names or ids in a payload', async () => {
    const r = rig();
    r.clips.script = ['fetch'];
    await r.ctl.playPrompt({ text: '가', audioRef: 'audio/jamo/giyeok.mp3' });
    r.ctl.noteFallbackShown('trace', 'error');
    const json = JSON.stringify(r.events);
    expect(json).not.toContain('Yuna');
    expect(json).not.toContain('가');
    expect(json).not.toContain('giyeok');
  });
});

// ---------------------------------------------------------------------------
// Integration with the fake browser engine
// ---------------------------------------------------------------------------

const MAC_YUNA: FakeVoice = { name: 'Yuna', lang: 'ko_KR', voiceURI: 'com.apple.voice.compact.ko-KR.Yuna', localService: true, default: true };
const MAC_EDDY: FakeVoice = { name: 'Eddy (한국어(한국))', lang: 'ko_KR', voiceURI: 'eddy', localService: true, default: false };

/** The adapter A-4a writes in `audio.web.ts`, reduced to what these tests need. */
function webEngine(synth: FakeSpeechSynthesis): TtsEngine {
  return {
    speak(req, h) {
      const u = new FakeUtterance(req.text);
      u.lang = req.lang;
      u.rate = req.rate;
      u.pitch = req.pitch;
      u.voice = synth.getVoices().find((v) => v.voiceURI === req.voice?.id) ?? null;
      u.onstart = () => h.onStart();
      u.onend = () => h.onEnd();
      u.onerror = (ev) => h.onError(ev.error === 'canceled' || ev.error === 'interrupted' ? 'interrupted' : 'error');
      synth.speak(u);
      return { cancel: () => synth.cancel() };
    },
    cancelAll: () => synth.cancel(),
    busy: () => synth.speaking || synth.pending,
  };
}

describe('controller with FakeSpeechSynthesis', () => {
  function web(opts: { requireGesture?: boolean } = {}) {
    const synth = new FakeSpeechSynthesis();
    synth.setVoices([MAC_EDDY, MAC_YUNA]);
    synth.requireGesture = opts.requireGesture === true;
    const tracker = createCapabilityTracker({ online: true, clips: false });
    const network: NetworkLike = { isOnline: () => true, subscribe: () => () => undefined };
    attachWebVoices(tracker, synth, network, { timeoutMs: 1500 });
    const failures: FallbackReason[] = [];
    const ctl = createAudioController({
      engine: webEngine(synth),
      clips: null,
      assets: { has: () => false },
      clipsEnabled: () => true,
      voices: tracker,
      isMuted: () => false,
      levelOrder: () => 1,
      platform: 'web',
      emit: () => undefined,
      reportFailure: (r) => failures.push(r),
    });
    return { synth, ctl, failures, tracker };
  }

  it('speaks 가 with Yuna (never a novelty voice) at rate 0.75 and pitch 1', async () => {
    const { synth, ctl } = web();
    await vi.advanceTimersByTimeAsync(0);
    await expect(ctl.playPrompt({ text: '가', kind: 'sound' })).resolves.toBe('played');
    const u = synth.spoken[0];
    expect(u?.voice?.name).toBe('Yuna');
    expect(u?.text).toBe('가');
    expect(u?.rate).toBe(0.75);
    expect(u?.pitch).toBe(1);
    expect(u?.lang).toBe('ko-KR');
  });

  it('a second prompt cancels the first (the cancel error is not a failure) and speaks after 50 ms', async () => {
    const { synth, ctl, failures } = web();
    await vi.advanceTimersByTimeAsync(0);
    synth.autoEnd = false;
    const a = ctl.playPrompt({ text: '가', kind: 'sound' });
    await vi.advanceTimersByTimeAsync(0);
    const b = ctl.playPrompt({ text: '나', kind: 'sound' });
    await expect(a).resolves.toBe('played');
    synth.autoEnd = true;
    await vi.advanceTimersByTimeAsync(50);
    await expect(b).resolves.toBe('played');
    expect(synth.spoken.map((u) => u.text)).toEqual(['가', '나']);
    expect(failures).toEqual([]);
  });

  it('outside a gesture (iOS) the dropped utterance is unavailable/blocked after 1.5 s, then a gesture lets the next play work', async () => {
    const { synth, ctl, failures } = web({ requireGesture: true });
    await vi.advanceTimersByTimeAsync(0);
    const p = ctl.playPrompt({ text: '가', kind: 'sound' });
    await vi.advanceTimersByTimeAsync(1500);
    await expect(p).resolves.toBe('unavailable');
    expect(failures).toEqual(['blocked']);
    synth.markUserGesture();
    await expect(ctl.playPrompt({ text: '가', kind: 'sound' })).resolves.toBe('played');
  });

  it('an engine mute (neverStart) is blocked as well', async () => {
    const { synth, ctl, failures } = web();
    await vi.advanceTimersByTimeAsync(0);
    synth.neverStart = true;
    const p = ctl.playPrompt({ text: '가' });
    await vi.advanceTimersByTimeAsync(1500);
    await expect(p).resolves.toBe('unavailable');
    expect(failures).toEqual(['blocked']);
  });

  it('only the novelty voices installed: the engine is never called', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.setVoices([MAC_EDDY]);
    const tracker = createCapabilityTracker({ online: true, clips: false });
    attachWebVoices(tracker, synth, { isOnline: () => true, subscribe: () => () => undefined }, { timeoutMs: 1500 });
    await vi.advanceTimersByTimeAsync(0);
    const ctl = createAudioController({
      engine: webEngine(synth),
      clips: null,
      assets: { has: () => false },
      clipsEnabled: () => true,
      voices: tracker,
      isMuted: () => false,
      levelOrder: () => 1,
      platform: 'web',
      emit: () => undefined,
      reportFailure: () => undefined,
    });
    await expect(ctl.playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(synth.spoken).toEqual([]);
  });
});
