import type { Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMessages } from '@hangul-route/i18n';
import { cardById } from '../../../content';
import { episodesAll } from '../../../content/episodes';
import { emptySnapshot } from '../../../logic/my-route/view';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { setUpperCardsSwitch } from '../../../store/upper-cards-switch';
import { byTestId, cleanup, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { CardUnlockBanner } from '../CardUnlockBanner';
import { ResultsScreen } from '../ResultsScreen';

/**
 * A live run that fills a category album (F-CURR-002 §7.2, row CM-23 part 3; F-MOTION-003): the last quest of the fifth
 * Letters cell, with the other four cells' cards held, brings card:ireum and the album's legendary card. Results shows
 * the legendary card once, in its own album-complete banner, leaves it out of the extras row and names it in the iOS
 * announcement; with `upperCards` off the same run shows no album banner.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => true),
}));
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('../../../platform/motion', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useReducedMotion: () => motion.reduced,
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
const AT = '2026-10-05T10:00:00.000Z';
const HELD_AT = '2026-10-06T10:00:00.000Z';
const learner: Profile = {
  id: ID,
  displayName: 'Mina',
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-09-01T00:00:00.000Z',
  learnerType: 'child',
};
const LAST_CELL = episodesAll.find((e) => e.id === 'episode:stage7-letters')!;
const LAST_QUEST = LAST_CELL.questIds[LAST_CELL.questIds.length - 1]!;
const params = { questId: LAST_QUEST, episodeId: LAST_CELL.id, stars: 3 as const, correct: 3, total: 3, retries: 0 };
/** The four other Letters album cards and Hoya's welcome card, already held. */
const HELD = ['card:tiger', 'card:norae', 'card:hangeul', 'card:mwoyeyo', 'card:won'];
const LEGEND = 'Hangul Book';
const EN = getMessages('en').learner.results;

const navigation = {
  navigate: vi.fn(),
  dispatch: vi.fn(),
  goBack: vi.fn(),
  setOptions: vi.fn(),
  getState: () => ({ index: 1, routes: [{ name: 'Main' }, { name: 'Results' }] }),
  addListener: () => () => undefined,
};

/** Every quest of the fifth Letters cell but its last finished; the other four album cards held. */
function before(): ProgressSnapshot {
  const done = LAST_CELL.questIds.slice(0, -1);
  return {
    ...emptySnapshot(ID),
    quests: done.map((questId) => ({ questId, episodeId: LAST_CELL.id, startedAt: AT, completedAt: AT, stars: 2 as const, attempts: 1, accuracy: 1 })),
    questDoneAt: Object.fromEntries(done.map((q) => [q, AT])),
    cards: HELD.map((cardId) => ({ cardId, unlockedAt: HELD_AT, newSinceLastView: false })),
  };
}

const held = (cardId: string): number => (useProgressStore.getState().byProfile[ID]?.cards ?? []).filter((c) => c.cardId === cardId).length;
const draw = () => render(<ResultsScreen route={{ key: 'results', name: 'Results', params }} navigation={navigation as never} />);

beforeEach(() => {
  motion.reduced = false;
  setPlatform('ios');
  useProfileStore.setState({ profiles: [learner], activeId: ID });
  useProgressStore.setState({ byProfile: { [ID]: before() }, hydratedFor: new Set([ID]) });
});
afterEach(async () => {
  await cleanup();
  resetPlatform();
  setUpperCardsSwitch(() => false);
  vi.restoreAllMocks();
});

describe('Results when a run fills an album (row CM-23 part 3)', () => {
  it('on: the legendary card shows once, in the album banner, never in the extras row; the announcement names it', async () => {
    setUpperCardsSwitch((id) => id === ID);
    const announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const r = await draw();
    expect(held('card:ireum')).toBe(1);
    expect(held('card:hunminjeongeum')).toBe(1);
    const banner = byTestId(r.root, 'results-album-done');
    expect(banner.length).toBeGreaterThan(0);
    expect(screenTexts(banner[0]!)).toEqual(expect.arrayContaining(['Album complete!', 'Your Letters album is full. Here is its legendary card.', LEGEND]));
    // Shown once on the screen: the extras row, if any, leaves the legendary card to the album banner.
    expect(screenTexts(r.root).filter((t) => t === LEGEND)).toHaveLength(1);
    for (const extras of byTestId(r.root, 'extra-cards-banner')) expect(screenTexts(extras)).not.toContain(LEGEND);
    const said = announce.mock.calls.map(([line]) => line).join(' ');
    expect(said).toContain(`Album complete! ${LEGEND}`);
  });

  it('one F-MOTION-003 celebration at a time: a 3-star run with a new quest card that also fills the album plays the sparkles on the album banner only', async () => {
    setUpperCardsSwitch((id) => id === ID);
    // One banner's sparkles, drawn on their own, to count against.
    const one = await render(<CardUnlockBanner m={EN} card={cardById('card:hunminjeongeum')!} showSparkles reducedMotion={false} onSeeCard={() => undefined} />);
    const perBanner = byTestId(one.root, 'card-unlock-sparkles').length;
    expect(perBanner).toBeGreaterThan(0);
    await cleanup();
    // The Food album's last card is Lunch Box Words' q1 card, card:dosirak: a quest card, so its own new-card banner
    // shows beside the album banner on the same 3-star run.
    const food = ['card:tiger', 'card:tteok', 'card:masisseoyo', 'card:yeogiyo', 'card:achim'];
    useProgressStore.setState({ byProfile: { [ID]: { ...emptySnapshot(ID), cards: food.map((cardId) => ({ cardId, unlockedAt: HELD_AT, newSinceLastView: false })) } } });
    const q1 = { ...params, questId: 'quest:stage2-life-q1', episodeId: 'episode:stage2-life' };
    const r = await render(<ResultsScreen route={{ key: 'results', name: 'Results', params: q1 }} navigation={navigation as never} />);
    expect(held('card:dosirak')).toBe(1);
    expect(held('card:jang')).toBe(1);
    expect(screenTexts(byTestId(r.root, 'results-album-done')[0]!)).toEqual(expect.arrayContaining(['Album complete!', 'Jang Making']));
    expect(screenTexts(r.root)).toContain(EN.newCard.title);
    expect(byTestId(r.root, 'card-unlock-sparkles')).toHaveLength(perBanner);
  });

  it('reduced motion: the album banner shows at once with its words, and no sparkles', async () => {
    motion.reduced = true;
    setUpperCardsSwitch((id) => id === ID);
    const r = await draw();
    expect(screenTexts(byTestId(r.root, 'results-album-done')[0]!)).toEqual(expect.arrayContaining(['Album complete!', LEGEND]));
    expect(byTestId(r.root, 'card-unlock-sparkles')).toHaveLength(0);
  });

  it('off: the same run brings no legendary card and shows no album banner', async () => {
    const r = await draw();
    expect(held('card:hunminjeongeum')).toBe(0);
    expect(byTestId(r.root, 'results-album-done')).toHaveLength(0);
    expect(screenTexts(r.root)).not.toContain('Album complete!');
  });
});
