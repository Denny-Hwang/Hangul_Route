import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSpeechSynthesis, type FakeVoice } from '../../../test-support/fake-speech-synthesis';
import {
  UNKNOWN_CAPABILITY,
  attachNativeVoices,
  attachWebVoices,
  canPlayKorean,
  capabilityTelemetry,
  createCapabilityTracker,
  deriveKoVoiceStatus,
  describeKoVoice,
  nativeVoiceToCandidate,
  readNativeVoices,
  webVoiceToCandidate,
  whenVoicesReady,
  type AudioCapability,
  type NativeVoiceLike,
  type NetworkLike,
} from '../capability';
import type { VoiceCandidate } from '../voice-rank';

const cand = (over: Partial<VoiceCandidate> & Pick<VoiceCandidate, 'id' | 'name'>): VoiceCandidate => ({
  lang: 'ko-KR',
  local: true,
  isDefault: false,
  quality: 'standard',
  ...over,
});

const YUNA: FakeVoice = { name: 'Yuna', lang: 'ko_KR', voiceURI: 'com.apple.voice.compact.ko-KR.Yuna', localService: true, default: true };
const NOVELTY: FakeVoice = { name: 'Eddy (한국어(한국))', lang: 'ko_KR', voiceURI: 'eddy', localService: true, default: false };
const GOOGLE: FakeVoice = { name: 'Google 한국의', lang: 'ko-KR', voiceURI: '', localService: false, default: false };
const ENGLISH: FakeVoice = { name: 'Samantha', lang: 'en-US', voiceURI: 'sam', localService: true, default: true };

