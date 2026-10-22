import { getMessages } from '@hangul-route/i18n';
import type { GuestRecord } from '@hangul-route/content-schema';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 5.3, 6.2, 6.4, 7.1 and 7.2 (row GU-3, section 19): the four screens of
 * the `Guest` stack render for a guest id that has no profile record (`activeLearnerIdSelector`): the quest player
 * runs its session, the storage-blocked line and the leave under the guest's id; a game and the card page take the
 * guest's id; the guest's Results draws the stars, Hoya's line and the card with See my card, and none of the learner's
 * next actions, name row or hand-offs, and writes `questDone` with `guest.quest_done`.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  readJsonStrict: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  readJsonExact: vi.fn(async (key: string) => (disk.has(key) ? JSON.parse(disk.get(key)!) : null)),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, JSON.stringify(value))),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async (key: string) => void disk.delete(key)),
  listKeys: vi.fn(async () => [...disk.keys()]),
}));
const sent = vi.hoisted(() => [] as Array<{ name: string; payload?: unknown; profileId?: string }>);
vi.mock('../../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string; payload?: unknown; profileId?: string }) => {
    sent.push(event);
    return true;
  }),
  flushQueue: vi.fn(async () => undefined),
}));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../../platform/dialog', () => ({ confirm: vi.fn(async () => true) }));
// The native navigation package has no build that loads in Node: focus effects run once; reset is an action object.
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    NavigationRouteContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
    CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) },
  };
});
const holds = vi.hoisted(() => [] as string[]);
vi.mock('../../../store/learner-session', () => ({
  holdLearnerSession: (id: string) => {
    holds.push(id);
    return () => undefined;
  },
}));
const practice = vi.hoisted(() => [] as Array<string | null | undefined>);
vi.mock('../../use-practice-session', () => ({ usePracticeSession: (id: string | null | undefined) => void practice.push(id) }));
vi.mock('../../minigames/TraceStrokeGame', () => ({ TraceStrokeGame: () => null }));
vi.mock('../../minigames/TraceWordGame', () => ({ TraceWordGame: () => null }));
vi.mock('../../library/CardDetailView', () => ({ CardDetailView: ({ cardId }: { cardId: string }) => cardId }));

import { ScreenHeaderSlotContext, type ScreenHeaderSlotProps } from '@hangul-route/design-system';
import { Pressable, Text } from 'react-native';
import { cardById } from '../../../content';
import { guestFirstQuest } from '../../../store/guest-launch';
import { useGuestStore } from '../../../store/guest-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { buttonsNamed, byTestId, press, render, screenTexts, unmount } from '../../../test-support/render';
import { CardDetailScreen } from '../../library/CardDetailScreen';
import { MinigameScreen } from '../../minigames/MinigameScreen';
import { QuestPlayerScreen } from '../../quest/QuestPlayerScreen';
import { GuestQuestPlayer } from '../GuestQuestPlayer';
import { GuestResults } from '../GuestResults';

const en = getMessages('en');
const GUEST_ID = 'profile:guest001';
const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const record = (patch: Partial<GuestRecord> = {}): GuestRecord => ({ v: 1, id: GUEST_ID, startedAt: new Date(T0).toISOString(), lastAt: new Date(T0).toISOString(), via: 'site', questDone: false, ...patch });
const quest = guestFirstQuest()!;

interface Listener {
  (event: { data: { action: { type: string } }; preventDefault: () => void }): void;
}

function navigationDouble() {
  const listeners: Listener[] = [];
  const rootDispatch = vi.fn();
  return {
    listeners,
    rootDispatch,
    navigate: vi.fn(),
    replace: vi.fn(),
    dispatch: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
    setOptions: vi.fn(),
    getState: () => ({ index: 0, routes: [{ name: 'QuestPlayer' }] }),
    getParent: () => ({ dispatch: rootDispatch }),
    addListener: vi.fn((type: string, listener: Listener) => {
      if (type === 'beforeRemove') listeners.push(listener);
      return () => undefined;
    }),
  };
}

/** A header slot double: draws the screen's own leading control, as LearnerScreenHeader does when it cannot go back. */
function HeaderDouble({ options }: ScreenHeaderSlotProps): React.ReactElement | null {
  const leading = options?.leading;
  if (leading?.onPress === undefined) return null;
  return (
    <Pressable accessibilityRole="button" onPress={leading.onPress} testID={`header-${leading.kind}`}>
      <Text>{leading.kind}</Text>
    </Pressable>
  );
}

const inGuest = (element: React.ReactElement): React.ReactElement => <ScreenHeaderSlotContext.Provider value={HeaderDouble}>{element}</ScreenHeaderSlotContext.Provider>;

