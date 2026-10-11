import type { SpeechLang } from '@hangul-route/content-schema';
import { effectiveQuality, rankVoices, type VoiceCandidate, type VoiceQuality } from './voice-rank';

/**
 * What this device can say, and whether we know yet (F-AUDIO-004 §3.4).
 *
 * Pure logic over injected engines: nothing here imports `expo-speech` or
 * touches `window`. The platform adapters (A-4a) pass a browser
 * `speechSynthesis`-shaped object or a function that reads
 * `Speech.getAvailableVoicesAsync()`, plus a network source, and read the
 * result through the tracker.
 */
export type KoVoiceStatus =
  | { state: 'unknown' }
  | { state: 'ready'; voiceId: string; voiceName: string; local: boolean; quality: VoiceQuality }
  | { state: 'none'; reason: 'no_engine' | 'no_korean_voice' | 'offline_network_only' };

export interface AudioCapability {
  tts: KoVoiceStatus;
  /** Any bundled clip exists. */
  clips: boolean;
  /** The first-gesture unlock has run (web). */
  unlocked: boolean;
}

export const UNKNOWN_CAPABILITY: AudioCapability = { tts: { state: 'unknown' }, clips: false, unlocked: false };

export function canPlayKorean(cap: AudioCapability): boolean {
  return cap.tts.state === 'ready' || cap.clips;
}

/** For the "Check this device" row. Never sent to telemetry. */
export function describeKoVoice(status: KoVoiceStatus): { voiceName: string; local: boolean; quality: VoiceQuality } | null {
  if (status.state !== 'ready') return null;
  return { voiceName: status.voiceName, local: status.local, quality: status.quality };
}

export function deriveKoVoiceStatus(voices: readonly VoiceCandidate[], ctx: { online: boolean }): KoVoiceStatus {
  const best = rankVoices(voices, 'ko-KR', ctx)[0];
  if (best) {
    return { state: 'ready', voiceId: best.id, voiceName: best.name, local: best.local === true, quality: effectiveQuality(best) };
  }
  if (!ctx.online && rankVoices(voices, 'ko-KR', { online: true }).length > 0) {
    return { state: 'none', reason: 'offline_network_only' };
  }
  return { state: 'none', reason: 'no_korean_voice' };
}

// ---------------------------------------------------------------------------
// Engine voice shapes and mappers
// ---------------------------------------------------------------------------

/** The subset of a browser `SpeechSynthesisVoice` we read. */
export interface WebVoiceLike {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  default: boolean;
}

/** The subset of `expo-speech`'s `Voice` we read. */
export interface NativeVoiceLike {
  identifier: string;
  name: string;
  language: string;
  quality: string;
}

export type CapabilityPlatform = 'ios' | 'android' | 'web';

export function webVoiceToCandidate(v: WebVoiceLike): VoiceCandidate {
  const candidate: VoiceCandidate = {
    id: v.voiceURI === '' ? v.name : v.voiceURI,
    name: v.name,
    lang: v.lang,
    local: v.localService,
    isDefault: v.default,
    quality: 'standard',
  };
  return { ...candidate, quality: effectiveQuality(candidate) };
}

export function nativeVoiceToCandidate(v: NativeVoiceLike, platform: 'ios' | 'android'): VoiceCandidate {
  let local: boolean | null = true;
  if (platform === 'android') {
    const lower = v.name.toLowerCase();
    if (lower.includes('network')) local = false;
    else if (lower.includes('local')) local = true;
    else local = null;
  }
  const candidate: VoiceCandidate = {
    id: v.identifier,
    name: v.name,
    lang: v.language,
    local,
    isDefault: false,
    quality: v.quality === 'Enhanced' ? 'enhanced' : 'standard',
  };
  return { ...candidate, quality: effectiveQuality(candidate) };
}

// ---------------------------------------------------------------------------
// Web: wait for the voice list
// ---------------------------------------------------------------------------

/** The subset of `speechSynthesis` the capability code needs. */
export interface WebSpeechEngineLike {
  getVoices(): readonly WebVoiceLike[];
  addEventListener(type: 'voiceschanged', listener: () => void): void;
  removeEventListener(type: 'voiceschanged', listener: () => void): void;
}

