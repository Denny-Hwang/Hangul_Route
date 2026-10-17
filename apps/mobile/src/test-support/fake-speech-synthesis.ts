/**
 * Test doubles for the browser speech and audio APIs (F-AUDIO-004 §5).
 *
 * Not matched by the vitest `include` and outside both coverage lanes: it is
 * a test helper, imported only from `__tests__`. It models the behaviours the
 * audit found in real browsers: an empty voice list until `voiceschanged`
 * (Chrome), a silent drop outside a user gesture (iOS Safari), `cancel()`
 * raising `onerror` (Chromium and WebKit), a mute engine, an engine failure;
 * and (F-AUDIO-004, 2026-10-17) a cold engine that holds an utterance before it
 * starts, a paused engine, Chrome's `not-allowed` refusal before any user
 * activation, a `speak()` dropped right after `cancel()`, a voice list that
 * lands late.
 *
 * Events are asynchronous like the real thing: microtasks by default, or
 * `setTimeout` when `endDelayMs > 0` so `vi.useFakeTimers()` controls them.
 */

export interface FakeVoice {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  default: boolean;
}

export interface FakeSpeechEvent {
  error?: string;
}

export class FakeUtterance {
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: FakeVoice | null = null;
  onstart: ((ev: FakeSpeechEvent) => void) | null = null;
  onend: ((ev: FakeSpeechEvent) => void) | null = null;
  onerror: ((ev: Required<FakeSpeechEvent>) => void) | null = null;
  constructor(public text: string) {}
}

type VoicesListener = () => void;

export class FakeSpeechSynthesis {
  speaking = false;
  pending = false;

  /** iOS behaviour: the first `speak` outside a gesture is dropped with no event at all. */
  requireGesture = false;
  /** When false an utterance starts but never ends on its own (use `endCurrent`). */
  autoEnd = true;
  /** Delay before an auto-ended utterance finishes; > 0 uses `setTimeout`. */
  endDelayMs = 0;
  /** Engine mute: `speak` is accepted and nothing ever happens. */
  neverStart = false;
  /** What `cancel()` raises on the running and queued utterances; `null` raises nothing. */
  cancelError: 'canceled' | 'interrupted' | null = 'canceled';
  /**
   * A cold engine (Android Chrome's Korean voice): an utterance waits this long before `onstart`,
   * with `speaking` and `pending` true meanwhile. > 0 uses `setTimeout`.
   */
  startDelayMs = 0;
  /** Chrome's autoplay rule: before `activate()` a `speak` queues nothing and raises `onerror('not-allowed')`. */
  requireActivation = false;
  /** Chromium: a `speak` within this many ms after `cancel()` is dropped with no event at all (0 = off). */
  dropSpeakWithinMsOfCancel = 0;
  /** `setVoices` lands only after this delay, then fires `voiceschanged` (Chrome's late list); 0 = at once. */
  voicesLoadDelayMs = 0;
  /** `pause()` was called and `resume()` not yet: nothing starts. */
  paused = false;
  resumeCount = 0;

  readonly spoken: FakeUtterance[] = [];
  readonly dropped: FakeUtterance[] = [];
  /** Utterances refused with `not-allowed` (`requireActivation`). */
  readonly refused: FakeUtterance[] = [];
  cancelCount = 0;

  private voices: FakeVoice[] = [];
  private readonly listeners = new Set<VoicesListener>();
  private gestured = false;
  private activated = false;
  private lastCancelAt = Number.NEGATIVE_INFINITY;
  private failure: string | null = null;
  private hold: Promise<void> | null = null;
  private current: FakeUtterance | null = null;
  /** The current utterance once its start delay is over but the engine is paused. */
  private waitingForResume: { u: FakeUtterance; failure: string | null } | null = null;
  private queue: FakeUtterance[] = [];

  /** Chrome returns `[]` until the list is loaded; tests load it with this. */
  setVoices(list: readonly FakeVoice[]): void {
    if (this.voicesLoadDelayMs > 0) {
      const next = [...list];
      setTimeout(() => {
        this.voices = next;
        this.fireVoicesChanged();
      }, this.voicesLoadDelayMs);
      return;
    }
    this.voices = [...list];
  }

  getVoices(): FakeVoice[] {
    return [...this.voices];
  }

  fireVoicesChanged(): void {
    for (const listener of [...this.listeners]) listener();
  }

  addEventListener(type: 'voiceschanged', listener: VoicesListener): void {
    if (type === 'voiceschanged') this.listeners.add(listener);
  }

  removeEventListener(type: 'voiceschanged', listener: VoicesListener): void {
    if (type === 'voiceschanged') this.listeners.delete(listener);
  }

  markUserGesture(): void {
    this.gestured = true;
  }

  /** A user activation happened (Chrome's sticky activation): `requireActivation` refuses no more. */
  activate(): void {
    this.activated = true;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.resumeCount += 1;
    this.paused = false;
    const waiting = this.waitingForResume;
    this.waitingForResume = null;
    if (waiting) queueMicrotask(() => this.start(waiting.u, waiting.failure));
  }

  /** The next utterance to start raises `onerror` with this code after `onstart`. */
  failNext(error: string): void {
    this.failure = error;
  }

  /** Auto-ended utterances end only once this promise settles. */
  holdUntil(release: Promise<void>): void {
    this.hold = release;
  }

  /** Manually end the running utterance (for `autoEnd = false`). */
  endCurrent(): void {
    if (this.current) this.end(this.current);
  }

