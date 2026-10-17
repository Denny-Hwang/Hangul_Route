import { LectureDeckSchema } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSpeechSynthesis, FakeUtterance, type FakeVoice } from '../../test-support/fake-speech-synthesis';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));
// The module-level instance resolves bundled clips through expo-asset (a native module tree vitest cannot load).
vi.mock('expo-asset', () => ({ Asset: { fromModule: (id: number | string) => ({ uri: String(id) }) } }));
vi.mock('../telemetry', () => ({ track: vi.fn(async () => true) }));

import { RATE_BASE } from '../../logic/audio/rate';
import { lectureBundle } from '../../logic/lecture/content';
import { expandDeck } from '../../logic/lecture/deck-builder';
import { slideSound, soundPress, soundPrompt } from '../../logic/lecture/slide-view';
import { useAudioStore } from '../../store/audio-store';
import { createWebAudio, type WebAudioEnv } from '../audio.web';

/**
 * The owner report of 2026-10-17 (an Android phone, the word slide 김밥 / gimbap, Sound played
 * nothing), end to end through the web audio adapter: the presenter builds its `playPrompt` from
 * `slideSound` (PresenterApp `playSound`), and the browser engine is the fake of
 * `test-support/fake-speech-synthesis.ts` with one Korean voice, as in `audio.web.test.ts`.
 */

const KOREAN: FakeVoice = { name: 'Korean South Korea', lang: 'ko-KR', voiceURI: 'Korean South Korea', localService: true, default: false };

function rig(): { synth: FakeSpeechSynthesis; audio: ReturnType<typeof createWebAudio> } {
  const synth = new FakeSpeechSynthesis();
  synth.setVoices([KOREAN]);
  const env: WebAudioEnv = {
    synth: synth as unknown as WebAudioEnv['synth'],
    Utterance: FakeUtterance as unknown as NonNullable<WebAudioEnv['Utterance']>,
    doc: new EventTarget() as unknown as WebAudioEnv['doc'],
    win: new EventTarget() as unknown as WebAudioEnv['win'],
    isOnline: () => true,
  };
  return { synth, audio: createWebAudio(env) };
}

const deck = LectureDeckSchema.parse({
  v: 1,
  id: 'lecture:gimbap',
  title: 'Lunch box',
  createdAt: '2026-10-17T09:00:00Z',
  seed: 7,
  blocks: [{ kind: 'quest', id: 'quest:stage2-life-q1' }],
});
const gimbap = expandDeck(deck, lectureBundle('en'), { canPlayKorean: true }).slides.find((s) => s.kind === 'vocab' && s.word.ko === '김밥');

/** What PresenterApp's `playSound` asks for on this slide. */
function presenterPrompt() {
  const sound = slideSound(gimbap);
  if (!sound) throw new Error('the gimbap slide has no sound');
  return { ...soundPrompt(sound), source: 'presenter' };
}

beforeEach(() => {
  mem.clear();
  useAudioStore.setState({ muted: false, hydrated: true, levelOrder: null, lastFailure: null, unlocked: false, clips: false, tts: { state: 'unknown' } });
});

describe('Sound on the gimbap word card speaks the word (owner report 2026-10-17)', () => {
  it('speaks exactly one utterance: 김밥, ko-KR, at the word rate', async () => {
    const { synth, audio } = rig();
    await expect(audio.playPrompt(presenterPrompt())).resolves.toBe('played');
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]).toMatchObject({ text: '김밥', lang: 'ko-KR', rate: RATE_BASE.word });
    expect(synth.spoken[0]?.voice?.name).toBe('Korean South Korea');
    audio.dispose();
  });

  it('muted: an explicit press turns the device sound on, then speaks exactly once', async () => {
    const { synth, audio } = rig();
    useAudioStore.getState().setMuted(true, 'profile');
    // A muted press that did not turn sound on would say nothing (the bug class this guards).
    await expect(audio.playPrompt(presenterPrompt())).resolves.toBe('muted');
    expect(synth.spoken).toHaveLength(0);

    const press = soundPress({ hasSound: true, explicit: true, muted: useAudioStore.getState().muted, deckSound: deck.options.sound });
    expect(press).toBe('unmute-then-play');
    useAudioStore.getState().setMuted(false, 'fallback_panel');
    await expect(audio.playPrompt(presenterPrompt())).resolves.toBe('played');
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]).toMatchObject({ text: '김밥', lang: 'ko-KR', rate: RATE_BASE.word });
    expect(mem.get('device:audio')).toEqual({ muted: false });
    audio.dispose();
  });
});
