import type { SpeechLang } from '@hangul-route/content-schema';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import {
  attachNativeVoices,
  createCapabilityTracker,
  readNativeVoices,
  type AudioCapability,
  type NativeVoiceLike,
  type NetworkLike,
} from '../logic/audio/capability';
import {
  createAudioController,
  type AudioController,
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
import { track } from './telemetry';

/**
 * Native adapter over the audio controller (F-AUDIO-004 §3.5). `expo-speech`
 * is wrapped as a `TtsEngine`; every decision lives in
 * `logic/audio/controller`. The voice id passed to the engine is only ever
 * one read from `getAvailableVoicesAsync()` in this session (an uninstalled
 * id makes iOS throw), and with no usable Korean voice the engine is not
 * called at all, so an English voice never reads Hangul (Android would
 * otherwise fall back to the default locale).
 *
 * Metro picks `audio.web.ts` for the web build; the surface is identical.
 * The clip path (expo-av) lands in A-7; the silent-switch decision it reads is
 * `PLAY_IN_SILENT_MODE` in `config/audio.ts`. Speech itself follows the
 * system audio session (expo-speech has no option for it).
 */

export type { PlayResult, PlaySpec, SpeakOptions };
/** The name F-QUEST-002 §3.12 used for the same shape. */
export type PromptSpec = PlaySpec;

// --- Environment (injected so the adapter is tested against a fake) ---------

interface SpeechEventOptions {
  language?: string;
  rate?: number;
  pitch?: number;
  voice?: string;
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
}

/** The slice of `expo-speech` this adapter uses. */
export interface NativeSpeechApi {
  speak(text: string, options?: SpeechEventOptions): void;
  stop(): void | Promise<void>;
  getAvailableVoicesAsync(): Promise<readonly NativeVoiceLike[]>;
}

export interface NativeAudioEnv {
  speech: NativeSpeechApi;
  platform: 'ios' | 'android';
}

// --- The adapter -------------------------------------------------------------

/**
 * Network state is not wired on native yet (no NetInfo dependency): voices are
 * treated as reachable. A network voice that errors is retried once with the
 * next candidate by the controller.
 */
const ASSUME_ONLINE: NetworkLike = { isOnline: () => true, subscribe: () => () => undefined };

export function createNativeAudio(env: NativeAudioEnv) {
  const { speech, platform } = env;
  const tracker = createCapabilityTracker({ online: true, clips: false });

  // Utterances between `speak` and their first terminal callback.
  const live = new Set<object>();

  const engine: TtsEngine = {
    speak: (req: TtsRequest, h: TtsHandlers) => {
      const token = {};
      live.add(token);
      const finish = (cb: () => void): void => {
        live.delete(token);
        cb();
      };
      try {
        speech.speak(req.text, {
          language: req.lang,
          rate: req.rate,
          pitch: req.pitch,
          ...(req.voice === null ? {} : { voice: req.voice.id }),
          onStart: () => h.onStart(),
          onDone: () => finish(() => h.onEnd()),
          // onStopped is a stop() (a newer prompt, or mute): not a failure.
          onStopped: () => finish(() => h.onError('interrupted')),
          onError: () => finish(() => h.onError('error')),
        });
      } catch {
        // iOS throws for a voice that is no longer installed.
        queueMicrotask(() => finish(() => h.onError('error')));
      }
      return { cancel: () => void speech.stop() };
    },
    cancelAll: () => {
      live.clear();
      void speech.stop();
    },
    busy: () => live.size > 0,
  };

  const store = useAudioStore;
  const controller: AudioController = createAudioController({
    engine,
    clips: null,
    assets: { has: () => false },
    clipsEnabled: () => false,
    voices: tracker,
    isMuted: () => store.getState().muted,
    levelOrder: () => store.getState().levelOrder,
    platform,
    emit: (event) => {
      void track({ name: event.name, payload: { ...event.payload } });
    },
    reportFailure: (reason: FallbackReason) => store.getState().reportFailure(reason),
  });

  const pushCapability = (c: AudioCapability): void => store.getState().setCapability(c);
  const offCapability = tracker.subscribe(pushCapability);
  // Nothing to unlock on native (§3.6).
  tracker.setUnlocked(true);
  pushCapability(tracker.get());

  const offMute = store.subscribe((state, prev) => {
    if (state.muted && !prev.muted) controller.stop();
  });

  const readVoices = (): Promise<readonly NativeVoiceLike[]> => speech.getAvailableVoicesAsync();
  const detachVoices = attachNativeVoices(tracker, readVoices, platform, ASSUME_ONLINE);

  const playPrompt = (spec: PlaySpec): Promise<PlayResult> => controller.playPrompt(spec);

  return {
    playPrompt,
    playJamo: (jamo: SpokenJamo, mode: 'sound' | 'name' = 'sound'): Promise<PlayResult> => controller.playJamo(jamo, mode),
    speak: (text: string, opts: SpeakOptions = {}): void => speakCompat(playPrompt, text, opts),
    stop: (): void => controller.stop(),
    setMuted: (muted: boolean): void => store.getState().setMuted(muted, 'profile'),
    isMuted: (): boolean => store.getState().muted,
    getCapability: (): AudioCapability => tracker.get(),
    refreshCapability: async (): Promise<void> => {
      const result = await readNativeVoices(readVoices, platform);
      tracker.setVoices(result.kind === 'voices' ? result.voices : 'no_engine');
    },
    subscribeCapability: (fn: (c: AudioCapability) => void): (() => void) => tracker.subscribe(fn),
    /** Nothing to unlock on native. */
    unlockAudio: (): void => undefined,
    installGestureUnlock: (): (() => void) => () => undefined,
    /** Clip pre-decode arrives with the clip player (A-7); nothing to warm yet. */
    warmClips: (_refs: readonly string[]): Promise<void> => Promise.resolve(),
    noteFallbackShown: (source: string, reason: FallbackReason): void => controller.noteFallbackShown(source, reason),
    dispose: (): void => {
      detachVoices();
      offCapability();
      offMute();
      controller.dispose();
    },
  };
}

export type NativeAudio = ReturnType<typeof createNativeAudio>;

// --- Module-level surface (what screens import) ------------------------------

let instance: NativeAudio | null = null;

function audio(): NativeAudio {
  instance ??= createNativeAudio({
    speech: Speech as unknown as NativeSpeechApi,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
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
/** Web only; a no-op on native. Returns the uninstall function. */
export function installGestureUnlock(): () => void {
  return audio().installGestureUnlock();
}
export function warmClips(refs: readonly string[]): Promise<void> {
  return audio().warmClips(refs);
}
export function noteFallbackShown(source: string, reason: FallbackReason): void {
  audio().noteFallbackShown(source, reason);
}

export type { SpeechLang };