/**
 * Resolve at once if the list is non-empty; otherwise wait for `voiceschanged`
 * or the timeout and read again (Chrome returns `[]` until the list loads).
 */
export function whenVoicesReady(
  engine: WebSpeechEngineLike,
  opts: { timeoutMs: number },
): Promise<readonly WebVoiceLike[]> {
  const now = engine.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (done) return;
      done = true;
      if (timer !== undefined) clearTimeout(timer);
      engine.removeEventListener('voiceschanged', finish);
      resolve(engine.getVoices());
    };
    engine.addEventListener('voiceschanged', finish);
    timer = setTimeout(finish, opts.timeoutMs);
  });
}

// ---------------------------------------------------------------------------
// Tracker: the one place the current capability lives
// ---------------------------------------------------------------------------

export interface NetworkLike {
  isOnline(): boolean;
  subscribe(fn: (online: boolean) => void): () => void;
}

export interface CapabilityTracker {
  get(): AudioCapability;
  /** Eligible voices for a language, best first, failed voices removed. */
  ranked(lang: SpeechLang): VoiceCandidate[];
  /** Resolves when the Korean status is known, or after `timeoutMs`, whichever is first. */
  whenReady(timeoutMs: number): Promise<void>;
  subscribe(fn: (c: AudioCapability) => void): () => void;
  /** `'no_engine'` means the platform has no speech engine at all. */
  setVoices(voices: readonly VoiceCandidate[] | 'no_engine'): void;
  setOnline(online: boolean): void;
  setClips(has: boolean): void;
  setUnlocked(unlocked: boolean): void;
  /** A voice that errored this session (a network voice that failed): never ranked again. */
  markFailed(id: string): void;
}

export function createCapabilityTracker(init: { online: boolean; clips: boolean }): CapabilityTracker {
  let voices: readonly VoiceCandidate[] | null = null;
  let engineMissing = false;
  let online = init.online;
  let clips = init.clips;
  let unlocked = false;
  const failed = new Set<string>();
  const listeners = new Set<(c: AudioCapability) => void>();

  const usable = (): VoiceCandidate[] => (engineMissing ? [] : (voices ?? []).filter((v) => !failed.has(v.id)));

  const compute = (): AudioCapability => {
    let tts: KoVoiceStatus;
    if (engineMissing) tts = { state: 'none', reason: 'no_engine' };
    else if (voices === null) tts = { state: 'unknown' };
    else tts = deriveKoVoiceStatus(usable(), { online });
    return { tts, clips, unlocked };
  };

  let current = compute();
  let currentKey = JSON.stringify(current);

  const refresh = (): void => {
    const next = compute();
    const key = JSON.stringify(next);
    if (key === currentKey) return;
    current = next;
    currentKey = key;
    for (const fn of [...listeners]) fn(next);
  };

  const subscribe = (fn: (c: AudioCapability) => void): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  };

  return {
    get: () => current,
    ranked: (lang) => rankVoices(usable(), lang, { online }),
    whenReady: (timeoutMs) => {
      if (current.tts.state !== 'unknown') return Promise.resolve();
      return new Promise<void>((resolve) => {
        let off: () => void = () => undefined;
        const timer = setTimeout(() => {
          off();
          resolve();
        }, timeoutMs);
        off = subscribe((c) => {
          if (c.tts.state === 'unknown') return;
          clearTimeout(timer);
          off();
          resolve();
        });
      });
    },
    subscribe,
    setVoices: (next) => {
      if (next === 'no_engine') {
        engineMissing = true;
      } else {
        engineMissing = false;
        voices = next;
      }
      refresh();
    },
    setOnline: (value) => {
      online = value;
      refresh();
    },
    setClips: (value) => {
      clips = value;
      refresh();
    },
    setUnlocked: (value) => {
      unlocked = value;
      refresh();
    },
    markFailed: (id) => {
      failed.add(id);
      refresh();
    },
  };
}

