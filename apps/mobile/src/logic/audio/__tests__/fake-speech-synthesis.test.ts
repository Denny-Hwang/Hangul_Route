import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FakeAudioContext,
  FakeSpeechSynthesis,
  FakeUtterance,
  makeFakeFetch,
  type FakeVoice,
} from '../../../test-support/fake-speech-synthesis';

const yuna: FakeVoice = { name: 'Yuna', lang: 'ko_KR', voiceURI: 'com.apple.voice.Yuna', localService: true, default: false };

function utterance(text: string): { u: FakeUtterance; events: string[] } {
  const u = new FakeUtterance(text);
  const events: string[] = [];
  u.onstart = () => events.push('start');
  u.onend = () => events.push('end');
  u.onerror = (e) => events.push(`error:${e.error}`);
  return { u, events };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('FakeSpeechSynthesis', () => {
  afterEach(() => vi.useRealTimers());

  it('returns no voices until setVoices (Chrome) and fires voiceschanged to listeners', () => {
    const synth = new FakeSpeechSynthesis();
    const listener = vi.fn();
    synth.addEventListener('voiceschanged', listener);
    expect(synth.getVoices()).toEqual([]);
    synth.setVoices([yuna]);
    expect(synth.getVoices()).toEqual([yuna]);
    expect(listener).not.toHaveBeenCalled();
    synth.fireVoicesChanged();
    expect(listener).toHaveBeenCalledTimes(1);
    synth.removeEventListener('voiceschanged', listener);
    synth.fireVoicesChanged();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('speaks, then ends on its own', async () => {
    const synth = new FakeSpeechSynthesis();
    const { u, events } = utterance('가');
    synth.speak(u);
    expect(synth.speaking).toBe(true);
    await flush();
    expect(events).toEqual(['start', 'end']);
    expect(synth.speaking).toBe(false);
    expect(synth.spoken).toEqual([u]);
  });

  it('queues a second utterance behind the first (pending) and runs it after', async () => {
    const synth = new FakeSpeechSynthesis();
    const a = utterance('a');
    const b = utterance('b');
    synth.speak(a.u);
    synth.speak(b.u);
    expect(synth.pending).toBe(true);
    await flush();
    expect(a.events).toEqual(['start', 'end']);
    expect(b.events).toEqual(['start', 'end']);
    expect(synth.pending).toBe(false);
  });

  it('cancel raises onerror(canceled) on the running and the queued utterance', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.autoEnd = false;
    const a = utterance('a');
    const b = utterance('b');
    synth.speak(a.u);
    synth.speak(b.u);
    await flush();
    synth.cancel();
    await flush();
    expect(a.events).toEqual(['start', 'error:canceled']);
    expect(b.events).toEqual(['error:canceled']);
    expect(synth.speaking).toBe(false);
    expect(synth.pending).toBe(false);
    expect(synth.cancelCount).toBe(1);
  });

  it('the cancel error name is configurable (WebKit uses interrupted) or can be silent', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.autoEnd = false;
    synth.cancelError = 'interrupted';
    const a = utterance('a');
    synth.speak(a.u);
    await flush();
    synth.cancel();
    await flush();
    expect(a.events).toEqual(['start', 'error:interrupted']);

    synth.cancelError = null;
    const b = utterance('b');
    synth.speak(b.u);
    await flush();
    synth.cancel();
    await flush();
    expect(b.events).toEqual(['start']);
  });

  it('requireGesture drops the first speak without any event until markUserGesture', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.requireGesture = true;
    const dropped = utterance('x');
    synth.speak(dropped.u);
    await flush();
    expect(dropped.events).toEqual([]);
    expect(synth.dropped).toEqual([dropped.u]);
    expect(synth.speaking).toBe(false);
    synth.markUserGesture();
    const ok = utterance('y');
    synth.speak(ok.u);
    await flush();
    expect(ok.events).toEqual(['start', 'end']);
  });

  it('failNext raises onerror with the given code instead of ending', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.failNext('synthesis-failed');
    const a = utterance('a');
    const b = utterance('b');
    synth.speak(a.u);
    await flush();
    expect(a.events).toEqual(['start', 'error:synthesis-failed']);
    synth.speak(b.u);
    await flush();
    expect(b.events).toEqual(['start', 'end']);
  });

  it('neverStart leaves the engine mute: no events at all', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.neverStart = true;
    const a = utterance('a');
    synth.speak(a.u);
    await flush();
    expect(a.events).toEqual([]);
    expect(synth.speaking).toBe(true);
  });

  it('endDelayMs uses timers, so fake timers control when an utterance ends', async () => {
    vi.useFakeTimers();
    const synth = new FakeSpeechSynthesis();
    synth.endDelayMs = 300;
    const a = utterance('a');
    synth.speak(a.u);
    await vi.advanceTimersByTimeAsync(299);
    expect(a.events).toEqual(['start']);
    await vi.advanceTimersByTimeAsync(1);
    expect(a.events).toEqual(['start', 'end']);
  });

  it('holdUntil keeps an utterance running until the release promise settles', async () => {
    const synth = new FakeSpeechSynthesis();
    let release: () => void = () => undefined;
    synth.holdUntil(new Promise<void>((resolve) => (release = resolve)));
    const a = utterance('a');
    synth.speak(a.u);
    await flush();
    expect(a.events).toEqual(['start']);
    release();
    await flush();
    expect(a.events).toEqual(['start', 'end']);
  });

  it('endCurrent ends a manual utterance', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.autoEnd = false;
    const a = utterance('a');
    synth.speak(a.u);
    await flush();
    synth.endCurrent();
    expect(a.events).toEqual(['start', 'end']);
    synth.endCurrent();
    expect(a.events).toEqual(['start', 'end']);
  });
});

