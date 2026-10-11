import { Asset } from 'expo-asset';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { PLAY_IN_SILENT_MODE } from '../config/audio';
import type { ClipFailure, ClipPlayer } from '../logic/audio/controller';

/**
 * Native clip player (F-AUDIO-004 §3.10). A bundled recording is made a local
 * file through expo-asset and played with expo-av, the stable audio API at
 * Expo SDK 52. Everything native sits behind `ClipPlayer`, so a move to
 * `expo-audio` at an SDK upgrade touches this one file. Metro picks
 * `audio-player.web.ts` (Web Audio) for the web build.
 *
 * The audio session is set once, when the player is created (§3.6: "once at
 * start"), so the device voice and the clips share one session from the very
 * first prompt (`expo-speech` follows the app session on iOS). The device's
 * silent switch is respected (`PLAY_IN_SILENT_MODE`, owner decision
 * 2026-10-10), prompts mix with other apps' audio, and nothing plays in the
 * background. A sound object is created per play and unloaded when it ends or
 * stops, so no native player is left holding memory.
 *
 * Settles each play through exactly one of `onDone` / `onError`, unless the
 * play is stopped first (then it reports nothing). Every native step is
 * bounded by a timeout, and every failure is a reason, never a thrown
 * exception, so the controller can always fall through to the voice. A clip
 * that fails after it was heard (`onStart`) settles as done: the prompt was
 * played, and the voice does not say it a second time.
 */

/** The slice of an expo-av playback status the player reads. */
export interface NativePlaybackStatus {
  isLoaded: boolean;
  isPlaying?: boolean;
  didJustFinish?: boolean;
  durationMillis?: number;
  positionMillis?: number;
  /** Set on an unloaded status when the player hit a fatal error. */
  error?: string;
}

/** The slice of `Audio.Sound` the player uses. */
export interface NativeSoundLike {
  playAsync(): Promise<unknown>;
  stopAsync(): Promise<unknown>;
  unloadAsync(): Promise<unknown>;
  setOnPlaybackStatusUpdate(fn: ((status: NativePlaybackStatus) => void) | null): void;
}

export interface NativeAudioMode {
  playsInSilentModeIOS: boolean;
  staysActiveInBackground: boolean;
}

export interface NativeAudioApi {
  setAudioModeAsync(mode: NativeAudioMode): Promise<void>;
  /** Loads a local file, paused; status updates go to `onStatus`. */
  createSound(uri: string, onStatus: (status: NativePlaybackStatus) => void): Promise<NativeSoundLike>;
}

export interface NativeClipEnv {
  /** The bundled module of a clip (a Metro asset id), or `null` when the ref has no file. */
  source(ref: string): number | string | null;
  /** Makes a bundled clip a local file (expo-asset) and returns its uri. */
  localUri(source: number | string): Promise<string>;
  audio: NativeAudioApi;
  /** `PLAY_IN_SILENT_MODE`: false respects the silent switch. */
  playInSilentMode: boolean;
  /** How long each load step (session, local file, then sound) may take before the voice takes over. Default 3 s. */
  loadTimeoutMs?: number;
  /** How long the native play call may take before the play is `blocked`. Default 1.5 s. */
  startTimeoutMs?: number;
}

const DEFAULT_LOAD_TIMEOUT_MS = 3000;
/** The same bound the controller gives a voice that never starts (§3.5 item 4). */
const DEFAULT_START_TIMEOUT_MS = 1500;
/** A started clip that never reports its end (an interrupted session) still settles this long after its end. */
const END_SAFETY_MS = 1500;
/** Until the clip reports its length, a play settles at the latest this long after it starts. */
const MAX_CLIP_MS = 15_000;

class ClipLoadError extends Error {
  constructor(readonly reason: ClipFailure) {
    super(reason);
  }
}

/** `work`, or a `reason` failure once `ms` passes; any rejection of `work` is that `reason` too. */
function within<T>(work: Promise<T>, ms: number, reason: ClipFailure): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ClipLoadError(reason)), ms);
  });
  return Promise.race([work.catch(() => Promise.reject(new ClipLoadError(reason))), late]).finally(() => clearTimeout(timer));
}

/** A native call as a promise: a synchronous throw becomes a rejection. */
function attempt<T>(call: () => Promise<T>): Promise<T> {
  try {
    return call();
  } catch (err) {
    return Promise.reject(err);
  }
}

/** Release a native sound; it may already be gone, so nothing here throws. */
function release(sound: NativeSoundLike, stop: boolean): void {
  try {
    sound.setOnPlaybackStatusUpdate(null);
  } catch {
    // Already released.
  }
  const unload = (): void => {
    attempt(() => sound.unloadAsync()).catch(() => undefined);
  };
  if (stop) attempt(() => sound.stopAsync()).then(unload, unload);
  else unload();
}

