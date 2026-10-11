import type { SpeechLang } from '@hangul-route/content-schema';
import { Asset } from 'expo-asset';
import { flags } from '../config/flags';
import { AUDIO_ASSETS } from '../content/__generated__/audio-assets';
import {
  attachWebVoices,
  createCapabilityTracker,
  webVoiceToCandidate,
  type AudioCapability,
  type NetworkLike,
  type WebSpeechEngineLike,
  type WebVoiceLike,
} from '../logic/audio/capability';
import {
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
 * The first gesture anywhere unlocks speech and the shared Web Audio context
 * for the page lifetime (`installGestureUnlock`, AD8). Bundled recordings
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
}

/** The generated map, resolved to URLs by expo-asset (`/assets/assets/audio/...<hash>.mp3`). */
function bundledClips(): WebClipSetup {
  const has = (ref: string): boolean => Object.prototype.hasOwnProperty.call(AUDIO_ASSETS, ref);
  const uri = (ref: string): string | null => {
    if (!has(ref)) return null;
    try {
      return Asset.fromModule(AUDIO_ASSETS[ref] as number).uri;
    } catch {
      return null;
    }
  };
  return {
    player: createWebClipPlayer({ uri, ...webAudioGlobals() }),
    assets: { has, size: Object.keys(AUDIO_ASSETS).length },
    enabled: () => flags.audioClips,
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

const GESTURE_EVENTS = ['pointerdown', 'touchend', 'keydown'] as const;
const CAPTURE = { capture: true } as const;

function voiceKey(v: WebVoiceLike): string {
  return v.voiceURI === '' ? v.name : v.voiceURI;
}

export function createWebAudio(env: WebAudioEnv) {
  const { synth, Utterance } = env;
  const clipSetup = env.clips ?? null;
  const clipsOn = (): boolean => clipSetup !== null && clipSetup.enabled();
  const hasClip = (ref: string | undefined): boolean => ref !== undefined && clipsOn() && (clipSetup?.assets.has(ref) ?? false);
  const tracker = createCapabilityTracker({
    online: env.isOnline(),
    clips: clipsOn() && (clipSetup?.assets.size ?? 0) > 0,
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

  const engine: TtsEngine | null =
    synth === null || Utterance === null
      ? null
      : {
          speak: (req: TtsRequest, h: TtsHandlers) => {
            try {
              const u = new Utterance(req.text);
              u.lang = req.lang;
              u.rate = req.rate;
              u.pitch = req.pitch;
              if (req.voice !== null) {
                const wanted = req.voice.id;
                const match = (voiceEvents?.getVoices() ?? []).find((v) => voiceKey(v) === wanted);
                try {
                  if (match !== undefined) u.voice = match;
                } catch {
                  // A voice the engine will not take: speak with the language alone.
                }
              }
              u.onstart = () => h.onStart();
              u.onend = () => h.onEnd();
              // cancel() raises onerror in Chromium and WebKit: a normal stop, not a failure.
              u.onerror = (ev) => h.onError(ev?.error === 'canceled' || ev?.error === 'interrupted' ? 'interrupted' : 'error');
              synth.speak(u);
            } catch {
              // A refused voice or utterance is a failed prompt, never a thrown exception.
              queueMicrotask(() => h.onError('error'));
            }
            return { cancel: () => synth.cancel() };
          },
          cancelAll: () => synth.cancel(),
          busy: () => synth.speaking || synth.pending,
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

  const unlockAudio = (): void => {
    clipSetup?.player.unlock();
    if (synth !== null && Utterance !== null) {
      try {
        const u = new Utterance(' ');
        u.volume = 0;
        synth.speak(u);
      } catch {
        // an engine that refuses the unlock utterance is handled when a prompt fails
      }
    }
    tracker.setUnlocked(true);
  };

  let uninstallGesture: (() => void) | null = null;

  const installGestureUnlock = (): (() => void) => {
    if (uninstallGesture !== null) return uninstallGesture;
    const doc = env.doc;
    if (doc === null) return () => undefined;
    const onGesture = (): void => {
      removeGesture();
      unlockAudio();
    };
    // A page that goes to the background must not keep talking.
    const onVisibility = (): void => {
      if (doc.visibilityState === 'hidden') controller.stop();
    };
    const removeGesture = (): void => {
      for (const type of GESTURE_EVENTS) doc.removeEventListener(type, onGesture, CAPTURE);
    };
    for (const type of GESTURE_EVENTS) doc.addEventListener(type, onGesture, CAPTURE);
    doc.addEventListener('visibilitychange', onVisibility);
    const uninstall = (): void => {
      removeGesture();
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
    refreshCapability: (): Promise<void> => {
      if (voiceEvents === null) tracker.setVoices('no_engine');
      else tracker.setVoices(voiceEvents.getVoices().map(webVoiceToCandidate));
      return Promise.resolve();
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
