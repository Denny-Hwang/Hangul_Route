import type { SpeechLang } from '@hangul-route/content-schema';
import { Asset } from 'expo-asset';
import { flags } from '../config/flags';
import { AUDIO_ASSETS } from '../content/__generated__/audio-assets';
import {
  attachWebVoices,
  createCapabilityTracker,
  voiceAvailable,
  webVoiceToCandidate,
  whenVoicesReady,
  type AudioCapability,
  type NetworkLike,
  type WebSpeechEngineLike,
  type WebVoiceLike,
} from '../logic/audio/capability';
import {
  classifySpeechError,
  createAudioController,
  type AudioController,
  type ClipPlayer,
  type PlayResult,
  type PlaySpec,
  type TtsEngine,
  type TtsHandlers,
  type TtsRequest,
} from '../logic/audio/controller';
import type { FallbackReason } from '../logic/audio/prompt-state';
import { speakCompat, type SpeakOptions } from '../logic/audio/speak-compat';
import type { SpokenJamo } from '../logic/audio/spoken';
import { useAudioStore } from '../store/audio-store';
import { createWebClipPlayer, webAudioGlobals } from './audio-player.web';
import { track } from './telemetry';

/**
 * Web adapter over the audio controller (F-AUDIO-004 §3.5, §3.6). The browser
 * `speechSynthesis` is wrapped as a `TtsEngine`; every decision (muting, the
 * ranked Korean voice, rate, the text-fallback result, the 50 ms supersede
 * gap) lives in `logic/audio/controller`. Metro picks this file for the web
 * build instead of `audio.ts`; the surface is identical.
 *
 * The first user activation anywhere unlocks speech and the shared Web Audio
 * context for the page lifetime (`installGestureUnlock`, AD8): the unlock counts
 * only once the engine answers it, and it also warms the Korean voice. A paused
 * or slow engine is resumed rather than given up on, and every utterance is held
 * until it settles (F-AUDIO-004 2026-10-17). Bundled recordings
 * (`__generated__/audio-assets.ts`) play first through the clip player
 * (`audio-player.web.ts`, A-6); a clip that fails falls through to the voice.
 */
export type { PlayResult, PlaySpec, SpeakOptions };
/** The name F-QUEST-002 §3.12 used for the same shape. */
export type PromptSpec = PlaySpec;

// --- Environment (injected so the adapter is tested against a fake) ---------