/**
 * Feed the tracker from a browser engine. The `voiceschanged` listener stays
 * registered so late voices (Chrome) and installed voice packs re-rank; the
 * network source re-runs the ranking on `online` / `offline`. Returns detach.
 */
export function attachWebVoices(
  tracker: CapabilityTracker,
  engine: WebSpeechEngineLike | null,
  network: NetworkLike,
  opts: { timeoutMs: number },
): () => void {
  if (engine === null) {
    tracker.setVoices('no_engine');
    return () => undefined;
  }
  let active = true;
  const apply = (): void => {
    if (active) tracker.setVoices(engine.getVoices().map(webVoiceToCandidate));
  };
  tracker.setOnline(network.isOnline());
  engine.addEventListener('voiceschanged', apply);
  const offNetwork = network.subscribe((online) => {
    if (active) tracker.setOnline(online);
  });
  void whenVoicesReady(engine, opts).then(apply);
  return () => {
    active = false;
    engine.removeEventListener('voiceschanged', apply);
    offNetwork();
  };
}

// ---------------------------------------------------------------------------
// Native: lazy engine, so retry an empty list
// ---------------------------------------------------------------------------

/** Android returns `[]` until its lazy TTS engine is initialised (`SpeechModule.kt:44-48`). */
const NATIVE_RETRY_GAPS_MS: readonly number[] = [500, 1000]; // reads at 0, 500 and 1500 ms

export type NativeVoicesResult = { kind: 'voices'; voices: VoiceCandidate[] } | { kind: 'no_engine' };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function readNativeVoices(
  read: () => Promise<readonly NativeVoiceLike[]>,
  platform: 'ios' | 'android',
): Promise<NativeVoicesResult> {
  for (let attempt = 0; attempt <= NATIVE_RETRY_GAPS_MS.length; attempt++) {
    let list: readonly NativeVoiceLike[];
    try {
      list = await read();
    } catch {
      return { kind: 'no_engine' };
    }
    if (list.length > 0) return { kind: 'voices', voices: list.map((v) => nativeVoiceToCandidate(v, platform)) };
    const gap = NATIVE_RETRY_GAPS_MS[attempt];
    if (gap !== undefined) await sleep(gap);
  }
  return { kind: 'voices', voices: [] };
}

export function attachNativeVoices(
  tracker: CapabilityTracker,
  read: () => Promise<readonly NativeVoiceLike[]>,
  platform: 'ios' | 'android',
  network: NetworkLike,
): () => void {
  let active = true;
  tracker.setOnline(network.isOnline());
  const offNetwork = network.subscribe((online) => {
    if (active) tracker.setOnline(online);
  });
  void readNativeVoices(read, platform).then((result) => {
    if (active) tracker.setVoices(result.kind === 'voices' ? result.voices : 'no_engine');
  });
  return () => {
    active = false;
    offNetwork();
  };
}

// ---------------------------------------------------------------------------
// Telemetry payload (audio.capability_checked, §3.14)
// ---------------------------------------------------------------------------

export interface CapabilityCheckedPayload {
  platform: CapabilityPlatform;
  engine: 'clips+tts' | 'tts' | 'clips' | 'none';
  koVoice: 'none' | 'network' | 'local' | 'enhanced' | 'premium';
  reason?: 'no_engine' | 'no_korean_voice' | 'offline_network_only';
}

/** `null` while the state is still unknown. Carries classes only: no voice names, no text. */
export function capabilityTelemetry(cap: AudioCapability, platform: CapabilityPlatform): CapabilityCheckedPayload | null {
  const tts = cap.tts;
  if (tts.state === 'unknown') return null;
  if (tts.state === 'none') {
    return { platform, engine: cap.clips ? 'clips' : 'none', koVoice: 'none', reason: tts.reason };
  }
  let koVoice: CapabilityCheckedPayload['koVoice'] = tts.local ? 'local' : 'network';
  if (tts.quality === 'premium') koVoice = 'premium';
  else if (tts.quality === 'enhanced') koVoice = 'enhanced';
  return { platform, engine: cap.clips ? 'clips+tts' : 'tts', koVoice };
}