beforeEach(() => {
  disk.clear();
  sent.length = 0;
  holds.length = 0;
  practice.length = 0;
  vi.stubGlobal('navigator', { locks: { request: async <T,>(_name: string, step: () => Promise<T>): Promise<T> => step() } });
  disk.set('guest', JSON.stringify(record()));
  useGuestStore.setState({ record: record(), running: true, hydrated: true, memoryOnly: false });
  // No profile record anywhere: the guest's id is not on the list (GU-D1).
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
  useQuestRunStore.getState().reset();
});

afterEach(() => {
  useQuestRunStore.getState().reset();
  vi.unstubAllGlobals();
});

describe('GuestQuestPlayer, the QuestPlayer of the Guest stack (7.1)', () => {
  it('runs quest 1 for the guest id with no profile record: the session, Hoya\'s hello and Continue', async () => {
    const nav = navigationDouble();
    const r = await render(inGuest(<GuestQuestPlayer route={{ key: 'q', name: 'QuestPlayer', params: quest } as never} navigation={nav as never} />));
    expect(holds).toEqual([GUEST_ID]);
    expect(useQuestRunStore.getState().questId).toBe(quest.questId);
    expect(buttonsNamed(r.root, en.learner.quest.continue.cta)).toHaveLength(1);
    // The storage-blocked line is not drawn while the record is kept.
    expect(byTestId(r.root, 'quest-intro-note')).toHaveLength(0);
    await unmount(r);
  });

  it('storage blocked: the memoryOnly line under Hoya\'s hello, plain text (no live region), and only on step 1', async () => {
    useGuestStore.setState({ memoryOnly: true });
    const nav = navigationDouble();
    const r = await render(inGuest(<GuestQuestPlayer route={{ key: 'q', name: 'QuestPlayer', params: quest } as never} navigation={nav as never} />));
    const line = byTestId(r.root, 'quest-intro-note')[0] as ReactTestInstance;
    expect(screenTexts(line)).toEqual([en.learner.guest.memoryOnly]);
    expect(line.props['aria-live']).toBeUndefined();
    expect(line.props.role).toBeUndefined();
    await press(buttonsNamed(r.root, en.learner.quest.continue.cta)[0] as ReactTestInstance);
    expect(byTestId(r.root, 'quest-intro-note')).toHaveLength(0);
    await unmount(r);
  });

  it('Continue onto Discover page 1 sends no profile id; the header\'s own Close asks, and Leave goes to Welcome with guest.left', async () => {
    const nav = navigationDouble();
    const r = await render(inGuest(<GuestQuestPlayer route={{ key: 'q', name: 'QuestPlayer', params: quest } as never} navigation={nav as never} />));
    await press(buttonsNamed(r.root, en.learner.quest.continue.cta)[0] as ReactTestInstance);
    expect(useQuestRunStore.getState().stepIndex).toBe(1);
    expect(sent.every((e) => e.profileId === undefined)).toBe(true);
    // The quest opens its stack, so the header draws Close of its own; it asks the leave sheet (Leave, here).
    await press(byTestId(r.root, 'header-close').find((n) => typeof n.props.onClick === 'function')!);
    await vi.waitFor(() => expect(nav.rootDispatch).toHaveBeenCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Onboarding' }] } }));
    expect(useGuestStore.getState().running).toBe(false);
    expect(useGuestStore.getState().record).not.toBeNull();
    expect(sent.filter((e) => e.name === 'guest.left')).toEqual([{ name: 'guest.left', payload: { at: 'quest' } }]);
    await unmount(r);
  });

  it('a finished run resets the Guest stack to Results alone (never Main)', async () => {
    const nav = navigationDouble();
    const r = await render(inGuest(<GuestQuestPlayer route={{ key: 'q', name: 'QuestPlayer', params: quest } as never} navigation={nav as never} />));
    const run = useQuestRunStore.getState();
    for (let i = run.stepIndex; i < 5; i += 1) useQuestRunStore.getState().goNextStep();
    await press(buttonsNamed(r.root, en.learner.quest.seeResults.cta)[0] as ReactTestInstance);
    const [action] = nav.dispatch.mock.calls.at(-1) as [{ type: string; payload: { index: number; routes: Array<{ name: string }> } }];
    expect(action.type).toBe('RESET');
    expect(action.payload.routes.map((x) => x.name)).toEqual(['Results']);
    await unmount(r);
  });
});

describe('the learner screens read the active learner (5.3, activeLearnerIdSelector)', () => {
  it('QuestPlayerScreen runs its session for the guest id while a run is on, with no profile record', async () => {
    const nav = navigationDouble();
    const r = await render(<QuestPlayerScreen route={{ key: 'q', name: 'QuestPlayer', params: quest } as never} navigation={nav as never} />);
    expect(holds).toEqual([GUEST_ID]);
    await unmount(r);
  });
});

describe('Minigame and CardDetail take the guest id (5.3)', () => {
  it('a game of quest 1 counts its practice time for the guest id', async () => {
    const nav = navigationDouble();
    const r = await render(<MinigameScreen route={{ params: { ...quest, stepIndex: 2 } }} navigation={nav as never} onOpenCultureNote={null} />);
    expect(practice).toContain(GUEST_ID);
    await unmount(r);
  });

  it('the card page clears the card\'s New pill under the guest id', async () => {
    const markCardsSeen = vi.fn();
    useProgressStore.setState({ markCardsSeen });
    const r = await render(<CardDetailScreen route={{ key: 'c', name: 'CardDetail', params: { cardId: 'card:book' } } as never} navigation={navigationDouble() as never} />);
    expect(markCardsSeen).toHaveBeenCalledWith(GUEST_ID, ['card:book']);
    await unmount(r);
  });
});

describe('GuestResults, the Results of the Guest stack (7.1)', () => {
  const params = { ...quest, stars: 3 as const, correct: 5, total: 5, retries: 0 };

  it('stars, Hoya\'s line and the earned card with See my card; none of the learner\'s next actions, name row or hand-offs', async () => {
    const nav = navigationDouble();
    const r = await render(inGuest(<GuestResults route={{ key: 'r', name: 'Results', params } as never} navigation={nav as never} />));
    const m = en.learner.results;
    expect(screenTexts(r.root)).toContain(en.a11y.stars(3));
    expect(screenTexts(r.root)).toContain(m.headline.wonderful);
    const card = cardById('card:book')!;
    await vi.waitFor(() => expect(buttonsNamed(r.root, m.newCard.seeA11y(card.titleEn))).toHaveLength(1));
    await press(buttonsNamed(r.root, m.newCard.seeA11y(card.titleEn))[0]!);
    expect(nav.navigate).toHaveBeenCalledWith('CardDetail', { cardId: 'card:book' });
    // Not drawn in a guest run: the teaser, Back to Journey, the Episode page, the stage prize, practice, a hand-off.
    expect(byTestId(r.root, 'next-up-card')).toHaveLength(0);
    expect(byTestId(r.root, 'results-stage-prize')).toHaveLength(0);
    for (const label of [m.backHome.cta, m.episodePage.cta, m.stagePrize.cta, en.learner.access.readStory.cta, en.learner.access.practiceWords.cta]) {
      expect(buttonsNamed(r.root, label), label).toHaveLength(0);
    }
    for (const route of ['Paywall', 'PinEntry', 'Main', 'EpisodeDetail', 'StageComplete', 'VocabTopic', 'QuestPlayer']) {
      expect(nav.navigate.mock.calls.filter(([name]) => name === route), route).toEqual([]);
    }
    // The score and the card are the guest's (no profile record), and quest 1 is done.
    expect(useProgressStore.getState().byProfile[GUEST_ID]?.quests.some((q) => q.questId === quest.questId)).toBe(true);
    expect(sent.filter((e) => e.name === 'guest.quest_done')).toEqual([{ name: 'guest.quest_done', payload: { stars: 3 } }]);
    await vi.waitFor(() => expect(JSON.parse(disk.get('guest')!).questDone).toBe(true));
    await unmount(r);
  });

  it('every back opens the Not now card, so the stack is never left', async () => {
    const nav = navigationDouble();
    const r = await render(inGuest(<GuestResults route={{ key: 'r', name: 'Results', params } as never} navigation={nav as never} />));
    const preventDefault = vi.fn();
    for (const listener of nav.listeners) listener({ data: { action: { type: 'GO_BACK' } }, preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(nav.replace).toHaveBeenCalledWith('GuestLater');
    // The header's Back (drawn though the stack cannot go back) does the same.
    nav.replace.mockClear();
    await press(byTestId(r.root, 'header-back').find((n) => typeof n.props.onClick === 'function')!);
    expect(nav.replace).toHaveBeenCalledWith('GuestLater');
    await unmount(r);
  });

  it('a run with every game skipped scores nothing and is not done', async () => {
    const nav = navigationDouble();
    const r = await render(inGuest(<GuestResults route={{ key: 'r', name: 'Results', params: { ...params, stars: 0, correct: 0, total: 0 } } as never} navigation={nav as never} />));
    expect(sent.filter((e) => e.name === 'guest.quest_done')).toEqual([]);
    expect(JSON.parse(disk.get('guest')!).questDone).toBe(false);
    await unmount(r);
  });
});
