import { keysFor } from '@hangul-route/content-schema';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askedOfScope } from '../../../logic/memory/resolve';
import type { MinigameScope } from '../../../logic/minigame-config';
import { SENTENCE_PAUSE_MS } from '../../../logic/write-frame/flow';
import { setFirstRoundAnswerListener, useQuestRunStore, type FirstRoundAnswer } from '../../../store/quest-run-store';
import { byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { MinigameScreen } from '../MinigameScreen';

/**
 * F-CURR-002 §12.2 and §7.1 F8 (row CM-38) through the real host: MinigameScreen on a My Story step. `game.my-story`
 * on, the game loads from its chunk and plays the chain; off (its built-in pct 0, so it merges dark), the step plays
 * Write Frame on the first frame. Test P-1 extended: two runs with different picks give identical memory answers
 * (the frame's pattern only, never a picked word) and identical telemetry (the kind and the step only).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const flag = vi.hoisted(() => ({ on: false, asked: [] as string[] }));
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
const typeWord = async (r: ReactTestRenderer, text: string): Promise<void> => {
  for (const j of keysFor(text)) await tap(r, `hangul-key-${j}`);
};
const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};
/** Waits for the chunk's dynamic import to settle. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await vi.dynamicImportSettled();
    });
  }
};
const HANGUL = /[ㄱ-ㆎ가-힣]/;

/** One run of the step: frames 1 and 2 typed with the given bank picks, frame 3 picked, then Done. */
async function run(picks: readonly [number, number, number]): Promise<{ answers: FirstRoundAnswer[]; events: unknown[] }> {
  const answers: FirstRoundAnswer[] = [];
  setFirstRoundAnswerListener((a) => answers.push(a));
  useQuestRunStore.getState().beginQuest('q-story', 'e-story', 0);
  track.mockClear();
  const r = await render(<MinigameScreen route={route} onBack={() => undefined} />);
  await settle();
  const { FIXTURE_CHAIN } = await import('../../../logic/my-story/e2e-chain');
  for (let f = 0; f < 3; f += 1) {
    await tap(r, `write-frame-word-${picks[f]}`);
    if (FIXTURE_CHAIN[f]!.entry === 'type') {
      await typeWord(r, FIXTURE_CHAIN[f]!.slots[0]!.bank[picks[f]!]!.ko);
      await tap(r, 'write-frame-done');
    }
    await advance(SENTENCE_PAUSE_MS);
  }
  await tap(r, 'my-story-done');
  await unmount(r);
  setFirstRoundAnswerListener(null);
  return { answers, events: track.mock.calls.map((c) => c[0]) };
}

beforeEach(() => {
  flag.asked = [];
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  useQuestRunStore.getState().reset();
});

describe('My Story through MinigameScreen and its switch (F-CURR-002 §12.2, row CM-38)', () => {
  it('game.my-story off (the launch state): Write Frame on the first frame, its bank and neutral option, then its own My page', async () => {
    flag.on = false;
    const r = await render(<MinigameScreen route={route} onBack={() => undefined} />);
    expect(flag.asked).toContain('game.my-story');
    const shown = screenTexts(byTestId(r.root, 'write-frame')[0]!);
    expect(shown).toEqual(expect.arrayContaining(['Make your own sentence', '1 / 1', '도서관', '시장', '공원']));
    expect(shown).not.toContain('Write your story');
    await tap(r, 'write-frame-word-2');
    await typeWord(r, '공원');
    await tap(r, 'write-frame-done');
    await advance(SENTENCE_PAUSE_MS);
    expect(screenTexts(byTestId(r.root, 'write-frame-my-page')[0]!)).toEqual(expect.arrayContaining(['저는 주말에 공원에 가요.', 'This page is just for now. It is not saved.']));
    track.mockClear();
    await tap(r, 'write-frame-continue');
    // minigame.finished names the kind that was played.
    expect(track).toHaveBeenCalledTimes(1);
    expect((track.mock.calls[0]?.[0] as { payload: unknown }).payload).toEqual({ kind: 'write-frame', questId: 'q-story', stepIndex: 0 });
    await unmount(r);
  });

  it('game.my-story on: the game loads from its chunk and plays the chain', async () => {
    flag.on = true;
    const r = await render(<MinigameScreen route={route} onBack={() => undefined} />);
    await settle();
    const shown = screenTexts(byTestId(r.root, 'write-frame')[0]!);
    expect(shown).toEqual(expect.arrayContaining(['Write your story', '1 / 3']));
    await unmount(r);
  });

  it('test P-1: different picks give the same memory answers (the frame pattern only) and the same telemetry', async () => {
    flag.on = true;
    const a = await run([0, 0, 0]);
    const b = await run([2, 1, 1]);
    const view = (answers: FirstRoundAnswer[]) =>
      answers.map((x) => ({ correct: x.correct, itemId: x.asked.itemId, asked: askedOfScope(x.asked.scope as MinigameScope, x.asked.itemId as string) }));
    expect(view(a.answers)).toEqual([
      { correct: true, itemId: 'e2e-weekend', asked: { texts: [{ ko: '저는 주말에 ___에 가요.', kind: 'pat' }], jamoIds: [], rung: 'produce' } },
      { correct: true, itemId: 'e2e-with', asked: { texts: [{ ko: '___과/와 같이 가요.', kind: 'pat' }], jamoIds: [], rung: 'produce' } },
    ]);
    expect(view(b.answers)).toEqual(view(a.answers));
    // The scope the answer carries is the step's content, the same object in both runs: no pick rides along.
    expect(b.answers.map((x) => x.asked.scope)).toEqual(a.answers.map((x) => x.asked.scope));
    expect(a.events).toEqual([{ name: 'minigame.finished', profileId: undefined, payload: { kind: 'my-story', questId: 'q-story', stepIndex: 0 } }]);
    expect(b.events).toEqual(a.events);
    expect(JSON.stringify(a.events)).not.toMatch(HANGUL);
  });
});
