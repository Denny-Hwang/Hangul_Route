import { createWebAudio, type WebAudio, type WebAudioEnv } from '../platform/audio.web';
import { useAudioStore } from '../store/audio-store';
import { FakeSpeechSynthesis, FakeUtterance, type FakeVoice } from './fake-speech-synthesis';

/**
 * The real web audio adapter and controller (F-AUDIO-004 §3.5) over `FakeSpeechSynthesis`, for the
 * screen render tests: a test mocks `platform/audio` with `rigAudio(rig)` and drives the browser
 * cases the e2e suite drives (no Korean voice, sound off, a speak dropped outside a gesture), so the
 * prompt slot, the controller's `audio.fallback_shown` and the panel are the shipped ones.
 * Test helper only: outside the vitest `include` and both coverage lanes.
 */
export const KO_VOICE: FakeVoice = { name: 'Yuna', lang: 'ko-KR', voiceURI: 'com.apple.voice.Yuna', localService: true, default: false };

class FakeDoc extends EventTarget {
  visibilityState: 'visible' | 'hidden' = 'visible';
}

export interface AudioRig {
  synth: FakeSpeechSynthesis;
  audio: WebAudio;
}

export interface AudioRigOptions {
  /** Korean voices on the device; none = the no-voice case. */
  voices?: readonly FakeVoice[];
  /** iOS: a speak outside a user gesture is dropped with no event (the blocked case). */
  requireGesture?: boolean;
}

/** A fresh adapter whose voice list is already known (the `voiceschanged` has fired). */
export function createAudioRig(opts: AudioRigOptions = {}): AudioRig {
  useAudioStore.setState({ tts: { state: 'unknown' }, clips: false, unlocked: false, lastFailure: null });
  const synth = new FakeSpeechSynthesis();
  synth.setVoices(opts.voices ?? []);
  synth.requireGesture = opts.requireGesture ?? false;
  const env: WebAudioEnv = {
    synth: synth as unknown as WebAudioEnv['synth'],
    Utterance: FakeUtterance as unknown as NonNullable<WebAudioEnv['Utterance']>,
    doc: new FakeDoc() as unknown as WebAudioEnv['doc'],
    win: new EventTarget() as unknown as WebAudioEnv['win'],
    isOnline: () => true,
  };
  const audio = createWebAudio(env);
  synth.fireVoicesChanged();
  return { synth, audio };
}

/**
 * The `platform/audio` surface a screen imports, bound to `current()` (read at call time, so a test
 * can swap the rig in `beforeEach`).
 */
export function rigAudio(current: () => AudioRig) {
  return {
    playPrompt: (spec: Parameters<WebAudio['playPrompt']>[0]) => current().audio.playPrompt(spec),
    playJamo: (...args: Parameters<WebAudio['playJamo']>) => current().audio.playJamo(...args),
    stop: () => current().audio.stop(),
    noteFallbackShown: (...args: Parameters<WebAudio['noteFallbackShown']>) => current().audio.noteFallbackShown(...args),
    hasClip: () => false,
    warmClips: () => Promise.resolve(),
  };
}
