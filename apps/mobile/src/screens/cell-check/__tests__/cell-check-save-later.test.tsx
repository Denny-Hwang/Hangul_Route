import type { Profile } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { resetRemoteConfigForTests } from '../../../store/remote-config-store';
import { byTestId, cleanup, press, render, resetPlatform, screenTexts } from '../../../test-support/render';

/**
 * AMENDMENTS-QUEST-LEAVE-RESUME OD-LR8 (row LR-4, test 28): the Cell Check's result shows the words Results shows
 * (`learner.results.saveLater`) under the stars while the learner's progress write is waiting, and nothing otherwise.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useIsFocused: () => true,
    useNavigation: () => ({ navigate: () => undefined, goBack: () => undefined }),
  };
});
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => true }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../store/tier-store', async (importOriginal) => ({ ...(await importOriginal<object>()), useQuestAccess: () => () => true }));
vi.mock('../../reviews/DailyReviewRoute', async () => {
  const { createElement } = await import('react');
  return {
    dailyReviewChunk: async () => ({
      TopRow: () => createElement('div', { 'data-testid': 'top-row' }),
      DisplayHeadline: ({ children, testID }: { children?: unknown; testID?: string }) => createElement('div', { 'data-testid': testID }, children as never),
      RoundView: ({ onFirst, onSolved }: { onFirst: (a: { correct: boolean }) => void; onSolved: () => void }) =>
        createElement('button', { 'data-testid': 'round-stub', role: 'button', onClick: () => (onFirst({ correct: true }), onSolved()) }, 'answer'),
    }),
  };
});
const ROUND = {
  type: 'pick',
  heard: false,
  ask: 'meaning',
  prompt: { ko: '산', romanization: 'san' },
  options: [{ id: 'lex:w0', label: 'a' }, { id: 'lex:w1', label: 'b' }],
  answerId: 'lex:w0',
  question: { itemId: 'lex:w0', kind: 'lex', rung: 'read', format: 'read-pick', theme: 'nature', stretch: false, voiceFallback: false },
  answer: { ko: { ko: '산', romanization: 'san' }, gloss: 'mountain' },
};
vi.mock('../../../logic/memory/boot', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  memoryChunk: async () => ({
    cellCheckApi: () => ({
      readWorld: async () => ({ kind: 'ready', world: {} }),
      startSession: async () => ({ cellId: 'episode:stage2-letters', mode: 'check', rounds: [ROUND], soundNotice: false }),
      started: () => undefined,
      recordRound: async () => undefined,
      finishSession: async () => ({ stars: 3, passed: true }),
      gradeTyped: () => 'miss',
    }),
  }),
}));

const { CellCheckScreen } = await import('../CellCheckScreen');

const ID = 'profile:mina';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
const EN = getMessages('en');
const nav = () => ({ navigate: () => undefined, replace: () => undefined, dispatch: () => undefined, goBack: () => undefined, canGoBack: () => true, addListener: () => () => undefined }) as never;
const flush = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
};
const tap = (r: ReactTestRenderer, id: string): Promise<void> => press(byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function')!);

async function playThrough(): Promise<ReactTestRenderer> {
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
      <CellCheckScreen navigation={nav()} route={{ key: 'CellCheck', name: 'CellCheck', params: { cellId: 'episode:stage2-letters', mode: 'check' } } as never} />
    </LayoutProvider>,
  );
  await flush();
  await tap(r, 'cell-check-go');
  await flush();
  await tap(r, 'round-stub');
  await flush();
  return r;
}

beforeEach(() => {
  resetRemoteConfigForTests();
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  useProgressStore.setState({
    byProfile: { [ID]: { profileId: ID, updatedAt: '2026-10-01T10:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 } },
    hydratedFor: new Set([ID]),
    saveRetryFailedFor: new Set(),
    loadFailedFor: new Set(),
  });
});
afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('the Cell Check result and the save-later line (OD-LR8)', () => {
  it('shows no line when the progress is saved', async () => {
    const r = await playThrough();
    expect(byTestId(r.root, 'cell-check-result')).toHaveLength(1);
    expect(byTestId(r.root, 'cell-check-save-later')).toHaveLength(0);
  });

  it('shows Results\' line while the learner is in saveRetryFailedFor or in loadFailedFor', async () => {
    for (const key of ['saveRetryFailedFor', 'loadFailedFor'] as const) {
      useProgressStore.setState({ saveRetryFailedFor: new Set(), loadFailedFor: new Set(), [key]: new Set([ID]) });
      const r = await playThrough();
      const line = byTestId(r.root, 'cell-check-save-later');
      expect(line).toHaveLength(1);
      expect(screenTexts(line[0] as ReactTestInstance)).toEqual([EN.learner.results.saveLater]);
      await cleanup();
    }
  });
});
