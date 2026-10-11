import type { ClipFailure, ClipPlayer } from '../logic/audio/controller';

/**
 * Web clip player (F-AUDIO-004 §3.10, AD9). A bundled recording is fetched,
 * decoded with Web Audio and played through an `AudioBufferSourceNode`, never
 * an `<audio>` element: Workbox precache responses do not honour the `Range`
 * requests Safari media elements need, and decoded bytes start at once.
 *
 * Settles each play through exactly one of `onDone` / `onError`, unless the
 * play is stopped first (then it reports nothing). Every failure is a reason,
 * never a thrown exception, so the controller can fall through to the voice.
 */

interface AudioBufferLike {
  readonly duration: number;
}

interface BufferSourceLike {
  buffer: AudioBufferLike | null;
  onended: (() => void) | null;
  connect(destination: unknown): void;
  start(when?: number): void;
  stop(): void;
}

/** The slice of `AudioContext` the player uses (old Safari: `webkitAudioContext`). */
export interface AudioContextLike {
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  /** Promise form, plus the callback form older Safari needs (it returns nothing there). */
  decodeAudioData(
    data: ArrayBuffer,
    ok?: (buffer: AudioBufferLike) => void,
    fail?: (error: unknown) => void,
  ): Promise<AudioBufferLike> | void;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): BufferSourceLike;
}

