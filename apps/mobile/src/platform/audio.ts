import type { AudioPack, SpeechLang } from '@hangul-route/content-schema';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { APP_VERSION } from '../config/app-version';
import { AUDIO_ASSETS } from '../content/__generated__/audio-assets';
import {
  attachNativeVoices,
  createCapabilityTracker,
  readNativeVoices,
  voiceAvailable,
  type AudioCapability,
  type NativeVoiceLike,
  type NetworkLike,
} from '../logic/audio/capability';
import {
  clipRefsFor,
  createAudioController,
  type AudioController,
  type ClipLookup,
  type ClipPlayer,
  type PlayResult,
  type PlaySpec,
  type TtsEngine,
  type TtsHandlers,
  type TtsRequest,
} from '../logic/audio/controller';
import type { FallbackReason } from '../logic/audio/prompt-state';
import { speakCompat, type SpeakOptions } from '../logic/audio/speak-compat';
import type { JamoQuestion, LegacyJamoMode } from '../logic/audio/jamo-voice';
import type { SpokenJamo } from '../logic/audio/spoken';
import { useAudioStore } from '../store/audio-store';
import { createNativeClipPlayer, expoAvClipEnv } from './audio-player';
import { bundledPackHas, bundledPackOf, clipsSwitchOn, packSwitchOn, primeAudioSwitches } from './audio-switches';
import { subscribeAppVisibility } from './app-visibility';
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
 * Bundled recordings (`__generated__/audio-assets.ts`) play first through the
 * expo-av clip player (`audio-player.ts`, A-7), which sets the audio session
 * from `PLAY_IN_SILENT_MODE` (`config/audio.ts`) once, when it is created
 * with the adapter (before the first prompt); a clip that fails falls through
 * to the voice. Speech has no session option of its own and follows that app
 * session, so the voice and the clips behave the same from the first prompt.
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
  /** Bundled recordings (A-7). Absent = no clip path: every prompt uses the voice. */
  clips?: NativeClipSetup;
  /** Calls `fn` each time the app leaves the foreground (the session ends: `audio.source_summary`); returns the unsubscribe. */
  onHidden?: (fn: () => void) => () => void;
}

export interface NativeClipSetup {
  player: ClipPlayer;
  /** The bundled asset map: `has(ref)`, how many clips it holds, and a clip's pack (AMENDMENTS-AUDIO-CLIPS AC-B6). */
  assets: { has(ref: string): boolean; readonly size: number; packOf?(ref: string): AudioPack | undefined; packHas?(pack: AudioPack): boolean };
  /** `flags.audioClips` and the remote `audioClips`: off switches every clip off without a code change or a release. */
  enabled(): boolean;
  /** The build ceiling and the remote `audioPack.<pack>` (AC-B8). Absent: every pack is on. */
  packEnabled?(pack: AudioPack): boolean;
}

