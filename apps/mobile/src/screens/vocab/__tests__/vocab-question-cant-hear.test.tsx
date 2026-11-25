import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { topicItems } from '../../../content/vocab';
import { SCREEN_SETTLE_MS } from '../../../logic/audio/settle';
import { resolvePicture } from '../../../logic/picture-ref';
import { buildQuestions } from '../../../logic/vocab/question-builder';
import { endVoiceCheckHold, useAudioStore } from '../../../store/audio-store';
import { clearReaderLog, focusNodes, hasId, pressableById } from '../../../test-support/cant-hear-rig';
import { byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import type { MinigameHost } from '../../minigames/host';
import { PICTURE_CONTEXT } from '../../minigames/PictureArt';
import { VocabQuestionView } from '../VocabQuestionView';

/**
 * "Can't hear it?" on the vocab Speed round's sound question (AMENDMENTS-AUDIO-CANT-HEAR row CH-1b, section 3.1, test
 * 18): the Relaxed round (no clock) passes `cantHear`; Challenge mode and the quick check do not (OD-CH4). Show the
 * letters shows the word read in full (romanization always), the options stay pictures, and focus goes to the large speaker.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/audio', async (orig) => ({
  ...(await orig<object>()),
  playPrompt: (): Promise<'played'> => Promise.resolve('played'),
  stop: () => undefined,
}));
vi.mock('../../../platform/telemetry', async (orig) => ({ ...(await orig<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/device-family', () => ({ currentDeviceFamily: () => 'computer' }));
const reader = vi.hoisted(() => ({ log: [] as string[], announced: [] as string[] }));
vi.mock('../../../platform/screen-reader', async (orig) => ({
  ...(await import('../../../test-support/cant-hear-rig')).screenReaderStandIn(reader, await orig<object>()),
  isScreenReaderEnabled: async () => false,
  subscribeScreenReader: () => () => undefined,
}));
vi.mock('react-native', async (importOriginal) => (await import('../../../test-support/cant-hear-rig')).reactNativeWithModal(await importOriginal<object>()));

const T = getMessages('en').learner.audio;
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
});
const SOUND = questions.find((q) => q.format === 'audio-to-image')!;
const WORD: (typeof questions)[number] = { ...SOUND, key: 'word-question', format: 'word-to-image', prompt: { kind: 'word', ko: SOUND.prompt.ko, romanization: SOUND.prompt.romanization } };
const host: MinigameHost = { mode: 'vocab', answer: () => undefined, complete: () => undefined };
const mounted: ReactTestRenderer[] = [];

async function open(question: (typeof questions)[number], cantHear?: boolean, mode: 'speed' | 'check' = 'speed'): Promise<ReactTestRenderer> {
  const r = await render(
    <VocabQuestionView question={question} mode={mode} host={host} canPlay romanizationShown={false} onAdvance={() => undefined} {...(cantHear === undefined ? {} : { cantHear })} />,
    { createNodeMock: focusNodes(['vocab-question-speaker']) as never },
  );
  mounted.push(r);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SCREEN_SETTLE_MS);
  });
  return r;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  endVoiceCheckHold();
  useAudioStore.setState({ muted: false, showLetters: false, unlocked: true });
  clearReaderLog(reader);
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

describe('the Speed round\'s sound question, "Can\'t hear it?" (test 18)', () => {
  it('the fixture has a sound question and a word question', () => {
    expect(SOUND).toBeDefined();
    expect(WORD).toBeDefined();
  });

  it('Relaxed mode shows the link under the speaker, before the pictures', async () => {
    const r = await open(SOUND, true);
    expect(hasId(r.root, 'cant-hear')).toBe(true);
    const order = r.root.findAll((n) => typeof n.type === 'string' && ['vocab-question-speaker', 'cant-hear', 'vocab-question-options'].includes(String(n.props['data-testid'])));
    expect(order.map((n) => n.props['data-testid'])).toEqual(['vocab-question-speaker', 'cant-hear', 'vocab-question-options']);
  });

  it('Challenge mode (no prop) and the quick check have no link', async () => {
    const challenge = await open(SOUND, false);
    expect(hasId(challenge.root, 'cant-hear')).toBe(false);
    const check = await open(SOUND, undefined, 'check');
    expect(hasId(check.root, 'cant-hear')).toBe(false);
  });

  it('a word question (its Korean is already on screen) has no link even in Relaxed mode', async () => {
    const r = await open(WORD, true);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
  });

  it('Always show the letters (CH-2): Relaxed opens with the word and its romanization and no link; Challenge is a clocked drill and is left alone', async () => {
    useAudioStore.setState({ showLetters: true });
    const relaxed = await open(SOUND, true);
    const word = textOf(byTestId(relaxed.root, 'vocab-question-word')[0]!);
    expect(word).toContain(SOUND.prompt.ko!);
    expect(word).toContain(SOUND.prompt.romanization!);
    expect(hasId(relaxed.root, 'cant-hear')).toBe(false);
    const challenge = await open(SOUND, false);
    expect(hasId(challenge.root, 'vocab-question-word')).toBe(false);
  });

  it('Show the letters: focus goes to the large speaker, then the word comes up with its romanization', async () => {
    const r = await open(SOUND, true);
    expect(hasId(r.root, 'vocab-question-word')).toBe(false);
    await press(pressableById(r.root, 'cant-hear'));
    clearReaderLog(reader);
    await press(pressableById(r.root, 'cant-hear-show-letters'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(reader.log).toEqual(['focus:vocab-question-speaker']);
    expect(hasId(r.root, 'vocab-question-word')).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(320);
    });
    const word = textOf(byTestId(r.root, 'vocab-question-word')[0]!);
    expect(word).toContain(SOUND.prompt.ko!);
    expect(word).toContain(SOUND.prompt.romanization!);
    expect(textOf(byTestId(r.root, 'vocab-question-text-prompt')[0]!)).toContain(T.readHere);
    expect(hasId(r.root, 'cant-hear')).toBe(false);
    // The options are still the pictures.
    expect(byTestId(r.root, 'vocab-question-options').length).toBeGreaterThan(0);
  });
});