describe('FakeSpeechSynthesis: the F-AUDIO-004 2026-10-17 engine quirks', () => {
  afterEach(() => vi.useRealTimers());

  it('startDelayMs holds the utterance (speaking and pending true) until it starts (a cold engine)', async () => {
    vi.useFakeTimers();
    const synth = new FakeSpeechSynthesis();
    synth.startDelayMs = 2000;
    synth.endDelayMs = 400;
    const a = utterance('a');
    synth.speak(a.u);
    expect(synth.speaking).toBe(true);
    expect(synth.pending).toBe(true);
    await vi.advanceTimersByTimeAsync(1999);
    expect(a.events).toEqual([]);
    expect(synth.pending).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(a.events).toEqual(['start']);
    expect(synth.pending).toBe(false);
    expect(synth.speaking).toBe(true);
    await vi.advanceTimersByTimeAsync(400);
    expect(a.events).toEqual(['start', 'end']);
    expect(synth.speaking).toBe(false);
  });

  it('a cancel during the start delay drops the held utterance with the cancel error', async () => {
    vi.useFakeTimers();
    const synth = new FakeSpeechSynthesis();
    synth.startDelayMs = 2000;
    const a = utterance('a');
    synth.speak(a.u);
    synth.cancel();
    await vi.advanceTimersByTimeAsync(3000);
    expect(a.events).toEqual(['error:canceled']);
  });

  it('a paused engine starts nothing until resume()', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.pause();
    expect(synth.paused).toBe(true);
    const a = utterance('a');
    synth.speak(a.u);
    await flush();
    expect(a.events).toEqual([]);
    expect(synth.speaking).toBe(true);
    synth.resume();
    expect(synth.paused).toBe(false);
    expect(synth.resumeCount).toBe(1);
    await flush();
    expect(a.events).toEqual(['start', 'end']);
    // resume() on a running engine only counts.
    synth.resume();
    expect(synth.resumeCount).toBe(2);
  });

  it('requireActivation refuses with onerror(not-allowed) and queues nothing until activate()', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.requireActivation = true;
    const refused = utterance('x');
    synth.speak(refused.u);
    expect(synth.speaking).toBe(false);
    await flush();
    expect(refused.events).toEqual(['error:not-allowed']);
    expect(synth.refused).toEqual([refused.u]);
    expect(synth.spoken).toEqual([]);
    synth.activate();
    const ok = utterance('y');
    synth.speak(ok.u);
    await flush();
    expect(ok.events).toEqual(['start', 'end']);
  });

  it('dropSpeakWithinMsOfCancel drops a speak made too soon after cancel(), silently', async () => {
    vi.useFakeTimers();
    const synth = new FakeSpeechSynthesis();
    synth.dropSpeakWithinMsOfCancel = 100;
    synth.cancel();
    const early = utterance('early');
    synth.speak(early.u);
    await vi.advanceTimersByTimeAsync(0);
    expect(early.events).toEqual([]);
    expect(synth.dropped).toEqual([early.u]);
    expect(synth.speaking).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    const late = utterance('late');
    synth.speak(late.u);
    await vi.advanceTimersByTimeAsync(0);
    expect(late.events).toEqual(['start', 'end']);
  });

  it('voicesLoadDelayMs makes setVoices land later, with voiceschanged', async () => {
    vi.useFakeTimers();
    const synth = new FakeSpeechSynthesis();
    const listener = vi.fn();
    synth.addEventListener('voiceschanged', listener);
    synth.voicesLoadDelayMs = 800;
    synth.setVoices([yuna]);
    expect(synth.getVoices()).toEqual([]);
    await vi.advanceTimersByTimeAsync(799);
    expect(listener).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(synth.getVoices()).toEqual([yuna]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('FakeAudioContext and makeFakeFetch', () => {
  it('resume() flips suspended to running and counts', async () => {
    const ctx = new FakeAudioContext();
    expect(ctx.state).toBe('suspended');
    await ctx.resume();
    expect(ctx.state).toBe('running');
    expect(ctx.resumeCalls).toBe(1);
  });

  it('decodeAudioData resolves, rejects or waits on demand', async () => {
    const ctx = new FakeAudioContext();
    await expect(ctx.decodeAudioData(new ArrayBuffer(4))).resolves.toEqual({ duration: 0.9, byteLength: 4 });

    ctx.decodeMode = 'reject';
    await expect(ctx.decodeAudioData(new ArrayBuffer(4))).rejects.toThrow('decode');

    ctx.decodeMode = 'manual';
    const pending = ctx.decodeAudioData(new ArrayBuffer(8));
    expect(ctx.pendingDecodes).toBe(1);
    ctx.settleDecode('ok');
    await expect(pending).resolves.toEqual({ duration: 0.9, byteLength: 8 });
    const failing = ctx.decodeAudioData(new ArrayBuffer(8));
    ctx.settleDecode('fail');
    await expect(failing).rejects.toThrow('decode');
    expect(ctx.pendingDecodes).toBe(0);
  });

  it('createBufferSource records starts and stops', () => {
    const ctx = new FakeAudioContext();
    const src = ctx.createBufferSource();
    src.start();
    src.stop();
    expect(ctx.sources).toHaveLength(1);
    expect(src.started).toBe(true);
    expect(src.stopped).toBe(true);
  });

  it('makeFakeFetch serves bytes, 404s and network errors', async () => {
    const fetchFake = makeFakeFetch({ '/a.mp3': new ArrayBuffer(3), '/b.mp3': 404, '/c.mp3': 'error' });
    const ok = await fetchFake('/a.mp3');
    expect(ok.ok).toBe(true);
    expect((await ok.arrayBuffer()).byteLength).toBe(3);
    const missing = await fetchFake('/b.mp3');
    expect(missing.ok).toBe(false);
    expect(missing.status).toBe(404);
    await expect(fetchFake('/c.mp3')).rejects.toThrow('network');
    expect((await fetchFake('/unknown.mp3')).status).toBe(404);
    expect(fetchFake.calls).toEqual(['/a.mp3', '/b.mp3', '/c.mp3', '/unknown.mp3']);
  });
});
