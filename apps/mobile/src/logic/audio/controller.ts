import type { SpeechLang } from '@hangul-route/content-schema';
import { capabilityTelemetry, type AudioCapability, type CapabilityCheckedPayload, type CapabilityPlatform } from './capability';
import type { FallbackReason, PlayResult } from './prompt-state';
import { speechParams, type LevelOrder, type PromptKind } from './rate';
import { spokenFor, type SpokenJamo } from './spoken';
import type { VoiceCandidate } from './voice-rank';

export type { PlayResult } from './prompt-state';

/**
 * The one place that decides what a prompt does (F-AUDIO-004 §3.5).
 *
 * Resolution order is clip > TTS > visible text (AD4): a bundled recording
 * wins, a clip that fails falls through to the device voice, and with no
 * usable Korean voice the controller never calls the engine and reports
 * `unavailable` so the screen shows the text prompt. Pure logic: the speech
 * engine, the clip player, the asset map, the clock and telemetry are all
 * arguments, so `platform/audio*.ts` stay thin adapters.
 */
export type { PromptKind } from './rate';

export interface PlaySpec {
  /** What to say if there is no clip: `item.spokenKo ?? item.ko`. */
  text: string;
  /** `AudioRefSchema` path; wins when a bundled clip exists. */
  audioRef?: string;
  /** Default `'ko-KR'`. */
  language?: SpeechLang;
  /** Default `'word'`; drives the rate. */
  kind?: PromptKind;
  slow?: boolean;
  /** Surface id for telemetry: 'match-sound' | 'discover' | 'trace' | ... */
  source?: string;
}

// --- Injected engines -------------------------------------------------------

export interface TtsRequest {
  text: string;
  lang: SpeechLang;
  rate: number;
  pitch: 1;
  /** The ranked voice; `null` lets the engine pick (non-Korean narration only). */
  voice: VoiceCandidate | null;
}

export interface TtsHandlers {
  onStart(): void;
  onEnd(): void;
  /** `'interrupted'` = canceled/interrupted/stopped (not a failure); `'error'` = a real engine error. */
  onError(kind: 'interrupted' | 'error'): void;
}

export interface TtsEngine {
  speak(req: TtsRequest, handlers: TtsHandlers): { cancel(): void };
  /** Stop everything running or queued. */
  cancelAll(): void;
  /** `speaking || pending`. */
  busy(): boolean;
}

export type ClipFailure = 'missing' | 'fetch' | 'decode' | 'blocked';

/** Settles through exactly one of `onDone` / `onError` (platform contract, §3.10). */
export interface ClipPlayer {
  play(
    ref: string,
    h: { onStart(): void; onDone(): void; onError(reason: ClipFailure): void },
  ): { stop(): void };
  warm(refs: readonly string[]): Promise<void>;
  unlock(): void;
  stopAll(): void;
}

/** A `CapabilityTracker` satisfies this. */
export interface VoiceSource {
  get(): AudioCapability;
  ranked(lang: SpeechLang): VoiceCandidate[];
  whenReady(timeoutMs: number): Promise<void>;
  markFailed(id: string): void;
  subscribe(fn: (c: AudioCapability) => void): () => void;
}

