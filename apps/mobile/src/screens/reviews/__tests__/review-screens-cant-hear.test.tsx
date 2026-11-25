import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import type { Profile } from '@hangul-route/content-schema';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { endVoiceCheckHold } from '../../../store/audio-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { resetRemoteConfigForTests } from '../../../store/remote-config-store';
import { byTestId, cleanup, press, render, resetPlatform } from '../../../test-support/render';

/**
 * The call sites of "Can't hear it?" on `RoundView` (AMENDMENTS-AUDIO-CANT-HEAR rows CH-1b and CH-1e): the Daily Review
 * and Keep going (`DailyReviewScreen`), the Cell Check and the Stage Check pass `cantHear`; only the Stage Check passes
 * `hidesRomanization`, and only while its "hide the romanization" switch is on (the asked text is then the romanization
 * only, section 3.12). `RoundView` is a stub that shows the props it got, so deleting or adding a prop at a screen turns a test red
 * (`ReviewRounds-cant-hear.test.tsx` covers what the prop does). This week in Korea is `week-drop-ui.test.tsx`.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const ID = 'profile:mina';

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
vi.mock('../../stage-check/use-stage-offer', async (importOriginal) => ({ ...(await importOriginal<object>()), useStageOffer: () => ({ complete: true, open: true }) }));

/** The round, as the stub draws it: only what the screen handed it. */
vi.mock('../ReviewRounds', async () => {
  const { createElement } = await import('react');
  return {
    RoundView: ({ cantHear, hidesRomanization }: { cantHear?: boolean; hidesRomanization?: boolean }) =>
      createElement('div', { 'data-testid': 'round-stub', 'data-cant-hear': cantHear === true, 'data-hides': hidesRomanization === true }, 'round'),
  };
});
vi.mock('../DailyReviewRoute', async () => {
  const { createElement } = await import('react');
  return {
    dailyReviewChunk: async () => ({
      TopRow: () => createElement('div', { 'data-testid': 'top-row' }),
      DisplayHeadline: ({ children }: { children?: unknown }) => createElement('div', null, children as never),
      RoundView: ({ cantHear, hidesRomanization }: { cantHear?: boolean; hidesRomanization?: boolean }) =>
        createElement('div', { 'data-testid': 'round-stub', 'data-cant-hear': cantHear === true, 'data-hides': hidesRomanization === true }, 'round'),
    }),
  };
});

const ROUND = {
  type: 'pick',
  heard: true,
  ask: 'spelling',
  prompt: { ko: '산', romanization: 'san' },
  options: [{ id: 'lex:w0', label: 'a' }, { id: 'lex:w1', label: 'b' }],
  answerId: 'lex:w0',
  question: { itemId: 'lex:w0', kind: 'lex', rung: 'recognize', format: 'hear-pick', theme: 'nature', stretch: false, voiceFallback: false },
  answer: { ko: { ko: '산', romanization: 'san' }, gloss: 'mountain' },
};
const WORLD = { kind: 'ready', world: {} };
vi.mock('../../../logic/memory/boot', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  memoryChunk: async () => ({
    dailyReviewApi: () => ({
      readWorld: async () => WORLD,
      openingKind: () => 'daily',
      doneTodayOffer: () => 'empty',
      startSession: async () => ({ kind: 'daily', rounds: [ROUND], soundNotice: false }),
      recordRound: async () => undefined,
      noteStopped: () => undefined,
      finishSession: async () => null,
      gradeTyped: () => 'miss',
    }),
    cellCheckApi: () => ({
      readWorld: async () => WORLD,
      startSession: async () => ({ cellId: 'episode:stage2-letters', mode: 'check', rounds: [ROUND], soundNotice: false }),
      started: () => undefined,
      recordRound: async () => undefined,
      finishSession: async () => null,
      gradeTyped: () => 'miss',
    }),
    stageCheckApi: () => ({
      readWorld: async () => WORLD,
      startSession: async () => ({ stageKey: 'stage2', rounds: [ROUND], soundNotice: false }),
      begin: () => undefined,
      recordRound: async () => undefined,
      finishSession: async () => null,
      gradeTyped: () => 'miss',
    }),
  }),
}));

