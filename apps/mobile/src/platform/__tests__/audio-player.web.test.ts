import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FakeAudioContext,
  makeFakeFetch,
  type FakeFetch,
} from '../../test-support/fake-speech-synthesis';
import { createWebClipPlayer, webAudioGlobals, type WebClipEnv } from '../audio-player.web';

/** F-AUDIO-004 §3.10, AD9: web clips are fetched and decoded into Web Audio, never an <audio> element. */

const URLS: Record<string, string> = {
  'audio/jamo/giyeok.mp3': '/assets/assets/audio/jamo/giyeok.1a.mp3',
  'audio/jamo/nieun.mp3': '/assets/assets/audio/jamo/nieun.2b.mp3',
  'audio/jamo/digeut.mp3': '/assets/assets/audio/jamo/digeut.3c.mp3',
};
const bytes = (n: number): ArrayBuffer => new ArrayBuffer(n);
const ALL_FILES = Object.fromEntries(Object.values(URLS).map((u, i) => [u, bytes(100 + i)]));

/** A context that never leaves `suspended` (a page with no gesture yet on iOS / Chrome). */
class StuckContext extends FakeAudioContext {
  override resume(): Promise<void> {
    this.resumeCalls += 1;
    return Promise.resolve();
  }
}

interface Rig {
  player: ReturnType<typeof createWebClipPlayer>;
  fetch: FakeFetch;
  contexts: FakeAudioContext[];
}

function rig(
  opts: {
    files?: Record<string, ArrayBuffer | number | 'error'>;
    context?: () => FakeAudioContext;
    noWebAudio?: boolean;
    cacheSize?: number;
    cacheBytes?: number;
    loadTimeoutMs?: number;
    resumeTimeoutMs?: number;
    fetchFn?: NonNullable<WebClipEnv['fetch']>;
  } = {},
): Rig {
  const fetch = makeFakeFetch(opts.files ?? ALL_FILES);
  const contexts: FakeAudioContext[] = [];
  const make = opts.context ?? (() => new FakeAudioContext());
  const env: WebClipEnv = {
    uri: (ref) => URLS[ref] ?? null,
    fetch: opts.fetchFn ?? fetch,
    createContext: opts.noWebAudio
      ? null
      : () => {
          const ctx = make();
          contexts.push(ctx);
          return ctx as unknown as ReturnType<NonNullable<WebClipEnv['createContext']>>;
        },
    resumeTimeoutMs: opts.resumeTimeoutMs ?? 5,
    ...(opts.cacheSize === undefined ? {} : { cacheSize: opts.cacheSize }),
    ...(opts.cacheBytes === undefined ? {} : { cacheBytes: opts.cacheBytes }),
    ...(opts.loadTimeoutMs === undefined ? {} : { loadTimeoutMs: opts.loadTimeoutMs }),
  };
  return { player: createWebClipPlayer(env), fetch, contexts };
}

type Outcome = { started: boolean; result: 'done' | string | null };

