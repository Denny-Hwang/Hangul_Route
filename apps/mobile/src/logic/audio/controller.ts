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

/** The `SpeechSynthesisErrorEvent.error` values of the Web Speech API (a closed list). */
export const SPEECH_ERROR_CODES = [
  'canceled',
  'interrupted',
  'audio-busy',
  'audio-hardware',
  'network',
  'synthesis-unavailable',
  'synthesis-failed',
  'language-unavailable',
  'voice-unavailable',
  'text-too-long',
  'invalid-argument',
  'not-allowed',
] as const;
export type SpeechErrorCode = (typeof SPEECH_ERROR_CODES)[number];

/**
 * `'interrupted'` = canceled/interrupted/stopped (not a failure); `'blocked'` = the browser refused
 * to speak (Chrome's `not-allowed` before any user activation); `'error'` = a real engine error.
 */
export type TtsErrorKind = 'interrupted' | 'blocked' | 'error';

/** A Web Speech error code as the controller reads it: one of the list, else `'other'`. */
export function classifySpeechError(raw: unknown): { kind: TtsErrorKind; code: SpeechErrorCode | 'other' } {
  const code = typeof raw === 'string' && (SPEECH_ERROR_CODES as readonly string[]).includes(raw) ? (raw as SpeechErrorCode) : 'other';
  if (code === 'canceled' || code === 'interrupted') return { kind: 'interrupted', code };
  if (code === 'not-allowed') return { kind: 'blocked', code };
  return { kind: 'error', code };
}

export interface TtsHandlers {
  onStart(): void;
  onEnd(): void;
  /** `code`: the engine's error code when it gives one (the web does; the native adapter does not). */
  onError(kind: TtsErrorKind, code?: SpeechErrorCode | 'other'): void;
}