export interface Clock {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** Reads the global timers at call time, so fake timers installed later take effect. */
export const systemClock: Clock = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

// --- Telemetry (§3.14); `audio.mute_changed` belongs to the store ------------

export type AudioTelemetryEvent =
  | { name: 'audio.capability_checked'; payload: CapabilityCheckedPayload }
  | { name: 'audio.fallback_shown'; payload: { source: string; reason: FallbackReason } }
  | {
      name: 'audio.playback_failed';
      payload: { kind: 'clip' | 'tts'; reason: 'missing' | 'fetch' | 'decode' | 'blocked' | 'timeout' | 'engine' };
    };

export interface ControllerDeps {
  /** `null` = the platform has no speech engine. */
  engine: TtsEngine | null;
  /** `null` = no clip player (clips not wired yet). */
  clips: ClipPlayer | null;
  /** The bundled asset map: `has(ref)`. */
  assets: { has(ref: string): boolean };
  /** `flags.audioClips`. */
  clipsEnabled(): boolean;
  voices: VoiceSource;
  isMuted(): boolean;
  levelOrder(): LevelOrder;
  platform: CapabilityPlatform;
  emit(event: AudioTelemetryEvent): void;
  /** Stored as `audio-store.lastFailure` for every `unavailable` / `muted` result. */
  reportFailure(reason: FallbackReason): void;
  clock?: Clock;
}

export interface AudioController {
  playPrompt(spec: PlaySpec): Promise<PlayResult>;
  playJamo(jamo: SpokenJamo, mode?: 'sound' | 'name'): Promise<PlayResult>;
  stop(): void;
  /** Called by the fallback panel when it first shows; fires `audio.fallback_shown` once per (source, reason). */
  noteFallbackShown(source: string, reason: FallbackReason): void;
  dispose(): void;
}

// --- Timing constants (§3.4, §3.5) ------------------------------------------

const CAPABILITY_WAIT_MS = 1500;
const START_TIMEOUT_MS = 1500;
const DEFER_MS = 50;
const SAFETY_BASE_MS = 2000;
const SAFETY_PER_CHAR_MS = 400;
const MAX_FAILURE_EVENTS = 3;

const SUPERSEDED = Symbol('superseded');
type Superseded = typeof SUPERSEDED;

interface Ticket {
  superseded: boolean;
  hooks: Set<() => void>;
}

type UtteranceOutcome = 'ended' | 'timeout' | 'blocked' | 'error' | 'interrupted';

export function createAudioController(deps: ControllerDeps): AudioController {
  const clock = deps.clock ?? systemClock;
  let current: Ticket | null = null;
  let failureEvents = 0;
  let lastCapabilityKey: string | null = null;
  const shown = new Set<string>();

  // --- telemetry -------------------------------------------------------------

  const noteFailure = (kind: 'clip' | 'tts', reason: 'missing' | 'fetch' | 'decode' | 'blocked' | 'timeout' | 'engine'): void => {
    if (failureEvents >= MAX_FAILURE_EVENTS) return;
    failureEvents += 1;
    deps.emit({ name: 'audio.playback_failed', payload: { kind, reason } });
  };

  const observe = (cap: AudioCapability): void => {
    const payload = capabilityTelemetry(cap, deps.platform);
    if (payload === null) return;
    const key = JSON.stringify(payload);
    if (key === lastCapabilityKey) return;
    lastCapabilityKey = key;
    deps.emit({ name: 'audio.capability_checked', payload });
  };

  const stopObserving = deps.voices.subscribe(observe);
  observe(deps.voices.get());

  // --- supersede machinery -----------------------------------------------------

  const supersede = (t: Ticket): void => {
    t.superseded = true;
    for (const hook of [...t.hooks]) hook();
  };

  /**
   * Await something that a newer call can cancel. `register` starts the work
   * and returns its cleanup; a supersede runs the cleanup and settles with
   * SUPERSEDED. After settling, late callbacks from the work are ignored.
   */
  const waitFor = <T>(t: Ticket, register: (resolve: (v: T) => void) => () => void): Promise<T | Superseded> => {
    if (t.superseded) return Promise.resolve(SUPERSEDED);
    return new Promise((resolve) => {
      let settled = false;
      let cleanup: (() => void) | null = null;
      // A hook is removed from the set when the work settles, so it only ever runs unsettled.
      const hook = (): void => {
        settled = true;
        if (cleanup) cleanup();
        resolve(SUPERSEDED);
      };
      t.hooks.add(hook);
      cleanup = register((value) => {
        if (settled) return;
        settled = true;
        t.hooks.delete(hook);
        resolve(value);
      });
    });
  };

  const fail = (result: 'muted' | 'unavailable', reason: FallbackReason): PlayResult => {
    deps.reportFailure(reason);
    return result;
  };

  // --- clip ------------------------------------------------------------------

  const tryClip = async (t: Ticket, spec: PlaySpec): Promise<'played' | 'skipped' | Superseded> => {
    const ref = spec.audioRef;
    const clips = deps.clips;
    if (ref === undefined || clips === null || !deps.clipsEnabled() || !deps.assets.has(ref)) return 'skipped';
    const outcome = await waitFor<'ok' | ClipFailure>(t, (resolve) => {
      const handle = clips.play(ref, {
        onStart: () => undefined,
        onDone: () => resolve('ok'),
        onError: (reason) => resolve(reason),
      });
      return () => handle.stop();
    });
    if (outcome === SUPERSEDED) return SUPERSEDED;
    if (outcome === 'ok') return 'played';
    noteFailure('clip', outcome);
    return 'skipped';
  };

  // --- tts -------------------------------------------------------------------

  const runUtterance = (t: Ticket, engine: TtsEngine, req: TtsRequest): Promise<UtteranceOutcome | Superseded> =>
    waitFor<UtteranceOutcome>(t, (resolve) => {
      let started = false;
      let startTimer: unknown;
      let safetyTimer: unknown;
      let handle: { cancel(): void } | undefined;
      const clear = (): void => {
        clock.clearTimeout(startTimer);
        clock.clearTimeout(safetyTimer);
      };
      const settle = (outcome: UtteranceOutcome): void => {
        clear();
        resolve(outcome);
      };
      startTimer = clock.setTimeout(() => {
        settle('blocked');
        handle?.cancel();
      }, START_TIMEOUT_MS);
      handle = engine.speak(req, {
        onStart: () => {
          if (started) return;
          started = true;
          clock.clearTimeout(startTimer);
          const limit = SAFETY_BASE_MS + (SAFETY_PER_CHAR_MS * req.text.length) / req.rate;
          // Do not cut the audio: this only keeps an awaiting caller from hanging.
          safetyTimer = clock.setTimeout(() => settle('timeout'), limit);
        },
        onEnd: () => settle('ended'),
        onError: (kind) => settle(kind),
      });
      return () => {
        clear();
        handle?.cancel();
      };
    });

  const speakTts = async (t: Ticket, spec: PlaySpec, wasBusy: boolean): Promise<PlayResult | Superseded> => {
    const engine = deps.engine;
    if (engine === null) return fail('unavailable', 'no_voice');
    const lang = spec.language ?? 'ko-KR';

    if (deps.voices.get().tts.state === 'unknown') {
      const waited = await waitFor<'ready'>(t, (resolve) => {
        void deps.voices.whenReady(CAPABILITY_WAIT_MS).then(() => resolve('ready'));
        return () => undefined;
      });
      if (waited === SUPERSEDED) return SUPERSEDED;
    }

    // `none` means do not speak: an English voice must never read Hangul.
    const voice: VoiceCandidate | null = deps.voices.ranked(lang)[0] ?? null;
    if (lang === 'ko-KR' && voice === null) return fail('unavailable', 'no_voice');

    const params = speechParams(spec.kind ?? 'word', deps.levelOrder(), { slow: spec.slow });

    if (wasBusy) {
      const waited = await waitFor<'done'>(t, (resolve) => {
        const handle = clock.setTimeout(() => resolve('done'), DEFER_MS);
        return () => clock.clearTimeout(handle);
      });
      if (waited === SUPERSEDED) return SUPERSEDED;
    }

    return attemptSpeak(t, engine, { text: spec.text, lang, rate: params.rate, pitch: params.pitch, voice }, true);
  };

  /** One utterance; a network voice that errors is marked failed and the next candidate gets one try. */
  const attemptSpeak = async (
    t: Ticket,
    engine: TtsEngine,
    req: TtsRequest,
    retryLeft: boolean,
  ): Promise<PlayResult | Superseded> => {
    const outcome = await runUtterance(t, engine, req);
    if (outcome === SUPERSEDED) return SUPERSEDED;
    if (outcome === 'ended' || outcome === 'interrupted') return 'played';
    if (outcome === 'timeout') {
      noteFailure('tts', 'timeout');
      return 'played';
    }
    if (outcome === 'blocked') {
      noteFailure('tts', 'blocked');
      return fail('unavailable', 'blocked');
    }
    if (retryLeft && req.voice !== null && req.voice.local !== true) {
      deps.voices.markFailed(req.voice.id);
      const next = deps.voices.ranked(req.lang)[0];
      if (next !== undefined) return attemptSpeak(t, engine, { ...req, voice: next }, false);
    }
    noteFailure('tts', 'engine');
    return fail('unavailable', 'error');
  };

  // --- public ----------------------------------------------------------------

  const playPrompt = async (spec: PlaySpec): Promise<PlayResult> => {
    if (deps.isMuted()) return fail('muted', 'muted');

    const ticket: Ticket = { superseded: false, hooks: new Set() };
    const previous = current;
    current = ticket;
    const wasBusy = previous !== null || (deps.engine?.busy() ?? false);
    if (previous !== null) supersede(previous);
    if (wasBusy) {
      deps.engine?.cancelAll();
      deps.clips?.stopAll();
    }

    try {
      const viaClip = await tryClip(ticket, spec);
      if (viaClip === SUPERSEDED) return 'played';
      if (viaClip === 'played') return 'played';
      const viaTts = await speakTts(ticket, spec, wasBusy);
      // An interrupted prompt never drives the fallback.
      return viaTts === SUPERSEDED ? 'played' : viaTts;
    } finally {
      if (current === ticket) current = null;
    }
  };

  return {
    playPrompt,
    playJamo: (jamo, mode = 'sound') => {
      const spoken = spokenFor(jamo, mode);
      const spec: PlaySpec = { text: spoken.text, language: 'ko-KR', kind: 'sound' };
      if (spoken.audioRef !== undefined) spec.audioRef = spoken.audioRef;
      return playPrompt(spec);
    },
    stop: () => {
      if (current !== null) supersede(current);
      deps.engine?.cancelAll();
      deps.clips?.stopAll();
    },
    noteFallbackShown: (source, reason) => {
      const key = `${source}\u0000${reason}`;
      if (shown.has(key)) return;
      shown.add(key);
      deps.emit({ name: 'audio.fallback_shown', payload: { source, reason } });
    },
    dispose: stopObserving,
  };
}
