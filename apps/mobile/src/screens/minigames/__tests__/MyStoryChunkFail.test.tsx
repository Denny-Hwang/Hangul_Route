import { keysFor } from '@hangul-route/content-schema';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SENTENCE_PAUSE_MS } from '../../../logic/write-frame/flow';
import { setFirstRoundAnswerListener, useQuestRunStore, type FirstRoundAnswer } from '../../../store/quest-run-store';
import { byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { MinigameScreen } from '../MinigameScreen';

/**
 * F-CURR-002 §7.1 F8 and §10 (row CM-38) through the real host: `game.my-story` is on but the game's chunk cannot
 * load (offline before the precache filled). The step plays Write Frame on the first frame, and its answers and
 * `minigame.finished` go with the kind that was played, `write-frame` (review of PR #849).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const flag = vi.hoisted(() => ({ on: true, asked: [] as string[] }));
const track = vi.hoisted(() => vi.fn<(event: unknown) => Promise<void>>(() => Promise.resolve()));

vi.mock('../../../platform/telemetry', () => ({ track }));
vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: vi.fn(), focusForScreenReader: vi.fn() }));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), playPrompt: vi.fn(() => Promise.resolve('played')) }));
vi.mock('../../../store/remote-config-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCurrFlag: (name: string) => {
    flag.asked.push(name);
    return flag.on;
  },
}));
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});
vi.mock('../my-story-chunk', () => {
  throw new Error('the chunk is not reachable');
});
vi.mock('../TraceStrokeGame', () => ({ TraceStrokeGame: () => null }));
vi.mock('../TraceWordGame', () => ({ TraceWordGame: () => null }));
vi.mock('../../use-practice-session', () => ({ usePracticeSession: () => undefined }));
vi.mock('../../../content', () => ({
  questById: (id: string) => (id === 'q-story' ? { id, steps: [{ kind: 'apply', minigameRef: 'mg-my-story' }] } : undefined),
}));
vi.mock('../../../logic/minigame-config', async () => {
  const { FIXTURE_CHAIN } = await import('../../../logic/my-story/e2e-chain');
  return {
    scopeFor: (ref: string) => (ref === 'mg-my-story' ? { kind: 'my-story', rounds: FIXTURE_CHAIN.length, myStory: { frames: [...FIXTURE_CHAIN] } } : undefined),
  };
});
vi.mock('../../../logic/content-locale', () => ({ localizeScope: (scope: unknown) => scope, localizeQuest: (quest: unknown) => quest }));

const route = { key: 'Minigame-1', name: 'Minigame' as const, params: { questId: 'q-story', episodeId: 'e-story', stepIndex: 0 } };
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  const node = byTestId(r.root, id).find((n: ReactTestInstance) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await vi.dynamicImportSettled();
      await Promise.resolve();
    });
  }
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  setFirstRoundAnswerListener(null);
  useQuestRunStore.getState().reset();
});

describe('My Story when its chunk cannot load, through MinigameScreen (row CM-38)', () => {
  it('plays Write Frame on the first frame; answers and minigame.finished name write-frame', async () => {
    const answers: FirstRoundAnswer[] = [];
    setFirstRoundAnswerListener((a) => answers.push(a));
    useQuestRunStore.getState().beginQuest('q-story', 'e-story', 0);
    track.mockClear();
    const r = await render(<MinigameScreen route={route} onBack={() => undefined} />);
    await settle();
    expect(flag.asked).toContain('game.my-story');
    const shown = screenTexts(byTestId(r.root, 'write-frame')[0]!);
    expect(shown).toEqual(expect.arrayContaining(['Make your own sentence', '1 / 1']));
    expect(shown).not.toContain('Write your story');
    await tap(r, 'write-frame-word-2');
    for (const j of keysFor('공원')) await tap(r, `hangul-key-${j}`);
    await tap(r, 'write-frame-done');
    await act(async () => {
      vi.advanceTimersByTime(SENTENCE_PAUSE_MS);
    });
    await tap(r, 'write-frame-continue');
    expect(answers.map((a) => (a.asked.scope as { kind: string }).kind)).toEqual(['write-frame']);
    const finished = track.mock.calls.map((c) => c[0] as { name: string; payload: unknown }).filter((e) => e.name === 'minigame.finished');
    expect(finished.map((e) => e.payload)).toEqual([{ kind: 'write-frame', questId: 'q-story', stepIndex: 0 }]);
    await unmount(r);
  });
});
