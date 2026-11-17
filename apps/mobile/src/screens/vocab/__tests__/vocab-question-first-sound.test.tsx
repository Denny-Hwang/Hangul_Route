import { TAP_LOCK_MS } from '@hangul-route/design-system';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { topicItems } from '../../../content/vocab';
import { ANSWER_SOUND_MAX_MS } from '../../../logic/audio/reply-advance';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import { resolvePicture } from '../../../logic/picture-ref';
import { buildQuestions } from '../../../logic/vocab/question-builder';
import { QUESTION_FLOW_TIMING } from '../../../logic/vocab/question-flow';
import { endVoiceCheckHold, useAudioStore } from '../../../store/audio-store';
import { byTestId, press, render, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../../minigames/host';
import { PICTURE_CONTEXT } from '../../minigames/PictureArt';
import { VocabQuestionView } from '../VocabQuestionView';

/**
 * [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3: the vocabulary question view says the first question's word 350 ms after
 * the screen appears; a later question says its word as it opens, and a tap on the speaker is immediate.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const audio = vi.hoisted(() => ({ said: [] as string[], hold: false, pending: [] as Array<() => void> }));
vi.mock('../../../platform/audio', async (orig) => ({
  ...(await orig<object>()),
  playPrompt: (spec: { text: string }): Promise<'played'> => {
    audio.said.push(spec.text);
    if (!audio.hold) return Promise.resolve('played');
    return new Promise((resolve) => audio.pending.push(() => resolve('played')));
  },
  stop: () => undefined,
}));
vi.mock('../../../platform/screen-reader', async (orig) => ({
  ...(await orig<object>()),
  isScreenReaderEnabled: async () => false,
  subscribeScreenReader: () => () => undefined,
}));
vi.mock('../../../platform/telemetry', async (orig) => ({ ...(await orig<object>()), track: vi.fn(async () => undefined) }));

const items = topicItems('food');
const questions = buildQuestions({
  pool: items,
  universe: items,
  count: items.length,
  optionCount: 4,
  levelOrder: 1,
  boxOf: () => 2,
  seed: 7,
  canRender: (ref) => resolvePicture(ref, PICTURE_CONTEXT).kind !== 'text',
  canPlay: true,
}).filter((q) => q.format === 'audio-to-image');
const [FIRST, SECOND] = questions;
const wordOf = (q: (typeof questions)[number]): string => q.prompt.spokenKo ?? q.prompt.ko ?? '';
const host: MinigameHost = { mode: 'vocab', answer: () => undefined, complete: () => undefined };
const view = (question: (typeof questions)[number]) => (
  <VocabQuestionView question={question} mode="check" host={host} canPlay romanizationShown onAdvance={() => undefined} />
);
const tick = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const speaker = (root: ReactTestInstance): ReactTestInstance => {
  const node = byTestId(root, 'vocab-question-speaker').find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error('no speaker');
  return node;
};
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  endVoiceCheckHold();
  audio.said = [];
  audio.hold = false;
  audio.pending = [];
  useAudioStore.setState({ muted: false, unlocked: true });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

describe('[QS] the first sound question waits 350 ms for the screen (QS-3)', () => {
  it('the fixture has two sound questions', () => {
    expect(FIRST).toBeDefined();
    expect(SECOND).toBeDefined();
    expect(wordOf(FIRST!)).not.toBe('');
  });

  it('the first question says its word once the wait is over; the next question says its word as it opens', async () => {
    const r = await render(view(FIRST!));
    mounted.push(r);
    await tick(SCREEN_SETTLE_MS - 1);
    expect(audio.said).toEqual([]);
    await tick(1);
    expect(audio.said).toEqual([wordOf(FIRST!)]);
    await act(async () => {
      r.update(view(SECOND!));
    });
    await tick(0);
    expect(audio.said).toEqual([wordOf(FIRST!), wordOf(SECOND!)]);
  });

  it('a tap on the speaker during the wait plays at once, and the word is not said a second time', async () => {
    const r = await render(view(FIRST!));
    mounted.push(r);
    await tick(100);
    await press(speaker(r.root));
    expect(audio.said).toEqual([wordOf(FIRST!)]);
    await tick(2_000);
    expect(audio.said).toEqual([wordOf(FIRST!)]);
  });

  it('a view left during the wait says nothing', async () => {
    const r = await render(view(FIRST!));
    await tick(100);
    await unmount(r);
    await tick(2_000);
    expect(audio.said).toEqual([]);
  });
});

/** [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: the word that is being said ends before the next question. */
describe('[QS-4] the next question waits for the word', () => {
  const option = (root: ReactTestInstance, id: string): ReactTestInstance => {
    const node = byTestId(root, `vocab-question-option-${id}`).find((n) => typeof n.props.onClick === 'function');
    if (!node) throw new Error(`no option ${id}`);
    return node;
  };
  const answered = async (onAdvance: () => void): Promise<void> => {
    const r = await render(<VocabQuestionView question={FIRST!} mode="check" host={host} canPlay romanizationShown onAdvance={onAdvance} />);
    mounted.push(r);
    await tick(SCREEN_SETTLE_MS + TAP_LOCK_MS);
    await press(option(r.root, FIRST!.answerId));
  };

  it('held past the flow\'s delay while the word is being said, released when it ends', async () => {
    audio.hold = true;
    const advance = vi.fn();
    await answered(advance);
    await tick(QUESTION_FLOW_TIMING.checkAdvanceMs + 600);
    expect(advance).not.toHaveBeenCalled();
    for (const end of audio.pending.splice(0)) end();
    await tick(0);
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it('released at the cap when it never ends', async () => {
    audio.hold = true;
    const advance = vi.fn();
    await answered(advance);
    await tick(ANSWER_SOUND_MAX_MS - 1);
    expect(advance).not.toHaveBeenCalled();
    await tick(1);
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it('a word that has ended does not add to the flow\'s delay', async () => {
    const advance = vi.fn();
    await answered(advance);
    await tick(QUESTION_FLOW_TIMING.checkAdvanceMs);
    expect(advance).toHaveBeenCalledTimes(1);
  });
});
