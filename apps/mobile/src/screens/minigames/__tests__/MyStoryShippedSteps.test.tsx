import { keysFor } from '@hangul-route/content-schema';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SENTENCE_PAUSE_MS } from '../../../logic/write-frame/flow';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { ALL_LESSON_SCOPES, ALL_LESSON_STEPS } from '../../../content/__tests__/helpers/lesson-stages';
import { MinigameScreen } from '../MinigameScreen';

/**
 * F-CURR-002 §12.2 and the CM-38 hand-off (row CM-41 S7, the first shipped chain): every real My Story step of the
 * shipped content, rendered through MinigameScreen with `game.my-story` off (its launch state, built-in pct 0) and on.
 * Off, the step plays Write Frame on the chain's first frame, with that frame's whole bank, neutral option included,
 * and `minigame.finished` names `write-frame`; on, the chain itself loads from its chunk.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const flag = vi.hoisted(() => ({ on: false }));
const track = vi.hoisted(() => vi.fn<(event: unknown) => Promise<void>>(() => Promise.resolve()));

vi.mock('../../../platform/telemetry', () => ({ track }));
vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: vi.fn(), focusForScreenReader: vi.fn() }));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), playPrompt: vi.fn(() => Promise.resolve('played')) }));
vi.mock('../../../store/remote-config-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCurrFlag: () => flag.on,
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
vi.mock('../../../content', async () => {
  const { ALL_LESSON_STEPS: steps } = await import('../../../content/__tests__/helpers/lesson-stages');
  return { questById: (id: string) => (steps[id] ? { id, steps: steps[id] } : undefined) };
});
vi.mock('../../../logic/minigame-config', async () => {
  const { ALL_LESSON_SCOPES: scopes } = await import('../../../content/__tests__/helpers/lesson-stages');
  return { scopeFor: (ref: string) => scopes[ref] };
});
vi.mock('../../../logic/content-locale', () => ({ localizeScope: (scope: unknown) => scope, localizeQuest: (quest: unknown) => quest }));

/** Every shipped step that plays a My Story chain: its quest, its index and its scope. */
const STORY_STEPS = Object.entries(ALL_LESSON_STEPS).flatMap(([questId, steps]) =>
  steps.flatMap((step, stepIndex) => (step.minigameKind === 'my-story' && step.minigameRef ? [{ questId, stepIndex, scope: ALL_LESSON_SCOPES[step.minigameRef]! }] : [])),
);

const routeOf = (questId: string, stepIndex: number) => ({ key: 'Minigame-1', name: 'Minigame' as const, params: { questId, episodeId: 'e-story', stepIndex } });
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  const node = byTestId(r.root, id).find((n: ReactTestInstance) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
/** The two-set keyboard's shifted letters and the key each is under (KS X 5002). */
const SHIFTED: Readonly<Record<string, string>> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ', ㅒ: 'ㅐ', ㅖ: 'ㅔ' };
const typeWord = async (r: ReactTestRenderer, text: string): Promise<void> => {
  for (const j of keysFor(text)) {
    if (SHIFTED[j] !== undefined) await tap(r, 'hangul-key-shift');
    await tap(r, `hangul-key-${SHIFTED[j] ?? j}`);
  }
};
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await vi.dynamicImportSettled();
    });
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  track.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  useQuestRunStore.getState().reset();
});

describe('the shipped My Story steps through MinigameScreen (F-CURR-002 §12.2, rows CM-38 and CM-41 S7)', () => {
  it('reads the shipped chains: Stage 7 Nature, Play & Crafts, Food & Daily Life and Holidays & Traditions Volume 2, q3 Apply', () => {
    expect(STORY_STEPS.map(({ questId, stepIndex }) => `${questId} ${stepIndex}`)).toContain('quest:stage7-nature-v2-q3 3');
    // Row CM-42 S7: the rules of the learner's own game.
    expect(STORY_STEPS.map(({ questId, stepIndex }) => `${questId} ${stepIndex}`)).toContain('quest:stage7-crafts-v2-q3 3');
    // Row CM-43 S7: a recipe of the learner's own.
    expect(STORY_STEPS.map(({ questId, stepIndex }) => `${questId} ${stepIndex}`)).toContain('quest:stage7-life-v2-q3 3');
    // Row CM-45 S7: a New Year card to a receiver of the learner's choosing.
    expect(STORY_STEPS.map(({ questId, stepIndex }) => `${questId} ${stepIndex}`)).toContain('quest:stage7-rites-v2-q3 3');
    for (const { scope } of STORY_STEPS) expect(scope.kind).toBe('my-story');
  });

  it.each(STORY_STEPS.map((s) => [`${s.questId} step ${s.stepIndex}`, s] as const))(
    '%s, game.my-story off: Write Frame on the first frame with its whole bank, then its own My page',
    async (_, { questId, stepIndex, scope }) => {
      flag.on = false;
      const first = scope.myStory!.frames[0]!;
      const bank = first.slots[0]!.bank;
      const r = await render(<MinigameScreen route={routeOf(questId, stepIndex)} onBack={() => undefined} />);
      const shown = screenTexts(byTestId(r.root, 'write-frame')[0]!);
      expect(shown).toEqual(expect.arrayContaining(['Make your own sentence', '1 / 1', ...bank.map((w) => w.ko)]));
      expect(shown).not.toContain('Write your story');
      // The neutral option is drawn like the others, never first, and it is enough to finish.
      const neutral = bank.findIndex((w) => w.neutral === true);
      expect(neutral).toBeGreaterThan(0);
      await tap(r, `write-frame-word-${neutral}`);
      if (first.entry === 'type') {
        await typeWord(r, bank[neutral]!.ko);
        await tap(r, 'write-frame-done');
      }
      await act(async () => {
        vi.advanceTimersByTime(SENTENCE_PAUSE_MS);
      });
      expect(screenTexts(byTestId(r.root, 'write-frame-my-page')[0]!)).toEqual(expect.arrayContaining(['This page is just for now. It is not saved.']));
      track.mockClear();
      await tap(r, 'write-frame-continue');
      expect((track.mock.calls[0]?.[0] as { payload: unknown }).payload).toEqual({ kind: 'write-frame', questId, stepIndex });
      await unmount(r);
    },
  );

  it.each(STORY_STEPS.map((s) => [`${s.questId} step ${s.stepIndex}`, s] as const))('%s, game.my-story on: the chain loads from its chunk', async (_, { questId, stepIndex, scope }) => {
    flag.on = true;
    const r = await render(<MinigameScreen route={routeOf(questId, stepIndex)} onBack={() => undefined} />);
    await settle();
    expect(screenTexts(byTestId(r.root, 'write-frame')[0]!)).toEqual(expect.arrayContaining(['Write your story', `1 / ${scope.myStory!.frames.length}`]));
    await unmount(r);
  });
});
