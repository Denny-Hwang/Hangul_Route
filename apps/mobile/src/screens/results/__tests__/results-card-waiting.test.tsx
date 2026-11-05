import type { Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptySnapshot } from '../../../logic/my-route/view';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { byTestId, cleanup, render, screenTexts } from '../../../test-support/render';
import { ResultsScreen } from '../ResultsScreen';

/**
 * Owner request OW-3 (2026-11-04), through the real Results screen and the real stores: after the Seollal quest at
 * 1 star the learner holds the tiger, the book and the hanji (3 cards) and Results says how the Seollal card is
 * earned; at 2 stars the card is announced and held. The count the Home chip reads is the snapshot's own.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => true) }));
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) },
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});

const ID = 'profile:ow3';
const AT = '2026-10-05T10:00:00.000Z';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-09-01T00:00:00.000Z', learnerType: 'child' };
const EN = getMessages('en').learner;
const navigation = {
  navigate: vi.fn(),
  dispatch: vi.fn(),
  goBack: vi.fn(),
  setOptions: vi.fn(),
  getState: () => ({ index: 1, routes: [{ name: 'Main' }, { name: 'Results' }] }),
  addListener: () => () => undefined,
};
const run = (stars: 1 | 2 | 3) => ({ questId: 'quest:stage1-rites-q1', episodeId: 'episode:stage1-rites', stars, correct: stars, total: 3, retries: 0 });
const draw = (stars: 1 | 2 | 3) => render(<ResultsScreen route={{ key: 'results', name: 'Results', params: run(stars) }} navigation={navigation as never} />);
const cardIds = (): string[] => (useProgressStore.getState().byProfile[ID]?.cards ?? []).map((c) => c.cardId).sort();

/** The learner of the report: the book and the hanji at 2 stars, plus Hoya's welcome tiger. */
function reported(): ProgressSnapshot {
  const quests = ['quest:stage1-letters-q1', 'quest:stage1-letters-q2'].map((questId) => ({
    questId,
    episodeId: 'episode:stage1-letters',
    startedAt: AT,
    completedAt: AT,
    stars: 2 as const,
    attempts: 1,
    accuracy: 0.7,
  }));
  return {
    ...emptySnapshot(ID),
    quests,
    questDoneAt: Object.fromEntries(quests.map((q) => [q.questId, AT])),
    cards: ['card:tiger', 'card:book', 'card:hanji'].map((cardId) => ({ cardId, unlockedAt: AT, newSinceLastView: false })),
  };
}

beforeEach(() => {
  useProfileStore.setState({ profiles: [learner], activeId: ID });
  useProgressStore.setState({ byProfile: { [ID]: reported() }, hydratedFor: new Set([ID]) });
});
afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
});

describe('Results after the Seollal quest (OW-3)', () => {
  it('1 star: no card is announced, the Library keeps its 3 cards, and the Hoya bubble says how the card is earned', async () => {
    const r = await draw(1);
    expect(cardIds()).toEqual(['card:book', 'card:hanji', 'card:tiger']);
    expect(screenTexts(r.root)).not.toContain(EN.results.newCard.title);
    // Hoya's line: the cheer for the run, then how the card is earned.
    const bubble = byTestId(r.root, 'results-hoya');
    expect(bubble.length).toBeGreaterThan(0);
    expect(screenTexts(bubble[0]!).join(' ')).toContain(
      `${EN.results.cheer.goodStart} Get 2 stars in this quest to earn the Lunar New Year card. You also get it when you finish every quest in New Year & Festivals.`,
    );
  });

  it('2 stars: the card is announced and held (4 cards), and Hoya line does not mention how to get it', async () => {
    const r = await draw(2);
    expect(cardIds()).toEqual(['card:book', 'card:hanji', 'card:seollal', 'card:tiger']);
    expect(screenTexts(r.root)).toContain(EN.results.newCard.title);
    expect(screenTexts(byTestId(r.root, 'results-hoya')[0]!).join(' ')).not.toContain('Get 2 stars');
  });

  it('a replay at 1 star after the card is held draws no waiting note', async () => {
    useProgressStore.setState({
      byProfile: { [ID]: { ...reported(), cards: [...reported().cards, { cardId: 'card:seollal', unlockedAt: AT, newSinceLastView: false }] } },
    });
    const r = await draw(1);
    expect(screenTexts(byTestId(r.root, 'results-hoya')[0]!).join(' ')).not.toContain('Get 2 stars');
    expect(cardIds()).toContain('card:seollal');
  });

  it('the last quest of the episode at 1 star brings the card with the episode, so no waiting note', async () => {
    const base = reported();
    const rites = ['quest:stage1-rites-q1', 'quest:stage1-rites-q2'].map((questId) => ({
      questId,
      episodeId: 'episode:stage1-rites',
      startedAt: AT,
      completedAt: AT,
      stars: 1 as const,
      attempts: 1,
      accuracy: 0.4,
    }));
    useProgressStore.setState({ byProfile: { [ID]: { ...base, quests: [...base.quests, ...rites] } } });
    const r = await render(
      <ResultsScreen
        route={{ key: 'results', name: 'Results', params: { questId: 'quest:stage1-rites-q3', episodeId: 'episode:stage1-rites', stars: 1, correct: 1, total: 3, retries: 0 } }}
        navigation={navigation as never}
      />,
    );
    expect(cardIds()).toContain('card:seollal');
    expect(screenTexts(byTestId(r.root, 'results-hoya')[0]!).join(' ')).not.toContain('Get 2 stars');
  });
});