interface FetchResponseLike {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface WebClipEnv {
  /** The URL of a bundled clip, or `null` when the ref has no file. */
  uri(ref: string): string | null;
  fetch: ((url: string) => Promise<FetchResponseLike>) | null;
  /** Creates the one shared context; `null` where the browser has no Web Audio. */
  createContext: (() => AudioContextLike) | null;
  /** How long a play waits for a suspended context to start. Default 300 ms. */
  resumeTimeoutMs?: number;
  /** Decoded clips kept in memory (least recently used dropped). Default 64. */
  cacheSize?: number;
}

const DEFAULT_RESUME_TIMEOUT_MS = 300;
const DEFAULT_CACHE_SIZE = 64;

class ClipLoadError extends Error {
  constructor(readonly reason: ClipFailure) {
    super(reason);
  }
}

function decode(ctx: AudioContextLike, data: ArrayBuffer): Promise<AudioBufferLike> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (buffer: AudioBufferLike): void => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };
    const fail = (): void => {
      if (settled) return;
      settled = true;
      reject(new ClipLoadError('decode'));
    };
    try {
      const pending = ctx.decodeAudioData(data, ok, fail);
      if (pending !== undefined && typeof pending.then === 'function') pending.then(ok, fail);
    } catch {
      fail();
    }
  });
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function createWebClipPlayer(env: WebClipEnv): ClipPlayer {
  const resumeTimeoutMs = env.resumeTimeoutMs ?? DEFAULT_RESUME_TIMEOUT_MS;
  const cacheSize = env.cacheSize ?? DEFAULT_CACHE_SIZE;
  const cache = new Map<string, AudioBufferLike>();
  const loading = new Map<string, Promise<AudioBufferLike>>();
  const active = new Set<{ stop(): void }>();
  let ctx: AudioContextLike | null = null;

  const context = (): AudioContextLike | null => {
    if (ctx !== null || env.createContext === null) return ctx;
    try {
      ctx = env.createContext();
    } catch {
      ctx = null;
    }
    return ctx;
  };

  const remember = (ref: string, buffer: AudioBufferLike): void => {
    cache.delete(ref);
    cache.set(ref, buffer);
    while (cache.size > cacheSize) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  };

  /** One fetch + decode per ref at a time; a failure is not cached, so the next play tries again. */
  const load = (audio: AudioContextLike, ref: string, url: string): Promise<AudioBufferLike> => {
    const hit = cache.get(ref);
    if (hit !== undefined) {
      remember(ref, hit);
      return Promise.resolve(hit);
    }
    const inFlight = loading.get(ref);
    if (inFlight !== undefined) return inFlight;
    const doFetch = env.fetch;
    const job = (async (): Promise<AudioBufferLike> => {
      if (doFetch === null) throw new ClipLoadError('fetch');
      let data: ArrayBuffer;
      try {
        const res = await doFetch(url);
        if (!res.ok) throw new ClipLoadError('fetch');
        data = await res.arrayBuffer();
      } catch {
        throw new ClipLoadError('fetch');
      }
      const buffer = await decode(audio, data);
      remember(ref, buffer);
      return buffer;
    })();
    loading.set(ref, job);
    const done = (): void => {
      loading.delete(ref);
    };
    job.then(done, done);
    return job;
  };

  /** iOS and Chrome keep a context suspended until a gesture; ask once, briefly. */
  const running = async (audio: AudioContextLike): Promise<boolean> => {
    if (audio.state === 'running') return true;
    await Promise.race([audio.resume().catch(() => undefined), wait(resumeTimeoutMs)]);
    return audio.state === 'running';
  };

  const play: ClipPlayer['play'] = (ref, h) => {
    let stopped = false;
    let settled = false;
    let source: BufferSourceLike | null = null;

    const handle = {
      stop: (): void => {
        if (stopped) return;
        stopped = true;
        active.delete(handle);
        try {
          source?.stop();
        } catch {
          // already ended
        }
      },
    };
    const settle = (report: () => void): void => {
      if (stopped || settled) return;
      settled = true;
      active.delete(handle);
      report();
    };

    const url = env.uri(ref);
    if (url === null) {
      queueMicrotask(() => settle(() => h.onError('missing')));
      return handle;
    }
    active.add(handle);

    void (async (): Promise<void> => {
      const audio = context();
      if (audio === null) return settle(() => h.onError('blocked'));
      let buffer: AudioBufferLike;
      try {
        buffer = await load(audio, ref, url);
      } catch (err) {
        const reason: ClipFailure = err instanceof ClipLoadError ? err.reason : 'decode';
        return settle(() => h.onError(reason));
      }
      if (stopped) return;
      if (!(await running(audio))) return settle(() => h.onError('blocked'));
      if (stopped) return;
      try {
        const node = audio.createBufferSource();
        node.buffer = buffer;
        node.connect(audio.destination);
        node.onended = () => settle(() => h.onDone());
        node.start(0);
        source = node;
      } catch {
        return settle(() => h.onError('blocked'));
      }
      h.onStart();
    })();

    return handle;
  };

  return {
    play,
    warm: async (refs) => {
      const audio = context();
      if (audio === null) return;
      await Promise.all(
        refs.map((ref) => {
          const url = env.uri(ref);
          return url === null ? Promise.resolve() : load(audio, ref, url).then(
            () => undefined,
            () => undefined,
          );
        }),
      );
    },
    // Runs inside the first gesture (§3.6): start the shared context and play one silent sample.
    unlock: () => {
      const audio = context();
      if (audio === null) return;
      void audio.resume().catch(() => undefined);
      try {
        const silent = audio.createBufferSource();
        silent.buffer = audio.createBuffer(1, 1, 22050);
        silent.connect(audio.destination);
        silent.start(0);
      } catch {
        // a context that refuses the sample is handled when a clip plays
      }
    },
    stopAll: () => {
      for (const handle of [...active]) handle.stop();
    },
  };
}

/** The browser's Web Audio constructor and `fetch`, or `null` where missing. */
export function webAudioGlobals(): Pick<WebClipEnv, 'createContext' | 'fetch'> {
  const g = globalThis as unknown as {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
    fetch?: (url: string) => Promise<FetchResponseLike>;
  };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  const fetchFn = g.fetch;
  return {
    createContext: Ctor === undefined ? null : () => new Ctor(),
    fetch: fetchFn === undefined ? null : (url) => fetchFn(url),
  };
}
