import type { ListenPickRound } from '@hangul-route/content-schema';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { symbolRound } from '../../../logic/stage1/hangul-check';
import { useAudioStore } from '../../../store/audio-store';
import { reviewHost, useReviewRunStore } from '../../../store/review-run-store';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, press, render, unmount } from '../../../test-support/render';
import { ListenPickGame } from '../ListenPickGame';

/**
 * The Hangul Check credits the item, not the round (AMENDMENTS-AUDIO-CLIPS M7, row JV-2): a symbol round keeps
 * its `lp:sym:` / `lp:syl:` id for the sound rate and names its item in `itemId`. ListenPickGame's answer effect
 * hands `roundItemId(round)` to the review host, so the review run records the answer under the jamo id the run
 * began with; under the round id the item would stay unanswered and the stage certificate would never come.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));

const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
  useAudioStore.setState({ muted: false });
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useReviewRunStore.getState().reset();
});

const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};

async function answerRight(round: ListenPickRound): Promise<void> {
  const r = await render(
    <ListenPickGame scope={{ kind: 'listen-pick', rounds: 1, listenPick: { rounds: [round] } }} host={reviewHost(() => undefined)} />,
  );
  mounted.push(r);
  await press(pressable(r.root, `listen-pick-option-${round.answerId}`));
}

describe('ListenPickGame in the Hangul Check credits the item id (M7)', () => {
  it.each([
    ['a letter (lp:sym:)', 'jamo:giyeok', 'lp:sym:'],
    ['a final (lp:syl:)', 'jamo:nieun-batchim', 'lp:syl:'],
  ])('%s', async (_, jamoId, prefix) => {
    const round = symbolRound(jamoId);
    expect(round.id.startsWith(prefix)).toBe(true);
    useReviewRunStore.getState().begin([jamoId]);
    await answerRight(round);
    const { answers } = useReviewRunStore.getState();
    expect(Object.keys(answers)).toEqual([jamoId]);
    expect(answers[jamoId]).toMatchObject({ first: true });
    expect(answers[round.id]).toBeUndefined();
  });
});