function fakeNetwork(initial: boolean): NetworkLike & { set(online: boolean): void } {
  let online = initial;
  const subs = new Set<(o: boolean) => void>();
  return {
    isOnline: () => online,
    subscribe: (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    set(next) {
      online = next;
      for (const fn of [...subs]) fn(next);
    },
  };
}

describe('deriveKoVoiceStatus', () => {
  it('ready with the best voice, its locality and quality', () => {
    const status = deriveKoVoiceStatus([cand({ id: 'a', name: 'Yuna (Premium)' }), cand({ id: 'b', name: 'Other' })], { online: true });
    expect(status).toEqual({ state: 'ready', voiceId: 'a', voiceName: 'Yuna (Premium)', local: true, quality: 'premium' });
  });

  it('a network voice is ready online with local false (null counts as not local)', () => {
    const status = deriveKoVoiceStatus([cand({ id: 'n', name: 'Google 한국의', local: null })], { online: true });
    expect(status).toMatchObject({ state: 'ready', local: false });
  });

  it('no voices at all, or only non-Korean ones, is no_korean_voice', () => {
    expect(deriveKoVoiceStatus([], { online: true })).toEqual({ state: 'none', reason: 'no_korean_voice' });
    expect(deriveKoVoiceStatus([cand({ id: 'e', name: 'Samantha', lang: 'en-US' })], { online: true })).toEqual({
      state: 'none',
      reason: 'no_korean_voice',
    });
  });

  it('only novelty voices is no_korean_voice', () => {
    expect(deriveKoVoiceStatus([cand({ id: 'x', name: 'Eddy (한국어(한국))' })], { online: true })).toEqual({
      state: 'none',
      reason: 'no_korean_voice',
    });
  });

  it('offline with only a network voice is offline_network_only', () => {
    const net = [cand({ id: 'n', name: 'Google 한국의', local: false })];
    expect(deriveKoVoiceStatus(net, { online: false })).toEqual({ state: 'none', reason: 'offline_network_only' });
    expect(deriveKoVoiceStatus(net, { online: true }).state).toBe('ready');
  });
});

describe('canPlayKorean and describeKoVoice', () => {
  const ready: AudioCapability = {
    tts: { state: 'ready', voiceId: 'a', voiceName: 'Yuna', local: true, quality: 'standard' },
    clips: false,
    unlocked: false,
  };
  it('is true with a ready voice or with bundled clips, false otherwise', () => {
    expect(canPlayKorean(ready)).toBe(true);
    expect(canPlayKorean({ ...UNKNOWN_CAPABILITY, tts: { state: 'none', reason: 'no_engine' }, clips: true })).toBe(true);
    expect(canPlayKorean({ ...UNKNOWN_CAPABILITY, tts: { state: 'none', reason: 'no_engine' } })).toBe(false);
    expect(canPlayKorean(UNKNOWN_CAPABILITY)).toBe(false);
  });

  it('describeKoVoice returns the display fields only for a ready voice', () => {
    expect(describeKoVoice(ready.tts)).toEqual({ voiceName: 'Yuna', local: true, quality: 'standard' });
    expect(describeKoVoice({ state: 'unknown' })).toBeNull();
    expect(describeKoVoice({ state: 'none', reason: 'no_engine' })).toBeNull();
  });
});

describe('voice mappers', () => {
  it('web: voiceURI is the id, falling back to the name; localService and default carry over', () => {
    expect(webVoiceToCandidate(YUNA)).toEqual({
      id: 'com.apple.voice.compact.ko-KR.Yuna',
      name: 'Yuna',
      lang: 'ko_KR',
      local: true,
      isDefault: true,
      quality: 'standard',
    });
    expect(webVoiceToCandidate(GOOGLE)).toMatchObject({ id: 'Google 한국의', local: false, isDefault: false });
  });

  it('web: a (Premium)/(향상됨) name raises the quality', () => {
    expect(webVoiceToCandidate({ ...YUNA, name: 'Yuna (Premium)' }).quality).toBe('premium');
    expect(webVoiceToCandidate({ ...YUNA, name: 'Yuna (향상됨)' }).quality).toBe('enhanced');
  });

  it('iOS: identifier is the id, always local, Enhanced maps to enhanced', () => {
    const v: NativeVoiceLike = { identifier: 'com.apple.voice.enhanced.ko-KR.Yuna', name: 'Yuna', language: 'ko-KR', quality: 'Enhanced' };
    expect(nativeVoiceToCandidate(v, 'ios')).toEqual({
      id: 'com.apple.voice.enhanced.ko-KR.Yuna',
      name: 'Yuna',
      lang: 'ko-KR',
      local: true,
      isDefault: false,
      quality: 'enhanced',
    });
    expect(nativeVoiceToCandidate({ ...v, quality: 'Default' }, 'ios').quality).toBe('standard');
  });

  it('Android: network voices are not local, "local" ones are, the rest unknown', () => {
    const base: NativeVoiceLike = { identifier: 'ko-kr-x-koc-network', name: 'ko-kr-x-koc-network', language: 'ko-KR', quality: 'Default' };
    expect(nativeVoiceToCandidate(base, 'android').local).toBe(false);
    expect(nativeVoiceToCandidate({ ...base, identifier: 'ko-kr-x-koc-local', name: 'ko-kr-x-koc-local' }, 'android').local).toBe(true);
    expect(nativeVoiceToCandidate({ ...base, identifier: 'ko-KR-language', name: 'ko-KR-language' }, 'android').local).toBeNull();
  });
});

describe('whenVoicesReady', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves at once when the list is already there', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.setVoices([YUNA]);
    await expect(whenVoicesReady(synth, { timeoutMs: 1500 })).resolves.toEqual([YUNA]);
  });

  it('waits for voiceschanged, then reads again', async () => {
    const synth = new FakeSpeechSynthesis();
    const p = whenVoicesReady(synth, { timeoutMs: 1500 });
    synth.setVoices([YUNA]);
    synth.fireVoicesChanged();
    await expect(p).resolves.toEqual([YUNA]);
  });

  it('gives up at the timeout with an empty list and leaves no listener behind', async () => {
    const synth = new FakeSpeechSynthesis();
    const p = whenVoicesReady(synth, { timeoutMs: 1500 });
    await vi.advanceTimersByTimeAsync(1500);
    await expect(p).resolves.toEqual([]);
    const spy = vi.fn();
    synth.addEventListener('voiceschanged', spy);
    synth.fireVoicesChanged();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a second voiceschanged after resolve does nothing', async () => {
    const synth = new FakeSpeechSynthesis();
    const p = whenVoicesReady(synth, { timeoutMs: 1500 });
    synth.setVoices([YUNA]);
    synth.fireVoicesChanged();
    await p;
    synth.fireVoicesChanged();
  });
});

