import { TAP_LOCK_MS } from '@hangul-route/design-system/tap-model';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tileId } from '../../../logic/cloze-pick/round';
import { LISTEN_PICK_TIMING } from '../../../logic/listen-pick-flow';
import { byTestId, press, render, unmount } from '../../../test-support/render';
import { MinigameScreen } from '../MinigameScreen';
import { endVoiceCheckHold } from '../../../store/audio-store';
import { SENTENCE_SOUND_MAX_MS } from '../../../logic/audio/sound-pacing';

/**
 * F-CURR-002 row CM-30 through the real quest host: a `cloze-pick` step plays its Listen & Pick fallback while
 * `game.cloze-pick` is off (the launch state: built-in pct 0, so the row merges dark), records each first answer on
 * the cloze round's own id, and `minigame.finished` names the kind it drew (no Korean, no answer).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const track = vi.hoisted(() => vi.fn<(event: unknown) => Promise<void>>(() => Promise.resolve()));
const runStore = vi.hoisted(() => ({ answers: [] as unknown[][], completes: 0 }));
const flag = vi.hoisted(() => ({ value: false as boolean | null }));

vi.mock('../../../platform/telemetry', () => ({ track }));
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
    StackActions: { push: () => undefined },
  };
});
vi.mock('../TraceStrokeGame', () => ({ TraceStrokeGame: () => null }));
vi.mock('../TraceWordGame', () => ({ TraceWordGame: () => null }));
vi.mock('../../use-practice-session', () => ({ usePracticeSession: () => undefined }));
vi.mock('../../../content', () => ({
  // The hook's reading of the course (the romanization fade) needs the two lists; this screen's course is the one quest below.
  episodesAll: [],
  questsAll: [],
  questById: (id: string) => (id === 'q-cloze' ? { id, steps: [{ kind: 'practice', minigameRef: 'mg-cloze' }] } : undefined),
}));
vi.mock('../../../logic/minigame-config', async () => {
  const { clozeFixtureScope: fixtureScope } = await import('../../../logic/cloze-pick/e2e-rounds');
  return { scopeFor: (ref: string) => (ref === 'mg-cloze' ? fixtureScope(['word']) : undefined) };
});
vi.mock('../../../logic/content-locale', () => ({ localizeScope: (scope: unknown) => scope, localizeQuest: (quest: unknown) => quest }));
vi.mock('../../../store/remote-config-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCurrFlagDecided: () => flag.value,
}));
vi.mock('../../../store/quest-run-store', () => {
  const state = {
    questId: null,
    short: undefined,
    answerRound: (...args: unknown[]) => void runStore.answers.push(args),
    markStepComplete: () => {
      runStore.completes += 1;
    },
  };
  return { useQuestRunStore: Object.assign(() => state, { getState: () => state }) };
});

const route = { key: 'Minigame-1', name: 'Minigame' as const, params: { questId: 'q-cloze', episodeId: 'e', stepIndex: 0 } };
const mounted: ReactTestRenderer[] = [];
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(TAP_LOCK_MS);
  });
  const node = byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};

const finished = (): unknown[] => track.mock.calls.map((call) => call[0] as { name: string }).filter((event) => event.name === 'minigame.finished');

/** [QS-4] The flow's delay is the least wait; the completed prompt is said to its end first, within the sentence cap. */
const afterAnswer = async (): Promise<void> => {
  expect(LISTEN_PICK_TIMING.advanceDelayMs).toBeLessThan(SENTENCE_SOUND_MAX_MS);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SENTENCE_SOUND_MAX_MS);
  });
};

beforeEach(() => {
  // The screen, not the voice check's answer hold (`use-prompt-slot.ts` settled): the fake clock never ends the check.
  endVoiceCheckHold();
  track.mockClear();
  runStore.answers = [];
  runStore.completes = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

describe('a Cloze Pick step with game.cloze-pick off', () => {
  it('plays the fallback, records first answers on the cloze round, and sends minigame.finished with the kind drawn', async () => {
    flag.value = false;
    const r = await render(<MinigameScreen route={route} onBack={() => undefined} />);
    mounted.push(r);
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    expect(byTestId(r.root, 'listen-pick-text-prompt').length).toBeGreaterThan(0);
    await tap(r, `listen-pick-option-${tileId('e2e-cloze-word', 2)}`);
    await tap(r, `listen-pick-option-${tileId('e2e-cloze-word', 0)}`);
    await afterAnswer();
    expect(runStore.answers.map((a) => [a[0], a[1], (a[2] as { itemId?: string } | undefined)?.itemId])).toEqual([
      [0, false, 'e2e-cloze-word'],
      [0, true, 'e2e-cloze-word'],
    ]);
    expect(runStore.completes).toBe(1);
    // The game's own event, once (the voice, which has no Korean voice in this lane, may report its own `audio.*` events
    // now that the screen waits for it to settle, QS-4).
    expect(finished()).toHaveLength(1);
    const event = finished()[0] as { name: string; payload: unknown };
    expect(event).toMatchObject({ name: 'minigame.finished', payload: { kind: 'listen-pick', questId: 'q-cloze', stepIndex: 0 } });
    expect(JSON.stringify(event)).not.toMatch(/[ㄱ-ㆎ가-힣]/);
  });

  it('with the switch on, the same step draws Cloze Pick and names it', async () => {
    flag.value = true;
    const r = await render(<MinigameScreen route={route} onBack={() => undefined} />);
    mounted.push(r);
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    expect(byTestId(r.root, 'cloze-pick-sentence').length).toBeGreaterThan(0);
    await tap(r, `cloze-pick-tile-${tileId('e2e-cloze-word', 0)}`);
    await afterAnswer();
    expect(finished()).toHaveLength(1);
    expect((finished()[0] as { payload: { kind: string } }).payload.kind).toBe('cloze-pick');
  });
});