export interface TtsEngine {
  speak(req: TtsRequest, handlers: TtsHandlers): { cancel(): void };
  /** Stop everything running or queued. */
  cancelAll(): void;
  /** `speaking || pending`. */
  busy(): boolean;
  /**
   * Nudge an engine that holds its queue (a paused or stalled Chrome engine); absent where there is nothing to resume.
   * Only an engine that has it gets the start grace (`START_GRACE_MS`): the web's. Native prompts keep the 1.5 s wait.
   */
  resume?(): void;
  /**
   * The engine's own silent utterance (the page's speech unlock, which also warms the Korean voice) is still ahead of
   * the prompts it holds. A prompt asked in the unlocking tap waits behind it, so its start clock does not run then.
   */
  warming?(): boolean;
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

export type PlaybackFailReason = 'missing' | 'fetch' | 'decode' | 'blocked' | 'timeout' | 'engine';
/**
 * Why a playback failed, as a code: a Web Speech error code, `'timeout'` (no answer from the engine in
 * time), `'none'` (no code: a clip, or an engine that gives none) or `'other'` (a code not on the list).
 */
export type PlaybackFailCode = SpeechErrorCode | 'timeout' | 'none' | 'other';

export interface PlaybackFailedPayload {
  kind: 'clip' | 'tts';
  reason: PlaybackFailReason;
  code: PlaybackFailCode;
  /** `PlaySpec.source`, else `'unknown'`. */
  source: string;
}

export type AudioTelemetryEvent =
  | { name: 'audio.capability_checked'; payload: CapabilityCheckedPayload }
  | { name: 'audio.fallback_shown'; payload: { source: string; reason: FallbackReason } }
  | { name: 'audio.playback_failed'; payload: PlaybackFailedPayload };

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
/** More time for an engine still holding the utterance at 1.5 s (a cold Korean voice on Android Chrome). */
const START_GRACE_MS = 2500;
/** While the engine's silent warm-up is ahead of a prompt, the prompt's clock is checked this often... */
const WARMUP_POLL_MS = 100;
/** ...for at most this long past the first 1.5 s; then the queue is stuck behind it and is cleared once. */
const WARMUP_MAX_MS = 1500;
/** After a cancel: at least this long before the next utterance... */
const DEFER_MS = 50;
/** ...then the engine is polled this often until it reports idle (Chromium drops a speak made too soon)... */
const DRAIN_POLL_MS = 25;
/** ...for at most this long in all. */
const DRAIN_MAX_MS = 300;
const SAFETY_BASE_MS = 2000;
const SAFETY_PER_CHAR_MS = 400;
const MAX_FAILURE_EVENTS_PER_KEY = 3;
const MAX_FAILURE_EVENTS_PER_PAGE = 12;

const SUPERSEDED = Symbol('superseded');
type Superseded = typeof SUPERSEDED;

interface Ticket {
  superseded: boolean;
  hooks: Set<() => void>;
}

type UtteranceOutcome =
  | { outcome: 'ended' }
  | { outcome: 'interrupted' }
  /** Never started because the engine never got past its own silent warm-up ahead of it. */
  | { outcome: 'stuck' }
  | { outcome: 'timeout'; code: PlaybackFailCode }
  | { outcome: 'blocked'; code: PlaybackFailCode }
  | { outcome: 'error'; code: PlaybackFailCode };

export function createAudioController(deps: ControllerDeps): AudioController {
  const clock = deps.clock ?? systemClock;
  let current: Ticket | null = null;
  let failureEvents = 0;
  const failureEventsByKey = new Map<string, number>();
  let lastCapabilityKey: string | null = null;
  const shown = new Set<string>();

  // --- telemetry -------------------------------------------------------------

  /** At most 3 events per (kind, reason, code) and 12 per page, so a broken engine cannot flood. */
  const noteFailure = (payload: PlaybackFailedPayload): void => {
    if (failureEvents >= MAX_FAILURE_EVENTS_PER_PAGE) return;
    const key = `${payload.kind}\u0000${payload.reason}\u0000${payload.code}`;
    const sent = failureEventsByKey.get(key) ?? 0;
    if (sent >= MAX_FAILURE_EVENTS_PER_KEY) return;
    failureEventsByKey.set(key, sent + 1);
    failureEvents += 1;
    deps.emit({ name: 'audio.playback_failed', payload });
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

  const sourceOf = (spec: PlaySpec): string => spec.source ?? 'unknown';

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
    noteFailure({ kind: 'clip', reason: outcome, code: 'none', source: sourceOf(spec) });
    return 'skipped';
  };

  // --- tts -------------------------------------------------------------------

  /** `mayRestart`: a queue stuck behind the engine's warm-up settles `stuck` (the caller clears it and asks again). */
  const runUtterance = (t: Ticket, engine: TtsEngine, req: TtsRequest, mayRestart: boolean): Promise<UtteranceOutcome | Superseded> =>
    waitFor<UtteranceOutcome>(t, (resolve) => {
      let started = false;
      let graced = false;
      let warmedMs = 0;
      let behindWarmup = false;
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
      // No start yet. Behind the engine's silent warm-up (a prompt asked in the unlocking tap), the warm-up's cold
      // start is not this prompt's: its clock waits while the warm-up is ahead and starts again once it is through,
      // and a queue that never gets past it is stuck. An idle engine dropped the utterance (iOS outside a gesture):
      // blocked now. A busy web engine still holds it (a cold Korean voice on Android Chrome can take longer than
      // 1.5 s): it is nudged and given the grace, never cancelled before then.
      const noStart = (): void => {
        if (engine.warming?.() === true) {
          if (warmedMs < WARMUP_MAX_MS) {
            warmedMs += WARMUP_POLL_MS;
            behindWarmup = true;
            startTimer = clock.setTimeout(noStart, WARMUP_POLL_MS);
            return;
          }
          if (mayRestart) {
            settle({ outcome: 'stuck' });
            return;
          }
        } else if (behindWarmup) {
          behindWarmup = false;
          startTimer = clock.setTimeout(noStart, START_TIMEOUT_MS);
          return;
        }
        if (!graced && engine.resume !== undefined && engine.busy()) {
          graced = true;
          engine.resume();
          startTimer = clock.setTimeout(noStart, START_GRACE_MS);
          return;
        }
        settle({ outcome: 'blocked', code: 'timeout' });
        handle?.cancel();
      };
      startTimer = clock.setTimeout(noStart, START_TIMEOUT_MS);
      handle = engine.speak(req, {
        onStart: () => {
          if (started) return;
          started = true;
          clock.clearTimeout(startTimer);
          const limit = SAFETY_BASE_MS + (SAFETY_PER_CHAR_MS * req.text.length) / req.rate;
          // Do not cut the audio: this only keeps an awaiting caller from hanging.
          safetyTimer = clock.setTimeout(() => settle({ outcome: 'timeout', code: 'timeout' }), limit);
        },
        onEnd: () => settle({ outcome: 'ended' }),
        onError: (kind, code) => {
          if (kind === 'interrupted') settle({ outcome: 'interrupted' });
          else settle({ outcome: kind, code: code ?? 'none' });
        },
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

    if (wasBusy && (await drain(t, engine)) === SUPERSEDED) return SUPERSEDED;

    return attemptSpeak(t, engine, { text: spec.text, lang, rate: params.rate, pitch: params.pitch, voice }, true, sourceOf(spec), true);
  };

  /**
   * After a cancel: at least 50 ms, then until the engine says it is idle (at most 300 ms in all), so the next speak()
   * is not dropped by an engine still stopping (the web engine stays busy until a cancelled utterance that was
   * speaking reports its own `interrupted`). A newer call supersedes the wait.
   */
  const drain = (t: Ticket, engine: TtsEngine): Promise<'done' | Superseded> =>
    waitFor<'done'>(t, (resolve) => {
      let elapsed = DEFER_MS;
      const poll = (): void => {
        if (!engine.busy() || elapsed >= DRAIN_MAX_MS) {
          resolve('done');
          return;
        }
        elapsed += DRAIN_POLL_MS;
        handle = clock.setTimeout(poll, DRAIN_POLL_MS);
      };
      let handle = clock.setTimeout(poll, DEFER_MS);
      return () => clock.clearTimeout(handle);
    });

  /**
   * One utterance; a network voice that errors is marked failed and the next candidate gets one try, and a queue stuck
   * behind the engine's warm-up is cleared and the utterance asked once more (`restartLeft`).
   */
  const attemptSpeak = async (
    t: Ticket,
    engine: TtsEngine,
    req: TtsRequest,
    retryLeft: boolean,
    source: string,
    restartLeft: boolean,
  ): Promise<PlayResult | Superseded> => {
    const settled = await runUtterance(t, engine, req, restartLeft);
    if (settled === SUPERSEDED) return SUPERSEDED;
    if (settled.outcome === 'stuck') {
      // The engine never got past its own silent warm-up (it holds it and gives no event): clear the queue, let it
      // stop, and say this once more. The old code cancelled a busy engine before every prompt, which played here.
      engine.cancelAll();
      if ((await drain(t, engine)) === SUPERSEDED) return SUPERSEDED;
      return attemptSpeak(t, engine, req, retryLeft, source, false);
    }
    if (settled.outcome === 'ended' || settled.outcome === 'interrupted') return 'played';
    const { code } = settled;
    if (settled.outcome === 'timeout') {
      noteFailure({ kind: 'tts', reason: 'timeout', code, source });
      return 'played';
    }
    // Refused by the browser (no start, or `not-allowed`): another voice would be refused too, so no retry.
    if (settled.outcome === 'blocked') {
      noteFailure({ kind: 'tts', reason: 'blocked', code, source });
      return fail('unavailable', 'blocked');
    }
    if (retryLeft && req.voice !== null && req.voice.local !== true) {
      deps.voices.markFailed(req.voice.id);
      const next = deps.voices.ranked(req.lang)[0];
      if (next !== undefined) return attemptSpeak(t, engine, { ...req, voice: next }, false, source, restartLeft);
    }
    noteFailure({ kind: 'tts', reason: 'engine', code, source });
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