function play(r: Rig, ref: string): { outcome: Outcome; handle: { stop(): void }; settled: Promise<Outcome> } {
  const outcome: Outcome = { started: false, result: null };
  let resolve: (o: Outcome) => void = () => undefined;
  const settled = new Promise<Outcome>((res) => {
    resolve = res;
  });
  const handle = r.player.play(ref, {
    onStart: () => {
      outcome.started = true;
    },
    onDone: () => {
      outcome.result = 'done';
      resolve(outcome);
    },
    onError: (reason) => {
      outcome.result = reason;
      resolve(outcome);
    },
  });
  return { outcome, handle, settled };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

const lastSource = (r: Rig) => r.contexts[0]!.sources.at(-1)!;

afterEach(() => {
  vi.useRealTimers();
});

describe('platform/audio-player.web: play', () => {
  it('fetches, decodes and starts a buffer source; done when it ends', async () => {
    const r = rig();
    r.player.unlock();
    const p = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    expect(r.fetch.calls).toEqual(['/assets/assets/audio/jamo/giyeok.1a.mp3']);
    expect(p.outcome.started).toBe(true);
    const source = lastSource(r);
    expect(source.started).toBe(true);
    expect(source.buffer).toEqual({ duration: 0.9, byteLength: 100 });
    expect(p.outcome.result).toBeNull();
    source.onended?.();
    await expect(p.settled).resolves.toEqual({ started: true, result: 'done' });
  });

  it('a ref with no bundled file is `missing`, without a fetch', async () => {
    const r = rig();
    await expect(play(r, 'audio/jamo/rieul.mp3').settled).resolves.toEqual({ started: false, result: 'missing' });
    expect(r.fetch.calls).toEqual([]);
  });

  it('a network failure or a bad status is `fetch`', async () => {
    const r = rig({ files: { [URLS['audio/jamo/giyeok.mp3']!]: 'error', [URLS['audio/jamo/nieun.mp3']!]: 404 } });
    r.player.unlock();
    await expect(play(r, 'audio/jamo/giyeok.mp3').settled).resolves.toEqual({ started: false, result: 'fetch' });
    await expect(play(r, 'audio/jamo/nieun.mp3').settled).resolves.toEqual({ started: false, result: 'fetch' });
  });

  it('bytes that do not decode are `decode`, and the next play tries again', async () => {
    const r = rig();
    r.player.unlock();
    r.contexts[0]!.decodeMode = 'reject';
    await expect(play(r, 'audio/jamo/giyeok.mp3').settled).resolves.toEqual({ started: false, result: 'decode' });
    r.contexts[0]!.decodeMode = 'resolve';
    const again = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    expect(again.outcome.started).toBe(true);
    expect(r.fetch.calls).toHaveLength(2);
  });

  it('a decoded clip is kept: the second play does not fetch again', async () => {
    const r = rig();
    r.player.unlock();
    play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    const second = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    expect(second.outcome.started).toBe(true);
    expect(r.fetch.calls).toHaveLength(1);
  });

  it('two plays of the same clip while it loads share one fetch', async () => {
    const r = rig();
    r.player.unlock();
    r.contexts[0]!.decodeMode = 'manual';
    const a = play(r, 'audio/jamo/giyeok.mp3');
    const b = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    expect(r.contexts[0]!.pendingDecodes).toBe(1);
    r.contexts[0]!.settleDecode('ok');
    await flush();
    expect(a.outcome.started && b.outcome.started).toBe(true);
    expect(r.fetch.calls).toHaveLength(1);
  });

  it('keeps at most `cacheSize` decoded clips, dropping the least recently used', async () => {
    const r = rig({ cacheSize: 2 });
    r.player.unlock();
    for (const ref of ['audio/jamo/giyeok.mp3', 'audio/jamo/nieun.mp3']) {
      play(r, ref);
      await flush();
    }
    // giyeok is used again, so nieun is the oldest when digeut arrives.
    play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    play(r, 'audio/jamo/digeut.mp3');
    await flush();
    expect(r.fetch.calls).toHaveLength(3);
    play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    expect(r.fetch.calls).toHaveLength(3);
    play(r, 'audio/jamo/nieun.mp3');
    await flush();
    expect(r.fetch.calls).toHaveLength(4);
  });

  it('defaults to a 64-clip cache', async () => {
    const r = rig();
    r.player.unlock();
    play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    expect(r.fetch.calls).toHaveLength(1);
  });
});

describe('platform/audio-player.web: the autoplay rule (AD8)', () => {
  it('before any gesture a context that will not start is `blocked`', async () => {
    const r = rig({ context: () => new StuckContext() });
    await expect(play(r, 'audio/jamo/giyeok.mp3').settled).resolves.toEqual({ started: false, result: 'blocked' });
    expect(r.contexts[0]!.resumeCalls).toBeGreaterThan(0);
    expect(r.contexts[0]!.sources).toHaveLength(0);
  });

  it('a suspended context that resumes on request plays (a page with an earlier gesture)', async () => {
    const r = rig();
    const p = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    expect(r.contexts[0]!.resumeCalls).toBe(1);
    expect(p.outcome.started).toBe(true);
  });

  it('no Web Audio at all is `blocked`', async () => {
    const r = rig({ noWebAudio: true });
    await expect(play(r, 'audio/jamo/giyeok.mp3').settled).resolves.toEqual({ started: false, result: 'blocked' });
  });

  it('a context the browser refuses to create is `blocked`', async () => {
    const r = rig({
      context: () => {
        throw new Error('NotAllowedError');
      },
    });
    await expect(play(r, 'audio/jamo/giyeok.mp3').settled).resolves.toEqual({ started: false, result: 'blocked' });
  });

  it('a source that cannot start is `blocked`', async () => {
    class BrokenSource extends FakeAudioContext {
      override createBufferSource(): never {
        throw new Error('InvalidStateError');
      }
    }
    const r = rig({ context: () => new BrokenSource() });
    r.player.unlock();
    await expect(play(r, 'audio/jamo/giyeok.mp3').settled).resolves.toEqual({ started: false, result: 'blocked' });
  });

  it('unlock creates the shared context, resumes it and starts one silent sample', () => {
    const r = rig();
    r.player.unlock();
    expect(r.contexts).toHaveLength(1);
    expect(r.contexts[0]!.resumeCalls).toBe(1);
    expect(r.contexts[0]!.sources).toHaveLength(1);
    expect(r.contexts[0]!.sources[0]!.started).toBe(true);
    r.player.unlock();
    expect(r.contexts).toHaveLength(1);
  });

  it('unlock without Web Audio, or with a context that throws, is safe', () => {
    expect(() => rig({ noWebAudio: true }).player.unlock()).not.toThrow();
    const r = rig({
      context: () => {
        throw new Error('no');
      },
    });
    expect(() => r.player.unlock()).not.toThrow();
    class NoBuffers extends FakeAudioContext {
      override createBuffer(): never {
        throw new Error('no');
      }
      override resume(): Promise<void> {
        return Promise.reject(new Error('no'));
      }
    }
    expect(() => rig({ context: () => new NoBuffers() }).player.unlock()).not.toThrow();
  });
});

describe('platform/audio-player.web: stop', () => {
  it('a play stopped while it loads never starts and never reports', async () => {
    const r = rig();
    r.player.unlock();
    r.contexts[0]!.decodeMode = 'manual';
    const p = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    p.handle.stop();
    r.contexts[0]!.settleDecode('ok');
    await flush();
    expect(p.outcome).toEqual({ started: false, result: null });
    expect(r.contexts[0]!.sources).toHaveLength(1); // the unlock sample only
  });

  it('a play stopped while it waits for the context never reports', async () => {
    vi.useFakeTimers();
    /** resume() stays pending: the play sits in the resume wait. */
    class PendingResume extends FakeAudioContext {
      override resume(): Promise<void> {
        this.resumeCalls += 1;
        return new Promise(() => undefined);
      }
    }
    const r = rig({ context: () => new PendingResume(), resumeTimeoutMs: 300 });
    const p = play(r, 'audio/jamo/giyeok.mp3');
    // The synchronous resume (in the gesture), then the loaded clip waits on a second one.
    for (let i = 0; i < 20 && r.contexts[0]!.resumeCalls < 2; i++) await vi.advanceTimersByTimeAsync(0);
    expect(r.contexts[0]!.resumeCalls).toBe(2);
    p.handle.stop();
    p.handle.stop();
    await vi.advanceTimersByTimeAsync(400);
    expect(p.outcome).toEqual({ started: false, result: null });
    expect(r.contexts[0]!.sources).toHaveLength(0);
  });

  it('stopping a playing clip stops its source and the late `ended` is ignored', async () => {
    const r = rig();
    r.player.unlock();
    const p = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    const source = lastSource(r);
    p.handle.stop();
    expect(source.stopped).toBe(true);
    source.onended?.();
    await flush();
    expect(p.outcome).toEqual({ started: true, result: null });
  });

  it('a source that throws on stop is still stopped quietly', async () => {
    const r = rig();
    r.player.unlock();
    const p = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    lastSource(r).stop = () => {
      throw new Error('InvalidStateError');
    };
    expect(() => p.handle.stop()).not.toThrow();
  });

  it('stopAll stops every clip that is loading or playing', async () => {
    const r = rig();
    r.player.unlock();
    const a = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    const playing = lastSource(r);
    r.contexts[0]!.decodeMode = 'manual';
    const b = play(r, 'audio/jamo/nieun.mp3');
    await flush();
    r.player.stopAll();
    r.contexts[0]!.settleDecode('ok');
    await flush();
    expect(playing.stopped).toBe(true);
    playing.onended?.();
    expect(a.outcome.result).toBeNull();
    expect(b.outcome).toEqual({ started: false, result: null });
  });
});

describe('platform/audio-player.web: warm', () => {
  it('fetches and decodes ahead of the round, so a play needs no fetch', async () => {
    const r = rig();
    await r.player.warm(['audio/jamo/giyeok.mp3', 'audio/jamo/nieun.mp3', 'audio/jamo/rieul.mp3']);
    expect(r.fetch.calls).toHaveLength(2);
    r.player.unlock();
    const p = play(r, 'audio/jamo/nieun.mp3');
    await flush();
    expect(p.outcome.started).toBe(true);
    expect(r.fetch.calls).toHaveLength(2);
  });

  it('swallows failures', async () => {
    const r = rig({ files: { [URLS['audio/jamo/giyeok.mp3']!]: 'error' } });
    await expect(r.player.warm(['audio/jamo/giyeok.mp3'])).resolves.toBeUndefined();
  });

  it('does nothing without Web Audio', async () => {
    const r = rig({ noWebAudio: true });
    await r.player.warm(['audio/jamo/giyeok.mp3']);
    expect(r.fetch.calls).toEqual([]);
  });

  it('does nothing without fetch', async () => {
    const contexts: FakeAudioContext[] = [];
    const player = createWebClipPlayer({
      uri: (ref) => URLS[ref] ?? null,
      fetch: null,
      createContext: () => {
        const c = new FakeAudioContext();
        contexts.push(c);
        return c as unknown as ReturnType<NonNullable<WebClipEnv['createContext']>>;
      },
    });
    await player.warm(['audio/jamo/giyeok.mp3']);
    const outcome = await new Promise<string>((resolve) => {
      player.play('audio/jamo/giyeok.mp3', { onStart: () => undefined, onDone: () => resolve('done'), onError: resolve });
    });
    expect(outcome).toBe('fetch');
  });
});

describe('platform/audio-player.web: older Safari', () => {
  it('decodes through the callback form when decodeAudioData returns nothing', async () => {
    class CallbackOnly extends FakeAudioContext {
      override decodeAudioData(data: ArrayBuffer, ok?: (b: { duration: number; byteLength: number }) => void): never {
        ok?.({ duration: 0.5, byteLength: data.byteLength });
        return undefined as never;
      }
    }
    const r = rig({ context: () => new CallbackOnly() });
    r.player.unlock();
    const p = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    expect(p.outcome.started).toBe(true);
    expect(lastSource(r).buffer).toEqual({ duration: 0.5, byteLength: 100 });
  });

  it('a decodeAudioData that throws is `decode`', async () => {
    class Throws extends FakeAudioContext {
      override decodeAudioData(): never {
        throw new Error('EncodingError');
      }
    }
    const r = rig({ context: () => new Throws() });
    r.player.unlock();
    await expect(play(r, 'audio/jamo/giyeok.mp3').settled).resolves.toEqual({ started: false, result: 'decode' });
  });
});

describe('platform/audio-player.web: webAudioGlobals', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses AudioContext, else webkitAudioContext, and the global fetch', () => {
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const g = webAudioGlobals();
    expect(g.createContext?.()).toBeInstanceOf(FakeAudioContext);
    void g.fetch?.('/x.mp3');
    expect(fetchFn).toHaveBeenCalledWith('/x.mp3');

    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', StuckContext);
    expect(webAudioGlobals().createContext?.()).toBeInstanceOf(StuckContext);
  });

  it('is null where the browser has neither', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    vi.stubGlobal('fetch', undefined);
    expect(webAudioGlobals()).toEqual({ createContext: null, fetch: null });
  });
});