const { DailyReviewScreen } = await import('../../reviews/DailyReviewScreen');
const { CellCheckScreen } = await import('../../cell-check/CellCheckScreen');
const { StageCheckScreen } = await import('../../stage-check/StageCheckScreen');

const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
const nav = () =>
  ({ navigate: () => undefined, replace: () => undefined, dispatch: () => undefined, goBack: () => undefined, canGoBack: () => true, addListener: () => () => undefined }) as never;
const settle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
};
const mounted: ReactTestRenderer[] = [];
async function draw(element: React.ReactElement): Promise<ReactTestRenderer> {
  const r = await render(<LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>{element}</LayoutProvider>);
  mounted.push(r);
  await settle();
  return r;
}
const cantHearOf = (r: ReactTestRenderer): unknown => byTestId(r.root, 'round-stub')[0]?.props['data-cant-hear'];
const hidesOf = (r: ReactTestRenderer): unknown => byTestId(r.root, 'round-stub')[0]?.props['data-hides'];

beforeEach(() => {
  endVoiceCheckHold();
  resetRemoteConfigForTests();
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  useProgressStore.setState({
    byProfile: { [ID]: { profileId: ID, updatedAt: '2026-10-01T10:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 } },
    hydratedFor: new Set([ID]),
  });
});
afterEach(async () => {
  mounted.length = 0;
  await cleanup();
  resetPlatform();
});

describe('where RoundView gets cantHear (CH-1b)', () => {
  it('the Daily Review and Keep going pass it', async () => {
    const r = await draw(<DailyReviewScreen navigation={nav()} route={{ key: 'DailyReview', name: 'DailyReview' } as never} />);
    expect(byTestId(r.root, 'round-stub')).toHaveLength(1);
    expect(cantHearOf(r)).toBe(true);
  });

  it('the Cell Check passes it (CH-1e), and no hide switch: its options show their romanization', async () => {
    const r = await draw(<CellCheckScreen navigation={nav()} route={{ key: 'CellCheck', name: 'CellCheck', params: { cellId: 'episode:stage2-letters', mode: 'check' } } as never} />);
    await press(byTestId(r.root, 'cell-check-go').find((n) => typeof n.props.onClick === 'function')!);
    await settle();
    expect(byTestId(r.root, 'round-stub')).toHaveLength(1);
    expect(cantHearOf(r)).toBe(true);
    expect(hidesOf(r)).toBe(false);
  });

  it('the Stage Check passes it (CH-1e); the hide switch off gives the surface\'s own text', async () => {
    const r = await draw(<StageCheckScreen navigation={nav()} route={{ key: 'StageCheck', name: 'StageCheck', params: { stageKey: 'stage2' } } as never} />);
    await press(byTestId(r.root, 'stage-check-go').find((n) => typeof n.props.onClick === 'function')!);
    await settle();
    expect(byTestId(r.root, 'round-stub')).toHaveLength(1);
    expect(cantHearOf(r)).toBe(true);
    expect(hidesOf(r)).toBe(false);
  });

  it('the Stage Check with its "hide the romanization" switch on passes hidesRomanization, so the asked text is the romanization only', async () => {
    const r = await draw(<StageCheckScreen navigation={nav()} route={{ key: 'StageCheck', name: 'StageCheck', params: { stageKey: 'stage2' } } as never} />);
    await press(r.root.findAll((n) => n.props.role === 'switch')[0]!);
    await press(byTestId(r.root, 'stage-check-go').find((n) => typeof n.props.onClick === 'function')!);
    await settle();
    expect(cantHearOf(r)).toBe(true);
    expect(hidesOf(r)).toBe(true);
  });
});