describe('createCapabilityTracker', () => {
  it('starts unknown, notifies on change only, and stops notifying after unsubscribe', () => {
    const tracker = createCapabilityTracker({ online: true, clips: false });
    const seen: AudioCapability[] = [];
    const off = tracker.subscribe((c) => seen.push(c));
    expect(tracker.get()).toEqual(UNKNOWN_CAPABILITY);
    tracker.setVoices([cand({ id: 'a', name: 'Yuna' })]);
    tracker.setVoices([cand({ id: 'a', name: 'Yuna' })]);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.tts.state).toBe('ready');
    off();
    tracker.setOnline(false);
    tracker.setVoices([]);
    expect(seen).toHaveLength(1);
  });

  it('setVoices("no_engine") is none/no_engine, whatever came before', () => {
    const tracker = createCapabilityTracker({ online: true, clips: true });
    tracker.setVoices([cand({ id: 'a', name: 'Yuna' })]);
    tracker.setVoices('no_engine');
    expect(tracker.get().tts).toEqual({ state: 'none', reason: 'no_engine' });
    expect(tracker.ranked('ko-KR')).toEqual([]);
    expect(tracker.get().clips).toBe(true);
  });

  it('re-ranks when the network changes: offline drops the network voice, online brings it back', () => {
    const tracker = createCapabilityTracker({ online: true, clips: false });
    tracker.setVoices([cand({ id: 'n', name: 'Google 한국의', local: false })]);
    expect(tracker.get().tts.state).toBe('ready');
    tracker.setOnline(false);
    expect(tracker.get().tts).toEqual({ state: 'none', reason: 'offline_network_only' });
    expect(tracker.ranked('ko-KR')).toEqual([]);
    tracker.setOnline(true);
    expect(tracker.get().tts.state).toBe('ready');
  });

  it('markFailed removes a voice for the session and falls to the next one', () => {
    const tracker = createCapabilityTracker({ online: true, clips: false });
    tracker.setVoices([
      cand({ id: 'g', name: 'Google 한국의', local: false }),
      cand({ id: 'o', name: 'Other', local: true }),
    ]);
    expect(tracker.ranked('ko-KR').map((v) => v.id)).toEqual(['g', 'o']);
    tracker.markFailed('g');
    expect(tracker.ranked('ko-KR').map((v) => v.id)).toEqual(['o']);
    tracker.markFailed('o');
    expect(tracker.get().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });
  });

  it('clips and unlocked are plain flags with their own notifications', () => {
    const tracker = createCapabilityTracker({ online: true, clips: false });
    const seen: AudioCapability[] = [];
    tracker.subscribe((c) => seen.push(c));
    tracker.setClips(true);
    tracker.setUnlocked(true);
    tracker.setUnlocked(true);
    expect(seen).toHaveLength(2);
    expect(tracker.get()).toMatchObject({ clips: true, unlocked: true });
  });

  it('whenReady resolves at once when known, at the timeout when not, and on the first change otherwise', async () => {
    vi.useFakeTimers();
    try {
      const tracker = createCapabilityTracker({ online: true, clips: false });
      const bounded = vi.fn();
      void tracker.whenReady(1500).then(bounded);
      await vi.advanceTimersByTimeAsync(1499);
      expect(bounded).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(bounded).toHaveBeenCalledTimes(1);

      const early = vi.fn();
      void tracker.whenReady(1500).then(early);
      tracker.setVoices([]);
      await vi.advanceTimersByTimeAsync(0);
      expect(early).toHaveBeenCalledTimes(1);

      await expect(tracker.whenReady(1500)).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('attachWebVoices', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('unknown, then ready after voiceschanged', async () => {
    const synth = new FakeSpeechSynthesis();
    const tracker = createCapabilityTracker({ online: true, clips: false });
    attachWebVoices(tracker, synth, fakeNetwork(true), { timeoutMs: 1500 });
    expect(tracker.get().tts.state).toBe('unknown');
    synth.setVoices([NOVELTY, YUNA]);
    synth.fireVoicesChanged();
    await vi.advanceTimersByTimeAsync(0);
    expect(tracker.get().tts).toMatchObject({ state: 'ready', voiceName: 'Yuna', local: true });
  });

  it('is ready immediately when the list is already loaded (Safari)', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.setVoices([YUNA]);
    const tracker = createCapabilityTracker({ online: true, clips: false });
    attachWebVoices(tracker, synth, fakeNetwork(true), { timeoutMs: 1500 });
    await vi.advanceTimersByTimeAsync(0);
    expect(tracker.get().tts.state).toBe('ready');
  });

  it('times out to none/no_korean_voice, and a late voiceschanged still re-ranks', async () => {
    const synth = new FakeSpeechSynthesis();
    const tracker = createCapabilityTracker({ online: true, clips: false });
    attachWebVoices(tracker, synth, fakeNetwork(true), { timeoutMs: 1500 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(tracker.get().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });
    synth.setVoices([YUNA]);
    synth.fireVoicesChanged();
    expect(tracker.get().tts.state).toBe('ready');
  });

  it('only English and novelty voices is none/no_korean_voice', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.setVoices([ENGLISH, NOVELTY]);
    const tracker = createCapabilityTracker({ online: true, clips: false });
    attachWebVoices(tracker, synth, fakeNetwork(true), { timeoutMs: 1500 });
    await vi.advanceTimersByTimeAsync(0);
    expect(tracker.get().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });
  });

  it('a missing engine is none/no_engine', () => {
    const tracker = createCapabilityTracker({ online: true, clips: false });
    attachWebVoices(tracker, null, fakeNetwork(true), { timeoutMs: 1500 });
    expect(tracker.get().tts).toEqual({ state: 'none', reason: 'no_engine' });
  });

  it('offline + only the network voice is offline_network_only; going online makes it ready', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.setVoices([GOOGLE]);
    const net = fakeNetwork(false);
    const tracker = createCapabilityTracker({ online: false, clips: false });
    attachWebVoices(tracker, synth, net, { timeoutMs: 1500 });
    await vi.advanceTimersByTimeAsync(0);
    expect(tracker.get().tts).toEqual({ state: 'none', reason: 'offline_network_only' });
    net.set(true);
    expect(tracker.get().tts.state).toBe('ready');
    net.set(false);
    expect(tracker.get().tts).toEqual({ state: 'none', reason: 'offline_network_only' });
  });

  it('detach removes the engine and network listeners', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.setVoices([YUNA]);
    const net = fakeNetwork(true);
    const tracker = createCapabilityTracker({ online: true, clips: false });
    const detach = attachWebVoices(tracker, synth, net, { timeoutMs: 1500 });
    await vi.advanceTimersByTimeAsync(0);
    detach();
    const seen = vi.fn();
    tracker.subscribe(seen);
    synth.setVoices([]);
    synth.fireVoicesChanged();
    net.set(false);
    expect(seen).not.toHaveBeenCalled();
  });

  it('detach before the first read resolves does not apply the late result', async () => {
    const synth = new FakeSpeechSynthesis();
    const tracker = createCapabilityTracker({ online: true, clips: false });
    const detach = attachWebVoices(tracker, synth, fakeNetwork(true), { timeoutMs: 1500 });
    detach();
    synth.setVoices([YUNA]);
    synth.fireVoicesChanged();
    await vi.advanceTimersByTimeAsync(1500);
    expect(tracker.get().tts.state).toBe('unknown');
  });
});