  speak(u: FakeUtterance): void {
    if (this.requireGesture && !this.gestured) {
      this.dropped.push(u);
      return;
    }
    if (this.requireActivation && !this.activated) {
      this.refused.push(u);
      queueMicrotask(() => u.onerror?.({ error: 'not-allowed' }));
      return;
    }
    if (this.dropSpeakWithinMsOfCancel > 0 && Date.now() - this.lastCancelAt < this.dropSpeakWithinMsOfCancel) {
      this.dropped.push(u);
      return;
    }
    this.spoken.push(u);
    if (this.current) {
      this.queue.push(u);
      this.pending = true;
      return;
    }
    this.begin(u);
  }

  cancel(): void {
    this.cancelCount += 1;
    this.lastCancelAt = Date.now();
    const all = this.current ? [this.current, ...this.queue] : [...this.queue];
    this.current = null;
    this.waitingForResume = null;
    this.queue = [];
    this.speaking = false;
    this.pending = false;
    const error = this.cancelError;
    if (error === null) return;
    for (const u of all) queueMicrotask(() => u.onerror?.({ error }));
  }

  private begin(u: FakeUtterance): void {
    this.current = u;
    this.speaking = true;
    this.pending = this.queue.length > 0;
    if (this.neverStart) return;
    const failure = this.failure;
    this.failure = null;
    if (this.startDelayMs > 0) {
      // A cold engine reports the held utterance as pending until it starts.
      this.pending = true;
      setTimeout(() => this.start(u, failure), this.startDelayMs);
      return;
    }
    queueMicrotask(() => this.start(u, failure));
  }

  private start(u: FakeUtterance, failure: string | null): void {
    if (this.current !== u) return;
    if (this.paused) {
      this.waitingForResume = { u, failure };
      return;
    }
    this.pending = this.queue.length > 0;
    u.onstart?.({});
    if (failure !== null) {
      this.current = null;
      this.speaking = false;
      u.onerror?.({ error: failure });
      this.next();
      return;
    }
    if (!this.autoEnd) return;
    const hold = this.hold;
    if (hold) void hold.then(() => this.endIfCurrent(u));
    else if (this.endDelayMs > 0) setTimeout(() => this.endIfCurrent(u), this.endDelayMs);
    else queueMicrotask(() => this.endIfCurrent(u));
  }

  private endIfCurrent(u: FakeUtterance): void {
    if (this.current === u) this.end(u);
  }

  private end(u: FakeUtterance): void {
    this.current = null;
    this.speaking = false;
    u.onend?.({});
    this.next();
  }

  private next(): void {
    const upcoming = this.queue.shift();
    this.pending = this.queue.length > 0;
    if (upcoming) this.begin(upcoming);
  }
}

// ---------------------------------------------------------------------------
// Web Audio and fetch doubles for the clip player (A-6 uses these; the
// controller tests use a ClipPlayer fake and do not need them).
// ---------------------------------------------------------------------------

export interface FakeAudioBuffer {
  duration: number;
  byteLength: number;
}

export class FakeBufferSource {
  buffer: FakeAudioBuffer | null = null;
  started = false;
  stopped = false;
  onended: (() => void) | null = null;
  connect(): void {}
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
  }
}

export class FakeAudioContext {
  state: 'suspended' | 'running' = 'suspended';
  resumeCalls = 0;
  /** 'resolve' / 'reject' settle at once; 'manual' waits for `settleDecode`. */
  decodeMode: 'resolve' | 'reject' | 'manual' = 'resolve';
  readonly sources: FakeBufferSource[] = [];
  readonly destination = {};
  private readonly waiting: Array<{ resolve: (b: FakeAudioBuffer) => void; reject: (e: Error) => void; byteLength: number }> = [];

  get pendingDecodes(): number {
    return this.waiting.length;
  }

  resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = 'running';
    return Promise.resolve();
  }

  decodeAudioData(data: ArrayBuffer): Promise<FakeAudioBuffer> {
    const byteLength = data.byteLength;
    if (this.decodeMode === 'resolve') return Promise.resolve({ duration: 0.9, byteLength });
    if (this.decodeMode === 'reject') return Promise.reject(new Error('decode'));
    return new Promise((resolve, reject) => {
      this.waiting.push({ resolve, reject, byteLength });
    });
  }

  settleDecode(outcome: 'ok' | 'fail'): void {
    const next = this.waiting.shift();
    if (!next) return;
    if (outcome === 'ok') next.resolve({ duration: 0.9, byteLength: next.byteLength });
    else next.reject(new Error('decode'));
  }

  createBuffer(): FakeAudioBuffer {
    return { duration: 0, byteLength: 0 };
  }

  createBufferSource(): FakeBufferSource {
    const source = new FakeBufferSource();
    this.sources.push(source);
    return source;
  }
}

export interface FakeResponse {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type FakeFetch = ((url: string) => Promise<FakeResponse>) & { calls: string[] };

/** `files` maps a URL to bytes, an HTTP status number, or 'error' (network failure). Unknown URLs are 404. */
export function makeFakeFetch(files: Readonly<Record<string, ArrayBuffer | number | 'error'>>): FakeFetch {
  const calls: string[] = [];
  const fn = (url: string): Promise<FakeResponse> => {
    calls.push(url);
    const entry = files[url];
    if (entry === 'error') return Promise.reject(new Error('network'));
    if (entry instanceof ArrayBuffer) {
      return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(entry) });
    }
    const status = typeof entry === 'number' ? entry : 404;
    return Promise.resolve({ ok: false, status, arrayBuffer: () => Promise.reject(new Error('no body')) });
  };
  return Object.assign(fn, { calls });
}
