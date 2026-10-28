import type { ListenPickRound } from '@hangul-route/content-schema';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { LISTEN_PICK_TIMING } from '../../../logic/listen-pick-flow';
import { byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { MinigameScreen } from '../MinigameScreen';

/**
 * F-CURR-002 row CM-3A S2 through the real quest host: a Listen & Pick Check whose rounds show their Korean prompt
 * (`promptShown`, Read Pick Meaning, the default Stage 2 Check of section 7.1) plays in Listen & Pick's text prompt
 * mode: the Korean is drawn, no speaker before the answer, the shipped "What does this mean?" heading, the picture
 * options; each first answer is recorded on the round's own id. A heard scope keeps its speaker.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const track = vi.hoisted(() => vi.fn<(event: unknown) => Promise<void>>(() => Promise.resolve()));
const runStore = vi.hoisted(() => ({ answers: [] as unknown[][], completes: 0 }));
const shown = vi.hoisted(() => ({ value: true }));

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
  questById: (id: string) => (id === 'q-read' ? { id, steps: [{ kind: 'check', minigameRef: 'mg-read' }] } : undefined),
}));
vi.mock('../../../logic/minigame-config', () => {
  const options = [
    { id: 'gureum', pictureRef: 'word:nature-cloud', labelEn: 'cloud' },
    { id: 'bi', pictureRef: 'word:nature-rain', labelEn: 'rain' },
    { id: 'baram', pictureRef: 'word:science-wind', labelEn: 'wind' },
  ];
  const round = (id: string, ko: string, romanization: string, en: string): ListenPickRound => ({
    id,
    ...(shown.value ? { promptShown: true as const } : {}),
    prompt: { ko, romanization, en },
    options,
    answerId: romanization,
  });
  return {
    scopeFor: (ref: string) => {
      if (ref !== 'mg-read') return undefined;
      const rounds = [round('pic-gureum', '구름', 'gureum', 'cloud'), round('see-baram', '바람', 'baram', 'wind')];
      return { kind: 'listen-pick', rounds: rounds.length, listenPick: { rounds } };
    },
  };
});
vi.mock('../../../logic/content-locale', () => ({ localizeScope: (scope: unknown) => scope, localizeQuest: (quest: unknown) => quest }));
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

const route = { key: 'Minigame-1', name: 'Minigame' as const, params: { questId: 'q-read', episodeId: 'e', stepIndex: 0 } };
const mounted: ReactTestRenderer[] = [];
const tap = async (r: ReactTestRenderer, id: string): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(100);
  });
  const node = byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
const mount = async (mode: 'always' | 'tap' = 'always'): Promise<ReactTestRenderer> => {
  const r = await render(
    <RomanizationModeOverride mode={mode}>
      <MinigameScreen route={route} onBack={() => undefined} />
    </RomanizationModeOverride>,
  );
  mounted.push(r);
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  return r;
};

beforeEach(() => {
  track.mockClear();
  runStore.answers = [];
  runStore.completes = 0;
  shown.value = true;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

describe('a Read Pick Meaning Check (row CM-3A S2)', () => {
  it('draws the Korean to read, no speaker, the meaning heading, and records each first answer on its round', async () => {
    const r = await mount();
    expect(byTestId(r.root, 'listen-pick-text-prompt').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'listen-pick-speaker')).toHaveLength(0);
    const texts = screenTexts(r.root);
    expect(texts).toContain('What does this mean?');
    expect(texts).toContain('구름');
    expect(texts).not.toContain('Listen, then pick');
    await tap(r, 'listen-pick-option-bi');
    await tap(r, 'listen-pick-option-gureum');
    await act(async () => {
      vi.advanceTimersByTime(LISTEN_PICK_TIMING.advanceDelayMs);
    });
    expect(screenTexts(r.root)).toContain('바람');
    await tap(r, 'listen-pick-option-baram');
    await act(async () => {
      vi.advanceTimersByTime(LISTEN_PICK_TIMING.advanceDelayMs);
    });
    expect(runStore.answers.map((a) => [a[0], a[1], (a[2] as { itemId?: string } | undefined)?.itemId])).toEqual([
      [0, false, 'pic-gureum'],
      [0, true, 'pic-gureum'],
      [1, true, 'see-baram'],
    ]);
    expect(runStore.completes).toBe(1);
    expect((track.mock.calls[0]?.[0] as { payload: { kind: string } }).payload.kind).toBe('listen-pick');
  });

  it('keeps the learner’s romanization mode: shown with "always", the Hangul alone with "tap"', async () => {
    const always = await mount('always');
    expect(screenTexts(always.root)).toContain('gureum');
    const tap = await mount('tap');
    expect(screenTexts(tap.root)).toContain('구름');
    expect(screenTexts(tap.root)).not.toContain('gureum');
  });

  it('a heard scope (no promptShown) plays as before: the speaker and "Listen, then pick"', async () => {
    shown.value = false;
    const r = await mount();
    expect(byTestId(r.root, 'listen-pick-speaker').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'listen-pick-text-prompt')).toHaveLength(0);
    expect(screenTexts(r.root)).toContain('Listen, then pick');
  });
});
