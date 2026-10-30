import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LISTEN_PICK_TIMING } from '../../../logic/listen-pick-flow';
import { clozeFixtureScope } from '../../../logic/cloze-pick/e2e-rounds';
import { tileId } from '../../../logic/cloze-pick/round';
import { getMessages } from '@hangul-route/i18n';
import { useAudioStore } from '../../../store/audio-store';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { ClozePickStep, FLAG_DECIDE_TIMEOUT_MS, type ClozePickRendered } from '../cloze-pick-entry';
import type { MinigameHost } from '../host';

/**
 * F-CURR-002 row CM-30, section 12.2: a `cloze-pick` step draws the game while `game.cloze-pick` is on, and with it
 * off every round renders its fallback, the shipped Listen & Pick in its text prompt mode (no speaker, no sound before
 * the answer, the Cloze heading), on the same tiles, answer, round ids and scoring. The switch is read once: a remote
 * change does not swap the game mid-round.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

// The Cloze Pick chunk carries the fixture build's e2e hook, which imports the native navigation package (no Node build).
vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: () => undefined }), StackActions: { push: () => undefined } }));
const flag = vi.hoisted(() => ({ value: false as boolean | null }));
vi.mock('../../../store/remote-config-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCurrFlagDecided: (name: string) => (name === 'game.cloze-pick' ? flag.value : null),
}));
const audio = vi.hoisted(() => ({
  playPrompt: vi.fn((_spec: { text: string }) => Promise.resolve('played' as const)),
  stop: vi.fn(),
  hasClip: vi.fn(() => false),
}));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), ...audio }));

function host() {
  const h = {
    mode: 'quest' as const,
    answers: [] as Array<[string | number, boolean, string | undefined]>,
    completes: 0,
    answer: (key: string | number, correct: boolean, meta?: { itemId?: string }) => void h.answers.push([key, correct, meta?.itemId]),
    complete: () => {
      h.completes += 1;
    },
  } satisfies MinigameHost & Record<string, unknown>;
  return h;
}

const mounted: ReactTestRenderer[] = [];
async function step(keys: Parameters<typeof clozeFixtureScope>[0], h = host()) {
  const rendered: ClozePickRendered[] = [];
  const r = await render(<ClozePickStep scope={clozeFixtureScope(keys)} host={h} onRendered={(k) => rendered.push(k)} />);
  mounted.push(r);
  // Let a chunk import settle.
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  return { r, h, rendered };
}
const tapId = async (r: ReactTestRenderer, id: string): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(100);
  });
  const node = byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

describe('game.cloze-pick off: the Listen & Pick fallback with a text prompt', () => {
  beforeEach(() => {
    flag.value = false;
  });

  it('draws no speaker and says nothing; the Cloze heading and the sentence with its gap and meaning', async () => {
    const { r, rendered } = await step(['word']);
    expect(rendered.at(-1)).toBe('listen-pick');
    expect(byTestId(r.root, 'listen-pick-speaker')).toHaveLength(0);
    expect(byTestId(r.root, 'listen-pick-hear-again')).toHaveLength(0);
    expect(byTestId(r.root, 'cloze-pick-sentence')).toHaveLength(0);
    const all = screenTexts(r.root);
    expect(all).toContain('Fill the gap');
    expect(all).not.toContain('Listen, then pick');
    expect(all).toContain('Sentence: chaegeul blank. I read a book.');
    expect(all).toContain('I read a book.');
    expect(audio.playPrompt).not.toHaveBeenCalled();
  });

  it('answers on the same round ids: a miss shows the Cloze line and says nothing, the right tile says the completed sentence', async () => {
    const { r, h } = await step(['word', 'particle']);
    await tapId(r, `listen-pick-option-${tileId('e2e-cloze-word', 1)}`);
    expect(screenTexts(r.root)).toContain('Read the sentence again. Which one fits?');
    await act(async () => {
      vi.advanceTimersByTime(LISTEN_PICK_TIMING.replayDelayMs);
    });
    expect(audio.playPrompt).not.toHaveBeenCalled();
    await tapId(r, `listen-pick-option-${tileId('e2e-cloze-word', 0)}`);
    expect(audio.playPrompt).toHaveBeenCalledTimes(1);
    expect(audio.playPrompt.mock.calls[0]?.[0]).toMatchObject({ text: '책을 읽어요.' });
    await act(async () => {
      vi.advanceTimersByTime(LISTEN_PICK_TIMING.advanceDelayMs);
    });
    // Round 2 opens with no autoplay.
    expect(audio.playPrompt).toHaveBeenCalledTimes(1);
    await tapId(r, `listen-pick-option-${tileId('e2e-cloze-particle', 0)}`);
    await act(async () => {
      vi.advanceTimersByTime(LISTEN_PICK_TIMING.advanceDelayMs);
    });
    expect(h.answers).toEqual([
      [0, false, 'e2e-cloze-word'],
      [0, true, 'e2e-cloze-word'],
      [1, true, 'e2e-cloze-particle'],
    ]);
    expect(h.completes).toBe(1);
  });

  it('with sound off, the status panel after the answer says the completed sentence once sound is turned on', async () => {
    useAudioStore.setState({ muted: true });
    try {
      audio.playPrompt.mockResolvedValueOnce('muted' as never);
      const { r } = await step(['word']);
      await tapId(r, `listen-pick-option-${tileId('e2e-cloze-word', 0)}`);
      expect(audio.playPrompt).toHaveBeenCalledTimes(1);
      const [turnOn] = buttonsNamed(r.root, getMessages('en').learner.audio.action.turn_on.cta);
      expect(turnOn).toBeDefined();
      await press(turnOn!);
      expect(audio.playPrompt).toHaveBeenCalledTimes(2);
      expect(audio.playPrompt.mock.calls[1]?.[0]).toMatchObject({ text: '책을 읽어요.' });
    } finally {
      useAudioStore.setState({ muted: false });
    }
  });

  it('a value gap keeps its card above the text prompt, so it can still be read', async () => {
    const { r } = await step(['value']);
    expect(byTestId(r.root, 'cloze-pick-fallback-realia').length).toBeGreaterThan(0);
  });

  it('waits for the stored config before it decides', async () => {
    flag.value = null;
    const { r, rendered } = await step(['word']);
    expect(byTestId(r.root, 'lesson-waiting').length).toBeGreaterThan(0);
    expect(rendered).toEqual([]);
  });

  it('a switch still undecided after its deadline counts as off: the fallback, never an endless wait', async () => {
    flag.value = null;
    const { r, rendered } = await step(['word']);
    await act(async () => {
      vi.advanceTimersByTime(FLAG_DECIDE_TIMEOUT_MS);
    });
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(0);
    expect(rendered).toEqual(['listen-pick']);
    // A late decision does not swap the step mid-round.
    flag.value = true;
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(rendered).toEqual(['listen-pick']);
  });
});

describe('game.cloze-pick on: the game from its chunk', () => {
  beforeEach(() => {
    flag.value = true;
  });

  it('loads the chunk and draws Cloze Pick, and keeps it when the switch turns off mid-step', async () => {
    const { r, rendered } = await step(['word']);
    expect(rendered.at(-1)).toBe('cloze-pick');
    expect(byTestId(r.root, 'cloze-pick-sentence').length).toBeGreaterThan(0);
    flag.value = false;
    await tapId(r, `cloze-pick-tile-${tileId('e2e-cloze-word', 1)}`);
    expect(byTestId(r.root, 'cloze-pick-sentence').length).toBeGreaterThan(0);
  });
});
