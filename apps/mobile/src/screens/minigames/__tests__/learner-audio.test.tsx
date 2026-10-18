import type { ListenPickRound } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEQUENCE_LINE_GAP_MS, SEQUENCE_REPLAY_MS } from '../../../logic/story/sequence-view';
import { useAudioStore } from '../../../store/audio-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { buttonsNamed, byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { ListenPickGame } from '../ListenPickGame';
import { StorySequenceGame } from '../StorySequenceGame';

/**
 * Listen & Pick and the Story Order replay through the shipped web audio adapter over
 * FakeSpeechSynthesis (F-AUDIO-004 §3.5, §3.8): sound off shows the prompt as text with Turn sound
 * on, which plays it; the replay moves on only after a line has ended.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
// Motion allowed, so the replay moves on by itself (the render lane's default is reduced motion).
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => false }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));

const AUDIO = getMessages('en').learner.audio;
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
  useAudioStore.setState({ muted: false });
});

const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
const settle = async (ms = 20): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};
const host = (): MinigameHost => ({ mode: 'quest', answer: () => undefined, complete: () => undefined });

const word = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
const NAMU: ListenPickRound = {
  id: 'lp:word:나무',
  prompt: word('나무', 'namu', 'tree'),
  options: [
    { id: '나무', text: word('나무', 'namu', 'tree') },
    { id: '너무', text: word('너무', 'neomu', 'too much') },
  ],
  answerId: '나무',
};

describe('ListenPickGame with sound switched off', () => {
  it('shows the prompt as text with Turn sound on, and pressing it plays the prompt', async () => {
    useAudioStore.setState({ muted: true });
    const r = await render(<ListenPickGame scope={{ kind: 'listen-pick', rounds: 1, listenPick: { rounds: [NAMU] } }} host={host()} />);
    mounted.push(r);

    // The text stands in for the sound at once: the Korean, "No sound? Read it here.", why, and the action.
    expect(textOf(byTestId(r.root, 'listen-pick-prompt-text')[0]!)).toContain('나무');
    const panel = byTestId(r.root, 'listen-pick-prompt')[0]!;
    expect(textOf(panel)).toContain(AUDIO.readHere);
    expect(textOf(panel)).toContain(AUDIO.soundIsOff);
    const [action] = buttonsNamed(byTestId(r.root, 'listen-pick-prompt')[0]!, AUDIO.action.turn_on.cta);
    expect(action).toBeDefined();
    expect(rig.current!.synth.spoken).toHaveLength(0);

    await press(action!);
    await settle();
    expect(useAudioStore.getState().muted).toBe(false);
    const spoken = rig.current!.synth.spoken;
    expect(spoken.map((u) => [u.text, u.lang])).toEqual([['나무', 'ko-KR']]);
    // The text shown in this round stays (no flicker); the action is gone once the sound plays.
    expect(byTestId(r.root, 'listen-pick-prompt-text').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'listen-pick-prompt-action')).toHaveLength(0);
  });

  it('a word prompt is read at the word rate, through the listen-pick source', async () => {
    const r = await render(<ListenPickGame scope={{ kind: 'listen-pick', rounds: 1, listenPick: { rounds: [NAMU] } }} host={host()} />);
    mounted.push(r);
    await press(pressable(r.root, 'listen-pick-speaker'));
    await settle();
    expect(rig.current!.synth.spoken.map((u) => u.text)).toEqual(['나무']);
    // No fallback with a Korean voice and sound on.
    expect(byTestId(r.root, 'listen-pick-prompt-action')).toHaveLength(0);
  });
});

describe('StorySequenceGame replay', () => {
  const steps = [
    { id: 'a', labelEn: 'Hoya wakes up.', labelKo: '호야가 일어나요.', romanization: 'hoyaga ireonayo' },
    { id: 'b', labelEn: 'Hoya eats rice.', labelKo: '호야가 밥을 먹어요.', romanization: 'hoyaga bapeul meogeoyo' },
    { id: 'c', labelEn: 'Hoya goes out.', labelKo: '호야가 나가요.', romanization: 'hoyaga nagayo' },
  ];

  it('waits for the line to end, then a short gap, before the next line (never sooner than the replay interval)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    let release = (): void => undefined;
    rig.current!.synth.holdUntil(new Promise<void>((resolve) => (release = resolve)));
    const r = await render(
      <StorySequenceGame scope={{ kind: 'story-sequence', rounds: 1, storySteps: steps }} onFinish={() => undefined} sequenceId="t" nonce={1} />,
    );
    mounted.push(r);
    const now = Date.now();
    for (const [i, s] of steps.entries()) {
      vi.setSystemTime(now + (i + 1) * 1000);
      await press(pressable(r.root, `story-sequence-card-${s.id}`));
    }
    const replayKo = (): string => textOf(byTestId(r.root, 'story-sequence-replay-ko')[0]!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(replayKo()).toContain('호야가 일어나요.');
    expect(rig.current!.synth.spoken.map((u) => u.text)).toEqual(['호야가 일어나요.']);

    // The line is still being said well past the replay interval: the replay stays on it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEQUENCE_REPLAY_MS + 1000);
    });
    expect(replayKo()).toContain('호야가 일어나요.');

    // It ends (onend): the next line comes after the short gap, not before.
    rig.current!.synth.holdUntil(new Promise<void>(() => undefined));
    await act(async () => {
      release();
      await vi.advanceTimersByTimeAsync(SEQUENCE_LINE_GAP_MS - 100);
    });
    expect(replayKo()).toContain('호야가 일어나요.');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(replayKo()).toContain('호야가 밥을 먹어요.');
    expect(rig.current!.synth.spoken.map((u) => [u.text, u.lang])).toEqual([
      ['호야가 일어나요.', 'ko-KR'],
      ['호야가 밥을 먹어요.', 'ko-KR'],
    ]);
  });
});