describe('platform/audio-player.web: review fixes (a tap resumes, nothing hangs, memory is bounded)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a play asks a suspended context to run synchronously, inside the tap, before any await', () => {
    const r = rig();
    r.player.unlock();
    expect(r.contexts[0]!.resumeCalls).toBe(1);
    // iOS suspended the context while the page was in the background.
    r.contexts[0]!.state = 'suspended';
    play(r, 'audio/jamo/giyeok.mp3');
    expect(r.contexts[0]!.resumeCalls).toBe(2);
  });

  it('a play on a running context does not ask again', () => {
    const r = rig();
    r.player.unlock();
    play(r, 'audio/jamo/giyeok.mp3');
    expect(r.contexts[0]!.resumeCalls).toBe(1);
  });

  it('unlock leaves a running context alone and starts a suspended one again', () => {
    const r = rig();
    r.player.unlock();
    r.player.unlock();
    expect(r.contexts[0]!.resumeCalls).toBe(1);
    expect(r.contexts[0]!.sources).toHaveLength(1);
    r.contexts[0]!.state = 'suspended';
    r.player.unlock();
    expect(r.contexts[0]!.resumeCalls).toBe(2);
    expect(r.contexts[0]!.sources).toHaveLength(2);
  });

  it('a clip that does not load in time gives way to the voice (`fetch`), and the late load still fills the cache', async () => {
    vi.useFakeTimers();
    let release: () => void = () => undefined;
    const calls: string[] = [];
    const fetchFn = (url: string) => {
      calls.push(url);
      return new Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>((resolve) => {
        release = () => resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(bytes(10)) });
      });
    };
    const r = rig({ fetchFn, loadTimeoutMs: 3000 });
    r.player.unlock();
    const p = play(r, 'audio/jamo/giyeok.mp3');
    await vi.advanceTimersByTimeAsync(2999);
    expect(p.outcome.result).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(p.outcome).toEqual({ started: false, result: 'fetch' });
    release();
    await vi.advanceTimersByTimeAsync(0);
    const again = play(r, 'audio/jamo/giyeok.mp3');
    await vi.advanceTimersByTimeAsync(0);
    expect(again.outcome.started).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('a started clip whose `ended` never comes still settles after its length plus a margin', async () => {
    vi.useFakeTimers();
    const r = rig();
    r.player.unlock();
    const p = play(r, 'audio/jamo/giyeok.mp3');
    await vi.advanceTimersByTimeAsync(0);
    expect(p.outcome.started).toBe(true);
    await vi.advanceTimersByTimeAsync(900 + 1499);
    expect(p.outcome.result).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(p.outcome.result).toBe('done');
    // A late `ended` after the safety timer reports nothing more.
    lastSource(r).onended?.();
    expect(p.outcome.result).toBe('done');
  });

  it('the safety timer is cleared when the clip ends or is stopped', async () => {
    vi.useFakeTimers();
    const r = rig();
    r.player.unlock();
    const a = play(r, 'audio/jamo/giyeok.mp3');
    await vi.advanceTimersByTimeAsync(0);
    lastSource(r).onended?.();
    expect(a.outcome.result).toBe('done');
    const b = play(r, 'audio/jamo/nieun.mp3');
    await vi.advanceTimersByTimeAsync(0);
    b.handle.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(b.outcome).toEqual({ started: true, result: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('caps the decoded cache by bytes, least recently used out first', async () => {
    /** Buffers that say their size: 1000 frames, mono, float32 = 4000 bytes each. */
    class SizedContext extends FakeAudioContext {
      override decodeAudioData(data: ArrayBuffer) {
        return Promise.resolve({ duration: 0.9, byteLength: data.byteLength, length: 1000, numberOfChannels: 1 });
      }
    }
    const r = rig({ context: () => new SizedContext(), cacheBytes: 9000 });
    r.player.unlock();
    await r.player.warm(['audio/jamo/giyeok.mp3', 'audio/jamo/nieun.mp3']);
    expect(r.fetch.calls).toHaveLength(2);
    // A third clip pushes past 9000 bytes: giyeok (the oldest) goes.
    await r.player.warm(['audio/jamo/digeut.mp3']);
    await r.player.warm(['audio/jamo/nieun.mp3', 'audio/jamo/digeut.mp3']);
    expect(r.fetch.calls).toHaveLength(3);
    await r.player.warm(['audio/jamo/giyeok.mp3']);
    expect(r.fetch.calls).toHaveLength(4);
  });

  it('a clip larger than the whole cache plays but is not kept', async () => {
    class HugeContext extends FakeAudioContext {
      override decodeAudioData(data: ArrayBuffer) {
        return Promise.resolve({ duration: 0.9, byteLength: data.byteLength, length: 1_000_000, numberOfChannels: 2 });
      }
    }
    const r = rig({ context: () => new HugeContext(), cacheBytes: 1000 });
    r.player.unlock();
    const p = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    expect(p.outcome.started).toBe(true);
    await r.player.warm(['audio/jamo/giyeok.mp3']);
    expect(r.fetch.calls).toHaveLength(2);
  });

  it('an HTML page served in place of a clip (a single-page host) is `fetch`, without decoding', async () => {
    const fetchFn = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: (name: string) => (name === 'content-type' ? 'text/html; charset=utf-8' : null) },
        arrayBuffer: () => Promise.resolve(bytes(10)),
      });
    const r = rig({ fetchFn });
    r.player.unlock();
    await expect(play(r, 'audio/jamo/giyeok.mp3').settled).resolves.toEqual({ started: false, result: 'fetch' });
  });

  it('an audio content type plays', async () => {
    const fetchFn = () =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'audio/mpeg' },
        arrayBuffer: () => Promise.resolve(bytes(10)),
      });
    const r = rig({ fetchFn });
    r.player.unlock();
    const p = play(r, 'audio/jamo/giyeok.mp3');
    await flush();
    expect(p.outcome.started).toBe(true);
  });

  it('an old engine whose resume() returns nothing, or throws, is `blocked`, never a hang', async () => {
    class NoPromise extends FakeAudioContext {
      override resume(): Promise<void> {
        this.resumeCalls += 1;
        return undefined as unknown as Promise<void>;
      }
    }
    class Throws extends FakeAudioContext {
      override resume(): Promise<void> {
        this.resumeCalls += 1;
        throw new Error('InvalidStateError');
      }
    }
    for (const Ctor of [NoPromise, Throws]) {
      const r = rig({ context: () => new Ctor() });
      expect(() => r.player.unlock()).not.toThrow();
      await expect(play(r, 'audio/jamo/giyeok.mp3').settled).resolves.toEqual({ started: false, result: 'blocked' });
    }
  });
});
