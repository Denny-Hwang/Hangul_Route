import type { Profile } from '@hangul-route/content-schema';
import { Pressable, Text } from 'react-native';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { emptySnapshot } from '../../../logic/my-route/view';
import { questsAll } from '../../../content/quests';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { byTestId, cleanup, press, render } from '../../../test-support/render';
import { handTryAgainToResults, peekTryAgainHandoff, resetQuestReviewChunkForTests, type QuestReviewChunk } from '../../quest/quest-reviews';
import { ResultsScreen } from '../ResultsScreen';

/**
 * F-CURR-002 section 4.5 (row CM-15): Try these again, chosen on the reward step, plays on Results after Results has
 * written the quest's score, so a learner who closes the app (or switches profile) during it keeps the quest done.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => true),
}));
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) },
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});

const ID = 'profile:mina';
const learner: Profile = {
  id: ID,
  displayName: 'Mina',
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
};
const episodeOf = (questId: string): string => episodesAll.find((e) => e.questIds.includes(questId))?.id ?? 'episode:none';
const quest = questsAll.find((q) => /^episode:stage[2-7]-/.test(episodeOf(q.id)))!;
const params = { questId: quest.id, episodeId: episodeOf(quest.id), stars: 2 as const, correct: 2, total: 3, retries: 1 };

const listeners: Array<(event: { data: { action: { type: string } }; preventDefault(): void }) => void> = [];
const navigation = {
  navigate: vi.fn(),
  dispatch: vi.fn(),
  goBack: vi.fn(),
  setOptions: vi.fn(),
  getState: () => ({ index: 1, routes: [{ name: 'Main' }, { name: 'Results' }] }),
  addListener: (_type: string, listener: (typeof listeners)[number]) => {
    listeners.push(listener);
    return () => listeners.splice(listeners.indexOf(listener), 1);
  },
};

/** A stand-in for the sessions' chunk: the session is one button, its See results. */
const chunk = {
  QuestReviewSession: ({ onDone }: { onDone: () => void }) => (
    <Pressable testID="try-again-session" accessibilityRole="button" onPress={onDone}>
      <Text>session</Text>
    </Pressable>
  ),
} as unknown as QuestReviewChunk;
const plan = { kind: 'again', rounds: [], soundNotice: false, ctx: {} } as never;

const completed = (): boolean => (useProgressStore.getState().byProfile[ID]?.quests ?? []).some((q) => q.questId === quest.id && q.stars === 2);

beforeEach(() => {
  resetQuestReviewChunkForTests();
  listeners.length = 0;
  useProfileStore.setState({ profiles: [learner], activeId: ID });
  useProgressStore.setState({ byProfile: { [ID]: emptySnapshot(ID) }, hydratedFor: new Set([ID]) });
});
afterEach(async () => {
  await cleanup();
  resetQuestReviewChunkForTests();
});

describe('Try these again on Results', () => {
  it('opens over Results after the score is written: leaving during it keeps the quest done', async () => {
    handTryAgainToResults({ questId: quest.id, profileId: ID, chunk, plan });
    const r = await render(<ResultsScreen route={{ key: 'results', name: 'Results', params }} navigation={navigation as never} />);
    expect(byTestId(r.root, 'try-again-session')).not.toHaveLength(0);
    // The score is already in, before any round is answered.
    expect(completed()).toBe(true);
    // The hand-over is taken once: a later Results visit does not open it again.
    expect(peekTryAgainHandoff(quest.id, ID)).toBeNull();
    // Closing the app (the screen goes) leaves the quest as it was written.
    await cleanup();
    expect(completed()).toBe(true);
  });

  it('a back during it shows Results', async () => {
    handTryAgainToResults({ questId: quest.id, profileId: ID, chunk, plan });
    const r = await render(<ResultsScreen route={{ key: 'results', name: 'Results', params }} navigation={navigation as never} />);
    expect(listeners.length).toBeGreaterThan(0);
    let prevented = false;
    await act(async () => {
      for (const listener of [...listeners]) listener({ data: { action: { type: 'GO_BACK' } }, preventDefault: () => (prevented = true) });
    });
    expect(prevented).toBe(true);
    // The back went to the session: Results shows, and the next back is the screen's own.
    expect(byTestId(r.root, 'try-again-session')).toHaveLength(0);
    let again = false;
    await act(async () => {
      for (const listener of [...listeners]) listener({ data: { action: { type: 'GO_BACK' } }, preventDefault: () => (again = true) });
    });
    expect(again).toBe(false);
  });

  it('its See results shows Results', async () => {
    handTryAgainToResults({ questId: quest.id, profileId: ID, chunk, plan });
    const r = await render(<ResultsScreen route={{ key: 'results', name: 'Results', params }} navigation={navigation as never} />);
    await press(byTestId(r.root, 'try-again-session').find((n) => typeof n.props.onClick === 'function')!);
    expect(byTestId(r.root, 'try-again-session')).toHaveLength(0);
    expect(completed()).toBe(true);
  });

  it('without a hand-over, for another quest or learner, Results is as it always was', async () => {
    handTryAgainToResults({ questId: 'quest:other', profileId: ID, chunk, plan });
    const r = await render(<ResultsScreen route={{ key: 'results', name: 'Results', params }} navigation={navigation as never} />);
    expect(byTestId(r.root, 'try-again-session')).toHaveLength(0);
    expect(completed()).toBe(true);
    handTryAgainToResults({ questId: quest.id, profileId: 'profile:joon', chunk, plan });
    expect(peekTryAgainHandoff(quest.id, ID)).toBeNull();
  });
});