export function createNativeClipPlayer(env: NativeClipEnv): ClipPlayer {
  const loadTimeoutMs = env.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS;
  const startTimeoutMs = env.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;
  const uris = new Map<string, string>();
  const loading = new Map<string, Promise<string>>();
  const active = new Set<{ stop(): void }>();
  let mode: Promise<void> | null = null;

  /**
   * The session is set once. A refusal, or a call that does not answer within
   * the load timeout, is asked again at the next play; playback goes on with
   * the default session meanwhile, so a stuck session never silences prompts.
   */
  const ensureMode = (): Promise<void> => {
    if (mode !== null) return mode;
    const asked: Promise<void> = within(
      attempt(() => env.audio.setAudioModeAsync({ playsInSilentModeIOS: env.playInSilentMode, staysActiveInBackground: false })),
      loadTimeoutMs,
      'blocked',
    ).catch(() => {
      if (mode === asked) mode = null;
    });
    mode = asked;
    return asked;
  };
  void ensureMode();

  /** One local-file job per ref at a time; a failure is not kept, so the next play tries again. */
  const local = (ref: string, source: number | string): Promise<string> => {
    const hit = uris.get(ref);
    if (hit !== undefined) return Promise.resolve(hit);
    const inFlight = loading.get(ref);
    if (inFlight !== undefined) return inFlight;
    const job = attempt(() => env.localUri(source)).then((uri) => {
      uris.set(ref, uri);
      return uri;
    });
    loading.set(ref, job);
    const done = (): void => {
      loading.delete(ref);
    };
    job.then(done, done);
    return job;
  };

  const play: ClipPlayer['play'] = (ref, h) => {
    let stopped = false;
    let settled = false;
    let sound: NativeSoundLike | null = null;
    let safety: ReturnType<typeof setTimeout> | undefined;
    /** The play call was made: the safety timer runs from here. */
    let begun = false;
    /** `onStart` was reported: the learner has heard the clip. */
    let started = false;
    /** The first length the sound reported. */
    let duration: number | null = null;
    /** The safety timer is the clip's own length (armed once, never pushed back). */
    let lengthArmed = false;

    const handle = {
      stop: (): void => {
        if (stopped) return;
        stopped = true;
        clearTimeout(safety);
        active.delete(handle);
        if (sound !== null && !settled) release(sound, true);
      },
    };
    const settle = (report: () => void): void => {
      if (stopped || settled) return;
      settled = true;
      clearTimeout(safety);
      active.delete(handle);
      if (sound !== null) release(sound, false);
      report();
    };
    const armSafety = (ms: number): void => {
      clearTimeout(safety);
      safety = setTimeout(() => settle(() => h.onDone()), ms + END_SAFETY_MS);
    };
    /** Once playing, the play settles at the clip's end plus a margin, measured once from its first report. */
    const armLength = (position: number): void => {
      if (lengthArmed || duration === null) return;
      lengthArmed = true;
      armSafety(Math.max(0, duration - position));
    };

    const source = env.source(ref);
    if (source === null) {
      queueMicrotask(() => settle(() => h.onError('missing')));
      return handle;
    }
    active.add(handle);

    const onStatus = (status: NativePlaybackStatus): void => {
      if (!status.isLoaded) {
        // After the clip was heard, a fatal error ends the prompt rather than repeating it in the voice.
        if (status.error !== undefined) settle(() => (started ? h.onDone() : h.onError('decode')));
        return;
      }
      if (status.didJustFinish === true) return settle(() => h.onDone());
      if (duration === null && typeof status.durationMillis === 'number' && Number.isFinite(status.durationMillis) && status.durationMillis > 0) {
        duration = status.durationMillis;
      }
      if (begun) armLength(typeof status.positionMillis === 'number' && Number.isFinite(status.positionMillis) ? status.positionMillis : 0);
    };

    void (async (): Promise<void> => {
      await ensureMode();
      if (stopped) return;
      let created: NativeSoundLike;
      let pending: Promise<NativeSoundLike> | null = null;
      try {
        const uri = await within(local(ref, source), loadTimeoutMs, 'fetch');
        if (stopped) return;
        pending = attempt(() => env.audio.createSound(uri, (status) => onStatus(status)));
        created = await within(pending, loadTimeoutMs, 'decode');
      } catch (err) {
        // A sound that arrives after its load timed out is released at once.
        pending?.then(
          (late) => release(late, false),
          () => undefined,
        );
        const reason: ClipFailure = err instanceof ClipLoadError ? err.reason : 'decode';
        return settle(() => h.onError(reason));
      }
      if (stopped || settled) {
        release(created, false);
        return;
      }
      sound = created;
      begun = true;
      if (duration === null) armSafety(MAX_CLIP_MS);
      else armLength(0);
      try {
        // A play call the session never answers is `blocked`, like a voice that never starts.
        await within(created.playAsync(), startTimeoutMs, 'blocked');
      } catch {
        return settle(() => h.onError('blocked'));
      }
      if (stopped || settled) return;
      started = true;
      h.onStart();
    })().catch(() => settle(() => h.onError('blocked')));

    return handle;
  };

  return {
    play,
    warm: async (refs) => {
      await Promise.all(
        refs.map((ref) => {
          const source = env.source(ref);
          return source === null
            ? Promise.resolve()
            : local(ref, source).then(
                () => undefined,
                () => undefined,
              );
        }),
      );
    },
    /** Nothing to unlock on native (§3.6). */
    unlock: () => undefined,
    stopAll: () => {
      for (const handle of [...active]) handle.stop();
    },
  };
}

/** The real environment: expo-asset for the file, expo-av for the session and the sound. */
export function expoAvClipEnv(assets: Readonly<Record<string, number | string>>): NativeClipEnv {
  return {
    source: (ref) => (Object.prototype.hasOwnProperty.call(assets, ref) ? (assets[ref] ?? null) : null),
    localUri: async (source) => {
      const asset = Asset.fromModule(source);
      await asset.downloadAsync();
      return asset.localUri ?? asset.uri;
    },
    audio: {
      // The mix policy is stated, not left to expo-av's defaults: prompts mix with other apps' audio (iOS) and duck it (Android).
      setAudioModeAsync: (mode) =>
        Audio.setAudioModeAsync({
          ...mode,
          interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false,
        }),
      createSound: async (uri, onStatus) => {
        // The file is already local: no second download.
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false }, onStatus, false);
        return sound;
      },
    },
    playInSilentMode: PLAY_IN_SILENT_MODE,
  };
}