/** The generated map, played through expo-av, under the clip switches (AC-B8, `audio-switches.ts`). */
function bundledClips(): NativeClipSetup {
  // The remote clip switches are read (stored copy, then a fetch when due) before the first prompt (AC-B8).
  primeAudioSwitches();
  const has = (ref: string): boolean => Object.prototype.hasOwnProperty.call(AUDIO_ASSETS, ref);
  return {
    player: createNativeClipPlayer(expoAvClipEnv(AUDIO_ASSETS)),
    assets: { has, size: Object.keys(AUDIO_ASSETS).length, packOf: bundledPackOf, packHas: bundledPackHas },
    enabled: clipsSwitchOn,
    packEnabled: packSwitchOn,
  };
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
  const clipSetup = env.clips ?? null;
  const clipsOn = (): boolean => clipSetup !== null && clipSetup.enabled();
  /** Clips are on and the build holds at least one. */
  const clipsLive = (): boolean => clipsOn() && (clipSetup?.assets.size ?? 0) > 0;
  const packOf = (ref: string): AudioPack | undefined => clipSetup?.assets.packOf?.(ref);
  const packEnabled = (pack: AudioPack): boolean => clipSetup?.packEnabled?.(pack) ?? true;
  /** Bundled, clips on, and its pack (if any) on now. */
  const hasClip = (ref: string | undefined): boolean => {
    if (ref === undefined || !clipsOn() || !(clipSetup?.assets.has(ref) ?? false)) return false;
    const pack = packOf(ref);
    return pack === undefined || packEnabled(pack);
  };
  /** A clip will be tried first for this prompt: its own, or the say clip of its text (`clipRefsFor`, AC-B7). */
  const hasClipFor = (spec: ClipLookup): boolean => clipRefsFor(spec).some(hasClip);
  /** Clips are on, the pack is on and the build holds at least one clip of it (AC-B6, AC-B8). */
  const hasPackClips = (pack: AudioPack): boolean => clipsOn() && packEnabled(pack) && (clipSetup?.assets.packHas?.(pack) ?? false);
  const tracker = createCapabilityTracker({ online: true, clips: clipsLive() });

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
    clips: clipSetup?.player ?? null,
    assets: { has: (ref) => clipSetup?.assets.has(ref) ?? false, packOf },
    clipsEnabled: clipsOn,
    packEnabled,
    appVersion: APP_VERSION,
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

  // The session ends when the app leaves the foreground: one `audio.source_summary` of what played (AC-B9).
  const offHidden = env.onHidden?.(() => controller.flushSourceSummary()) ?? ((): void => undefined);

  const readVoices = (): Promise<readonly NativeVoiceLike[]> => speech.getAvailableVoicesAsync();
  const detachVoices = attachNativeVoices(tracker, readVoices, platform, ASSUME_ONLINE);

  const playPrompt = (spec: PlaySpec): Promise<PlayResult> => controller.playPrompt(spec);

  return {
    playPrompt,
    playJamo: (jamo: SpokenJamo, question?: JamoQuestion | LegacyJamoMode): Promise<PlayResult> => controller.playJamo(jamo, question),
    speak: (text: string, opts: SpeakOptions = {}): void => speakCompat(playPrompt, text, opts),
    stop: (): void => controller.stop(),
    setMuted: (muted: boolean): void => store.getState().setMuted(muted, 'profile'),
    isMuted: (): boolean => store.getState().muted,
    getCapability: (): AudioCapability => tracker.get(),
    /** A voice for `lang` (the level check's instruction voice); an unknown voice list counts as available. */
    hasVoiceFor: (lang: SpeechLang): boolean => voiceAvailable(tracker.get(), tracker.ranked(lang)),
    refreshCapability: async (): Promise<void> => {
      const result = await readNativeVoices(readVoices, platform);
      tracker.setVoices(result.kind === 'voices' ? result.voices : 'no_engine');
    },
    subscribeCapability: (fn: (c: AudioCapability) => void): (() => void) => tracker.subscribe(fn),
    /** Nothing to unlock on native. */
    unlockAudio: (): void => undefined,
    installGestureUnlock: (): (() => void) => () => undefined,
    /** Make a round's clips local files ahead of time (§3.10); refs with no bundled file are skipped. */
    warmClips: (refs: readonly string[]): Promise<void> => {
      const wanted = refs.filter((ref) => hasClip(ref));
      if (clipSetup === null || wanted.length === 0) return Promise.resolve();
      return clipSetup.player.warm(wanted);
    },
    /** The ref has a bundled recording that will be tried first (the prompt slot's `hasClip`). */
    hasClip,
    /** The prompt will try a bundled clip first, its own or its text's say clip (the prompt slot's `hasClip`). */
    hasClipFor,
    /** The build holds a playable clip of this pack now (the level check's prompts, AMENDMENTS-AUDIO-CLIPS AC-B6). */
    hasPackClips,
    noteFallbackShown: (source: string, reason: FallbackReason): void => controller.noteFallbackShown(source, reason),
    dispose: (): void => {
      detachVoices();
      offCapability();
      offMute();
      offHidden();
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
    clips: bundledClips(),
    onHidden: (fn) => subscribeAppVisibility((visible) => {
      if (!visible) fn();
    }),
  });
  return instance;
}

export function playPrompt(spec: PlaySpec): Promise<PlayResult> {
  return audio().playPrompt(spec);
}
/** Say a jamo for a question (JV-A2): `'letter'` its name, `'sound'` (default) its carrier syllable; legacy `'name'` = `'letter'`. */
export function playJamo(jamo: SpokenJamo, question?: JamoQuestion | LegacyJamoMode): Promise<PlayResult> {
  return audio().playJamo(jamo, question);
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
export function hasClip(ref: string | undefined): boolean {
  return audio().hasClip(ref);
}
/** A prompt will try a bundled clip first: the record's own or the say clip of its text (AMENDMENTS-AUDIO-CLIPS AC-B7). */
export function hasClipFor(spec: ClipLookup): boolean {
  return audio().hasClipFor(spec);
}
/** A playable clip of this pack is bundled now (clips and the pack switched on). */
export function hasPackClips(pack: AudioPack): boolean {
  return audio().hasPackClips(pack);
}

export type { SpeechLang };