describe('readNativeVoices and attachNativeVoices (Android retry)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const koVoice: NativeVoiceLike = { identifier: 'ko-kr-x-koc-local', name: 'ko-kr-x-koc-local', language: 'ko-KR', quality: 'Default' };

  it('returns the voices of the first non-empty read without waiting', async () => {
    const read = vi.fn(async () => [koVoice]);
    const result = await readNativeVoices(read, 'android');
    expect(result.kind).toBe('voices');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('empty, empty, filled: reads at 0, 500 and 1500 ms', async () => {
    const read = vi
      .fn<() => Promise<NativeVoiceLike[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([koVoice]);
    const p = readNativeVoices(read, 'android');
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    const result = await p;
    expect(read).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ kind: 'voices', voices: [nativeVoiceToCandidate(koVoice, 'android')] });
  });

  it('three empty reads give an empty list (not an engine failure)', async () => {
    const read = vi.fn(async () => [] as NativeVoiceLike[]);
    const p = readNativeVoices(read, 'android');
    await vi.advanceTimersByTimeAsync(1500);
    await expect(p).resolves.toEqual({ kind: 'voices', voices: [] });
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('a throwing read is no_engine at once, even on a retry', async () => {
    const first = vi.fn(async (): Promise<NativeVoiceLike[]> => {
      throw new Error('boom');
    });
    await expect(readNativeVoices(first, 'ios')).resolves.toEqual({ kind: 'no_engine' });
    const later = vi
      .fn<() => Promise<NativeVoiceLike[]>>()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('boom'));
    const p = readNativeVoices(later, 'android');
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toEqual({ kind: 'no_engine' });
  });

  it('attachNativeVoices feeds the tracker: ready, none, no_engine', async () => {
    const ok = createCapabilityTracker({ online: true, clips: false });
    attachNativeVoices(ok, async () => [{ identifier: 'v', name: 'Yuna', language: 'ko-KR', quality: 'Enhanced' }], 'ios', fakeNetwork(true));
    await vi.advanceTimersByTimeAsync(0);
    expect(ok.get().tts).toMatchObject({ state: 'ready', voiceId: 'v', quality: 'enhanced' });

    const none = createCapabilityTracker({ online: true, clips: false });
    attachNativeVoices(none, async () => [{ identifier: 'e', name: 'Samantha', language: 'en-US', quality: 'Default' }], 'ios', fakeNetwork(true));
    await vi.advanceTimersByTimeAsync(0);
    expect(none.get().tts).toEqual({ state: 'none', reason: 'no_korean_voice' });

    const broken = createCapabilityTracker({ online: true, clips: false });
    attachNativeVoices(broken, async () => { throw new Error('x'); }, 'android', fakeNetwork(true));
    await vi.advanceTimersByTimeAsync(0);
    expect(broken.get().tts).toEqual({ state: 'none', reason: 'no_engine' });
  });

  it('attachNativeVoices re-ranks on network changes and detach stops it', async () => {
    const net = fakeNetwork(true);
    const tracker = createCapabilityTracker({ online: true, clips: false });
    const detach = attachNativeVoices(
      tracker,
      async () => [{ identifier: 'ko-kr-x-koc-network', name: 'ko-kr-x-koc-network', language: 'ko-KR', quality: 'Default' }],
      'android',
      net,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(tracker.get().tts.state).toBe('ready');
    net.set(false);
    expect(tracker.get().tts).toEqual({ state: 'none', reason: 'offline_network_only' });
    detach();
    net.set(true);
    expect(tracker.get().tts.state).toBe('none');
  });

  it('detach before the voices arrive drops the result', async () => {
    const tracker = createCapabilityTracker({ online: true, clips: false });
    const detach = attachNativeVoices(tracker, async () => [koVoice], 'android', fakeNetwork(true));
    detach();
    await vi.advanceTimersByTimeAsync(2000);
    expect(tracker.get().tts.state).toBe('unknown');
  });
});

describe('capabilityTelemetry', () => {
  const ready = (quality: 'premium' | 'enhanced' | 'standard', local: boolean): AudioCapability => ({
    tts: { state: 'ready', voiceId: 'v', voiceName: 'N', local, quality },
    clips: false,
    unlocked: false,
  });

  it('is null while unknown', () => {
    expect(capabilityTelemetry(UNKNOWN_CAPABILITY, 'web')).toBeNull();
  });

  it('maps engine and koVoice classes, never carrying a voice name', () => {
    expect(capabilityTelemetry(ready('standard', true), 'ios')).toEqual({ platform: 'ios', engine: 'tts', koVoice: 'local' });
    expect(capabilityTelemetry(ready('standard', false), 'web')).toEqual({ platform: 'web', engine: 'tts', koVoice: 'network' });
    expect(capabilityTelemetry(ready('enhanced', true), 'ios')).toMatchObject({ koVoice: 'enhanced' });
    expect(capabilityTelemetry(ready('premium', true), 'android')).toMatchObject({ koVoice: 'premium' });
    expect(capabilityTelemetry({ ...ready('standard', true), clips: true }, 'web')).toMatchObject({ engine: 'clips+tts' });
  });

  it('none carries its reason; clips alone is engine clips', () => {
    expect(capabilityTelemetry({ tts: { state: 'none', reason: 'no_korean_voice' }, clips: false, unlocked: false }, 'web')).toEqual({
      platform: 'web',
      engine: 'none',
      koVoice: 'none',
      reason: 'no_korean_voice',
    });
    expect(capabilityTelemetry({ tts: { state: 'none', reason: 'no_engine' }, clips: true, unlocked: false }, 'android')).toEqual({
      platform: 'android',
      engine: 'clips',
      koVoice: 'none',
      reason: 'no_engine',
    });
  });
});