interface WebUtterance {
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: unknown;
  onstart: ((ev: unknown) => void) | null;
  onend: ((ev: unknown) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
}

interface WebSynth {
  getVoices(): readonly WebVoiceLike[];
  speak(u: WebUtterance): void;
  cancel(): void;
  readonly speaking: boolean;
  readonly pending: boolean;
  /** Missing on a few old engines; a paused engine starts nothing until `resume()`. */
  readonly paused?: boolean;
  resume?(): void;
  /** Missing on old Safari (before 14.1), where only `onvoiceschanged` exists. */
  addEventListener?: (type: 'voiceschanged', listener: () => void) => void;
  removeEventListener?: (type: 'voiceschanged', listener: () => void) => void;
  onvoiceschanged?: (() => void) | null;
}

export interface WebAudioEnv {
  synth: WebSynth | null;
  Utterance: (new (text: string) => WebUtterance) | null;
  /** `document`: gesture and visibility events. */
  doc: (EventTarget & { visibilityState: string }) | null;
  /** `window`: online / offline events. */
  win: EventTarget | null;
  isOnline(): boolean;
  /** Bundled recordings (A-6). Absent = a build with no clip path: every prompt uses the voice. */
  clips?: WebClipSetup;
}

export interface WebClipSetup {
  player: ClipPlayer;
  /** The bundled asset map: `has(ref)` and how many clips it holds. */
  assets: { has(ref: string): boolean; readonly size: number };
  /** `flags.audioClips`: off switches every clip off without a code change. */
  enabled(): boolean;
  /** The browser has Web Audio and `fetch`; without them no clip can play, so none is tried. */
  supported: boolean;
}

/** The generated map, resolved to URLs by expo-asset (`/assets/assets/audio/...<hash>.mp3`). */
function bundledClips(): WebClipSetup {
  const has = (ref: string): boolean => Object.prototype.hasOwnProperty.call(AUDIO_ASSETS, ref);
  const uri = (ref: string): string | null => {
    if (!has(ref)) return null;
    try {
      // On web Metro's asset transformer makes `require('x.mp3')` a URL string, not a registry number.
      const mod = AUDIO_ASSETS[ref];
      return mod === undefined ? null : Asset.fromModule(mod).uri;
    } catch {
      return null;
    }
  };
  const globals = webAudioGlobals();
  return {
    player: createWebClipPlayer({ uri, ...globals }),
    assets: { has, size: Object.keys(AUDIO_ASSETS).length },
    enabled: () => flags.audioClips,
    supported: globals.createContext !== null && globals.fetch !== null,
  };
}

function defaultEnv(): WebAudioEnv {
  const g = globalThis as unknown as {
    speechSynthesis?: WebSynth;
    SpeechSynthesisUtterance?: new (text: string) => WebUtterance;
    document?: EventTarget & { visibilityState: string };
    addEventListener?: unknown;
    navigator?: { onLine?: boolean };
  };
  const usable = g.speechSynthesis !== undefined && g.SpeechSynthesisUtterance !== undefined;
  return {
    synth: usable ? (g.speechSynthesis ?? null) : null,
    Utterance: usable ? (g.SpeechSynthesisUtterance ?? null) : null,
    doc: g.document ?? null,
    win: typeof g.addEventListener === 'function' ? (globalThis as unknown as EventTarget) : null,
    isOnline: () => g.navigator?.onLine !== false,
    clips: bundledClips(),
  };
}

// --- The adapter -------------------------------------------------------------

/**
 * Events that carry user activation on touch screens too (a touch `pointerdown` does not: the
 * activation comes with `pointerup` and `touchend`). The speech unlock listens to these, plus a
 * mouse `pointerdown`. The clip context is offered every one of them for the page lifetime, so a
 * context that iOS suspended (background, a call, Siri) starts again on the next tap; a running
 * context ignores them.
 */
const ACTIVATION_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;
const CLIP_GESTURE_EVENTS = ACTIVATION_EVENTS;
const CAPTURE = { capture: true } as const;

/**
 * Every utterance handed to the engine and not yet settled. Chromium can garbage-collect an utterance
 * nothing else references and then never fire its `end` or `error`, so each one is held here until it
 * ends, errors or is cancelled.
 */
const LIVE_UTTERANCES = new Set<WebUtterance>();

function voiceKey(v: WebVoiceLike): string {
  return v.voiceURI === '' ? v.name : v.voiceURI;
}

export function createWebAudio(env: WebAudioEnv) {
  const { synth, Utterance } = env;
  const clipSetup = env.clips ?? null;
  const clipsOn = (): boolean => clipSetup !== null && clipSetup.supported && clipSetup.enabled();
  /** Clips are on and the build holds at least one: only then is Web Audio touched at all. */
  const clipsLive = (): boolean => clipsOn() && (clipSetup?.assets.size ?? 0) > 0;
  const hasClip = (ref: string | undefined): boolean => ref !== undefined && clipsOn() && (clipSetup?.assets.has(ref) ?? false);
  const tracker = createCapabilityTracker({
    online: env.isOnline(),
    clips: clipsLive(),
  });

  const network: NetworkLike = {
    isOnline: env.isOnline,
    subscribe: (fn) => {
      const win = env.win;
      if (win === null) return () => undefined;
      const goOnline = (): void => fn(true);
      const goOffline = (): void => fn(false);
      win.addEventListener('online', goOnline);
      win.addEventListener('offline', goOffline);
      return () => {
        win.removeEventListener('online', goOnline);
        win.removeEventListener('offline', goOffline);
      };
    },
  };

  // Total over old engines: no EventTarget (old Safari) falls back to `onvoiceschanged`,
  // and a getVoices() that throws reads as an empty list.
  const legacyListeners = new Set<() => void>();
  const dispatchLegacy = (): void => {
    for (const listener of [...legacyListeners]) listener();
  };
  const voiceEvents: WebSpeechEngineLike | null =
    synth === null
      ? null
      : {
          getVoices: () => {
            try {
              return synth.getVoices();
            } catch {
              return [];
            }
          },
          addEventListener: (type, listener) => {
            if (typeof synth.addEventListener === 'function') return synth.addEventListener(type, listener);
            legacyListeners.add(listener);
            synth.onvoiceschanged = dispatchLegacy;
          },
          removeEventListener: (type, listener) => {
            if (typeof synth.removeEventListener === 'function') return synth.removeEventListener(type, listener);
            legacyListeners.delete(listener);
            if (legacyListeners.size === 0 && synth.onvoiceschanged === dispatchLegacy) synth.onvoiceschanged = null;
          },
        };

  // This instance's utterances still held, by role: prompts, and the silent unlock (see `busy`).
  const heldPrompts = new Set<WebUtterance>();
  const heldUnlocks = new Set<WebUtterance>();
  const hold = (u: WebUtterance, role: 'prompt' | 'unlock'): void => {
    LIVE_UTTERANCES.add(u);
    (role === 'prompt' ? heldPrompts : heldUnlocks).add(u);
  };
  const release = (u: WebUtterance): void => {
    LIVE_UTTERANCES.delete(u);
    heldPrompts.delete(u);
    heldUnlocks.delete(u);
  };
  /** After a cancel nothing a prompt waits for is coming: drop the held prompts. */
  const releasePrompts = (): void => {
    for (const u of [...heldPrompts]) release(u);
  };

  /** The ranked voice object for an id, from a list read now. */
  const voiceFor = (id: string): WebVoiceLike | undefined => (voiceEvents?.getVoices() ?? []).find((v) => voiceKey(v) === id);
  const setVoice = (u: WebUtterance, id: string | undefined): void => {
    if (id === undefined) return;
    const match = voiceFor(id);
    try {
      if (match !== undefined) u.voice = match;
    } catch {
      // A voice the engine will not take: speak with the language alone.
    }
  };

  /** A paused engine starts nothing new, so it is resumed before every speak. */
  const resumeIfPaused = (): void => {
    if (synth === null || synth.paused !== true) return;
    try {
      synth.resume?.();
    } catch {
      // an engine that refuses resume() reports the prompt through the start wait
    }
  };

  const engine: TtsEngine | null =
    synth === null || Utterance === null
      ? null
      : {
          speak: (req: TtsRequest, h: TtsHandlers) => {
            let spoken: WebUtterance | null = null;
            try {
              resumeIfPaused();
              const u = new Utterance(req.text);
              u.lang = req.lang;
              u.rate = req.rate;
              u.pitch = req.pitch;
              if (req.voice !== null) setVoice(u, req.voice.id);
              u.onstart = () => h.onStart();
              u.onend = () => {
                release(u);
                h.onEnd();
              };
              // cancel() raises canceled/interrupted in Chromium and WebKit (a normal stop); not-allowed is the
              // browser refusing (blocked); any other code is a real engine error, kept for telemetry.
              u.onerror = (ev) => {
                release(u);
                const { kind, code } = classifySpeechError(ev?.error);
                h.onError(kind, code);
              };
              hold(u, 'prompt');
              spoken = u;
              synth.speak(u);
            } catch {
              // A refused voice or utterance is a failed prompt, never a thrown exception.
              if (spoken !== null) release(spoken);
              queueMicrotask(() => h.onError('error'));
            }
            const mine = spoken;
            return {
              cancel: () => {
                if (mine !== null) release(mine);
                synth.cancel();
              },
            };
          },
          cancelAll: () => {
            synth.cancel();
            releasePrompts();
          },
          // Busy unless the only thing the engine holds is our silent unlock: a prompt asked in the unlocking
          // tap queues behind it, and cancelling it would make Chromium drop the prompt that follows.
          busy: () => (synth.speaking || synth.pending) && !(heldPrompts.size === 0 && heldUnlocks.size > 0),
          // A stalled Chrome engine can hold its queue with `paused` false, so this is not gated on `paused`.
          resume: () => {
            try {
              synth.resume?.();
            } catch {
              // nothing to resume
            }
          },
        };

  const store = useAudioStore;
  const controller: AudioController = createAudioController({
    engine,
    clips: clipSetup?.player ?? null,
    assets: { has: (ref) => clipSetup?.assets.has(ref) ?? false },
    clipsEnabled: clipsOn,
    voices: tracker,
    isMuted: () => store.getState().muted,
    levelOrder: () => store.getState().levelOrder,
    platform: 'web',
    emit: (event) => {
      void track({ name: event.name, payload: { ...event.payload } });
    },
    reportFailure: (reason: FallbackReason) => store.getState().reportFailure(reason),
  });

  const pushCapability = (c: AudioCapability): void => store.getState().setCapability(c);
  const offCapability = tracker.subscribe(pushCapability);
  pushCapability(tracker.get());

  // Switching the sound off stops whatever is speaking.
  const offMute = store.subscribe((state, prev) => {
    if (state.muted && !prev.muted) controller.stop();
  });

  const detachVoices = attachWebVoices(tracker, voiceEvents, network, { timeoutMs: 1500 });

  const playPrompt = (spec: PlaySpec): Promise<PlayResult> => controller.playPrompt(spec);

  /** Starts the clip context inside a gesture; never stops the speech unlock that follows. */
  const unlockClips = (): void => {
    if (!clipsLive()) return;
    try {
      clipSetup?.player.unlock();
    } catch {
      // a player that refuses is reported as `blocked` by the clip that needed it
    }
  };

  // --- the speech unlock (§3.6) ----------------------------------------------
  //
  // The page counts as unlocked only once the engine answers the silent utterance (it started, ended,
  // or failed for a reason other than `not-allowed`): iOS drops a speak outside its gesture without a
  // word, and Chrome refuses one before any activation with `not-allowed`; either way the next
  // activation tries again. The utterance is Korean, in the ranked Korean voice, so the tap also wakes
  // the Korean engine before the first prompt.

  let unlockDone = false;
  /** The unlock utterance waiting for its answer. */
  let unlockInFlight: WebUtterance | null = null;
  /** Removes the speech unlock listeners while they are installed. */
  let removeUnlockListeners: (() => void) | null = null;

  const finishUnlock = (): void => {
    if (unlockDone) return;
    unlockDone = true;
    removeUnlockListeners?.();
    tracker.setUnlocked(true);
  };

  const unlockSpeech = (): void => {
    if (unlockDone) return;
    if (synth === null || Utterance === null) {
      finishUnlock();
      return;
    }
    // The engine holds the one already sent (this tap's earlier event): its answer is on the way.
    if (unlockInFlight !== null && (synth.speaking || synth.pending)) return;
    // Otherwise an earlier one was dropped without a word (iOS outside its gesture): send a new one.
    if (unlockInFlight !== null) release(unlockInFlight);
    try {
      resumeIfPaused();
      const u = new Utterance(' ');
      u.volume = 0;
      u.lang = 'ko-KR';
      setVoice(u, tracker.ranked('ko-KR')[0]?.id);
      const answer = (counts: boolean): void => {
        if (unlockInFlight !== u) return;
        unlockInFlight = null;
        if (counts) finishUnlock();
      };
      u.onstart = () => answer(true);
      u.onend = () => {
        release(u);
        answer(true);
      };
      u.onerror = (ev) => {
        release(u);
        answer(ev?.error !== 'not-allowed');
      };
      unlockInFlight = u;
      hold(u, 'unlock');
      synth.speak(u);
    } catch {
      // An engine that throws on the utterance itself: no later tap changes that, so stop asking.
      unlockInFlight = null;
      finishUnlock();
    }
  };

  const unlockAudio = (): void => {
    unlockClips();
    unlockSpeech();
  };

  let uninstallGesture: (() => void) | null = null;

  const installGestureUnlock = (): (() => void) => {
    if (uninstallGesture !== null) return uninstallGesture;
    const doc = env.doc;
    if (doc === null) return () => undefined;
    const onActivation = (ev: Event): void => {
      // A touch or pen pointerdown carries no activation; a mouse press does.
      if (ev.type === 'pointerdown' && (ev as { pointerType?: string }).pointerType !== 'mouse') return;
      unlockSpeech();
    };
    const SPEECH_EVENTS = [...ACTIVATION_EVENTS, 'pointerdown'] as const;
    const removeSpeechListeners = (): void => {
      for (const type of SPEECH_EVENTS) doc.removeEventListener(type, onActivation, CAPTURE);
      removeUnlockListeners = null;
    };
    const onVisibility = (): void => {
      // A page that goes to the background must not keep talking.
      if (doc.visibilityState === 'hidden') {
        controller.stop();
        return;
      }
      // Back in front: the hidden page already stopped every prompt, so whatever the engine still holds is
      // stale (Chrome can keep a queue behind a hidden tab); a paused engine would hold the next prompt too.
      if (doc.visibilityState !== 'visible' || synth === null) return;
      if (synth.speaking || synth.pending) {
        synth.cancel();
        releasePrompts();
      }
      resumeIfPaused();
    };
    if (!unlockDone) {
      for (const type of SPEECH_EVENTS) doc.addEventListener(type, onActivation, CAPTURE);
      removeUnlockListeners = removeSpeechListeners;
    }
    for (const type of CLIP_GESTURE_EVENTS) doc.addEventListener(type, unlockClips, CAPTURE);
    doc.addEventListener('visibilitychange', onVisibility);
    const uninstall = (): void => {
      removeSpeechListeners();
      for (const type of CLIP_GESTURE_EVENTS) doc.removeEventListener(type, unlockClips, CAPTURE);
      doc.removeEventListener('visibilitychange', onVisibility);
      uninstallGesture = null;
    };
    uninstallGesture = uninstall;
    return uninstall;
  };

  return {
    playPrompt,
    playJamo: (jamo: SpokenJamo, mode: 'sound' | 'name' = 'sound'): Promise<PlayResult> => controller.playJamo(jamo, mode),
    speak: (text: string, opts: SpeakOptions = {}): void => speakCompat(playPrompt, text, opts),
    stop: (): void => controller.stop(),
    setMuted: (muted: boolean): void => store.getState().setMuted(muted, 'profile'),
    isMuted: (): boolean => store.getState().muted,
    getCapability: (): AudioCapability => tracker.get(),
    /** A voice for `lang` (the level check's instruction voice); an unknown voice list counts as available. */
    hasVoiceFor: (lang: SpeechLang): boolean => voiceAvailable(tracker.get(), tracker.ranked(lang)),
    refreshCapability: async (): Promise<void> => {
      if (voiceEvents === null) {
        tracker.setVoices('no_engine');
        return;
      }
      let list = voiceEvents.getVoices();
      // Chrome answers [] until its list loads: an empty list written now would read "no Korean voice"
      // (the start screen's no-voice line, a false audio.capability_checked), so wait for voiceschanged.
      if (list.length === 0 && tracker.get().tts.state === 'unknown') list = await whenVoicesReady(voiceEvents, { timeoutMs: 1500 });
      tracker.setVoices(list.map(webVoiceToCandidate));
    },
    subscribeCapability: (fn: (c: AudioCapability) => void): (() => void) => tracker.subscribe(fn),
    unlockAudio,
    installGestureUnlock,
    /** Fetch and decode a round's clips ahead of time (§3.10); refs with no bundled file are skipped. */
    warmClips: (refs: readonly string[]): Promise<void> => {
      const wanted = refs.filter((ref) => hasClip(ref));
      if (clipSetup === null || wanted.length === 0) return Promise.resolve();
      return clipSetup.player.warm(wanted);
    },
    /** The ref has a bundled recording that will be tried first (the prompt slot's `hasClip`). */
    hasClip,
    noteFallbackShown: (source: string, reason: FallbackReason): void => controller.noteFallbackShown(source, reason),
    dispose: (): void => {
      uninstallGesture?.();
      detachVoices();
      offCapability();
      offMute();
      controller.dispose();
    },
  };
}

export type WebAudio = ReturnType<typeof createWebAudio>;

// --- Module-level surface (what screens import) ------------------------------

let instance: WebAudio | null = null;

function audio(): WebAudio {
  instance ??= createWebAudio(defaultEnv());
  return instance;
}

export function playPrompt(spec: PlaySpec): Promise<PlayResult> {
  return audio().playPrompt(spec);
}
export function playJamo(jamo: SpokenJamo, mode: 'sound' | 'name' = 'sound'): Promise<PlayResult> {
  return audio().playJamo(jamo, mode);
}
export function speak(text: string, opts: SpeakOptions = {}): void {
  audio().speak(text, opts);
}
export function stop(): void {
  audio().stop();
}
export function setMuted(muted: boolean): void {
  audio().setMuted(muted);
}
export function isMuted(): boolean {
  return audio().isMuted();
}
export function getCapability(): AudioCapability {
  return audio().getCapability();
}
export function hasVoiceFor(lang: SpeechLang): boolean {
  return audio().hasVoiceFor(lang);
}
export function refreshCapability(): Promise<void> {
  return audio().refreshCapability();
}
export function subscribeCapability(fn: (c: AudioCapability) => void): () => void {
  return audio().subscribeCapability(fn);
}
export function unlockAudio(): void {
  audio().unlockAudio();
}
/** Call once at boot, before the navigator renders (web). Returns the uninstall function. */
export function installGestureUnlock(): () => void {
  return audio().installGestureUnlock();
}
export function warmClips(refs: readonly string[]): Promise<void> {
  return audio().warmClips(refs);
}
export function noteFallbackShown(source: string, reason: FallbackReason): void {
  audio().noteFallbackShown(source, reason);
}
export function hasClip(ref: string | undefined): boolean {
  return audio().hasClip(ref);
}

export type { SpeechLang };
