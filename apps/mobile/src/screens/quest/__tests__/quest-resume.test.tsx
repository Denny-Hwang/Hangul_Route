import { getMessages } from '@hangul-route/i18n';
import { NavigationContext } from '@react-navigation/native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-12 (audit FUNC-3): a quest left by a reload continues where it stopped. The
 * learner's quest player keeps the run on the device at each step change; opened again for the same quest within 24
 * hours it shows the saved step with the tallies it had; finishing or choosing Leave forgets the run. No screen and no
 * word of its own: the step's own screen is all the learner sees.
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
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true), flushQueue: vi.fn(async () => undefined) }));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../../platform/dialog', () => ({ confirm: vi.fn(async () => true) }));
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

import { questById } from '../../../content';
import { confirm } from '../../../platform/dialog';
import { savedRunOf } from '../../../logic/quest-flow/saved-run';
import { useGuestStore } from '../../../store/guest-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { QUEST_RUN_KEY, settleSavedRunsForTests } from '../../../store/quest-run-saved';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { buttonsNamed, press, render, screenTexts, unmount } from '../../../test-support/render';
import { QuestPlayerScreen } from '../QuestPlayerScreen';

const en = getMessages('en');
const mina = { id: 'profile:mina0001', displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const, role: 'learner' as const, createdAt: '2026-10-01T00:00:00.000Z' };
const jun = { ...mina, id: 'profile:jun00001', displayName: 'Jun' };
const QUEST = questById('quest:stage1-letters-q1')!;
const OTHER = questById('quest:stage1-letters-q2')!;
const EPISODE = 'episode:stage1-letters';
const at = (kind: string): number => QUEST.steps.findIndex((s) => s.kind === kind);
const mounted: ReactTestRenderer[] = [];

type BackListener = (event: { data: { action: { type: string } }; preventDefault: () => void }) => void;

function navigationDouble() {
  const backs: BackListener[] = [];
  return {
    /** A back on the route (the header's Close, the browser or the phone back): the quest's back guard answers it. */
    back: (): void => backs.forEach((listener) => listener({ data: { action: { type: 'GO_BACK' } }, preventDefault: () => undefined })),
    navigate: vi.fn(),
    replace: vi.fn(),
    dispatch: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
    setOptions: vi.fn(),
    getState: () => ({ index: 1, routes: [{ name: 'Main' }, { name: 'QuestPlayer' }] }),
    getParent: () => undefined,
    addListener: vi.fn((type: string, listener: BackListener) => {
      if (type === 'beforeRemove') backs.push(listener);
      return () => undefined;
    }),
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await settleSavedRunsForTests();
}

async function open(questId: string = QUEST.id, resume?: boolean) {
  const nav = navigationDouble();
  const r = await render(
    <NavigationContext.Provider value={nav as never}>
      <QuestPlayerScreen route={{ key: 'q', name: 'QuestPlayer', params: { questId, episodeId: EPISODE, ...(resume ? { resume } : {}) } } as never} navigation={nav as never} />
    </NavigationContext.Provider>,
  );
  mounted.push(r);
  await settle();
  return { r, nav };
}

/** What the device holds for a learner's interrupted run. */
const stored = (profileId: string): Record<string, unknown> | null => {
  const raw = disk.get(QUEST_RUN_KEY(profileId));
  return raw === undefined ? null : (JSON.parse(raw) as Record<string, unknown>);
};

/** A run of the quest saved on `stepIndex` with a perfect practice game behind it, begun `minutesAgo`. */
function seedRun(profileId: string, stepIndex: number, minutesAgo: number, quest = QUEST): void {
  const practice = quest.steps.findIndex((s) => s.kind === 'practice');
  const scored = stepIndex > practice ? [0, 1, 2, 3].map((i) => `${practice}:${i}`) : [];
  const saved = savedRunOf(
    {
      questId: quest.id,
      episodeId: EPISODE,
      stepIndex,
      correctCount: scored.length,
      totalCount: scored.length,
      retryCount: 0,
      scoredRounds: scored,
      skippedSteps: [],
      startedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    },
    quest.steps,
  );
  disk.set(QUEST_RUN_KEY(profileId), JSON.stringify(saved));
}

/** A reload: the page's memory is gone, the device's storage is not. */
async function reload(): Promise<void> {
  for (const r of mounted.splice(0)) await unmount(r);
  await settleSavedRunsForTests();
  useQuestRunStore.getState().reset();
}

beforeEach(async () => {
  await settleSavedRunsForTests(true);
  disk.clear();
  holds.length = 0;
  vi.mocked(confirm).mockClear();
  useGuestStore.setState({ record: null, running: false, hydrated: true, memoryOnly: false });
  useProfileStore.setState({ profiles: [mina, jun], activeId: mina.id, hydrated: true });
  useLocaleStore.setState({ device: 'en' });
  useQuestRunStore.getState().reset();
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useQuestRunStore.getState().reset();
});

describe('[AU] a quest left by a reload continues where it stopped (row AU-12)', () => {
  it('the quest under test: intro, Look and learn, two games, the Check, the reward', () => {
    expect(QUEST.steps.map((s) => s.kind)).toEqual(['intro', 'discover', 'practice', 'apply', 'check', 'reward']);
  });

  it('a new quest starts on its first step and is stored for the learner as it begins', async () => {
    const { r } = await open();
    expect(useQuestRunStore.getState().stepIndex).toBe(0);
    expect(buttonsNamed(r.root, en.learner.quest.continue.cta)).toHaveLength(1);
    expect(stored(mina.id)).toMatchObject({ v: 1, questId: QUEST.id, episodeId: EPISODE, stepIndex: 0, totalCount: 0 });
    expect(stored(jun.id)).toBeNull();
  });

  it('each step change is stored: the step, the tallies and the rounds already scored', async () => {
    const { r } = await open();
    await press(buttonsNamed(r.root, en.learner.quest.continue.cta)[0] as ReactTestInstance);
    await settle();
    expect(stored(mina.id)).toMatchObject({ stepIndex: 1 });
    await act(async () => {
      const store = useQuestRunStore.getState();
      store.goNextStep();
      for (let i = 0; i < 4; i += 1) store.answerRound(i, i !== 2);
      store.markStepComplete();
      store.consumePendingAdvance();
    });
    await settle();
    expect(stored(mina.id)).toMatchObject({ stepIndex: at('apply'), correctCount: 3, totalCount: 4, scoredRounds: ['2:0', '2:1', '2:2', '2:3'], skippedSteps: [] });
  });

  it('after a reload the same quest opens on the saved step with its tallies, with nothing new on screen', async () => {
    seedRun(mina.id, at('apply'), 30);
    const { r } = await open();
    const run = useQuestRunStore.getState();
    expect(run.stepIndex).toBe(at('apply'));
    expect([run.correctCount, run.totalCount]).toEqual([4, 4]);
    expect(run.scoredRounds).toEqual(['2:0', '2:1', '2:2', '2:3']);
    // The step's own launcher, from its beginning: its title, Play and Skip for now. No resume screen, no resume line.
    const text = screenTexts(r.root).join(' | ');
    expect(text).toContain(QUEST.steps[at('apply')]!.titleEn);
    expect(buttonsNamed(r.root, en.learner.quest.launcher.game.play.cta)).toHaveLength(1);
    expect(text).not.toMatch(/resum|continue where|welcome back|left off/i);
    // One session for the visit, as for any start.
    expect(holds).toEqual([mina.id]);
  });

  it('the whole trip: play to the Check, reload, start the quest again, finish: one result, the run forgotten', async () => {
    const first = await open();
    await act(async () => {
      const store = useQuestRunStore.getState();
      store.goNextStep();
      store.goNextStep();
      for (let i = 0; i < 4; i += 1) store.answerRound(i, true);
      store.markStepComplete();
      store.consumePendingAdvance();
    });
    await settle();
    await press(buttonsNamed(first.r.root, en.learner.quest.launcher.game.skip.cta)[0] as ReactTestInstance);
    await settle();
    expect(stored(mina.id)).toMatchObject({ stepIndex: at('check'), skippedSteps: [at('apply')] });
    const startedAt = stored(mina.id)?.startedAt;

    await reload();
    const { r, nav } = await open();
    expect(useQuestRunStore.getState().stepIndex).toBe(at('check'));
    // The Check is played after the reload; a practice round played before it is not scored again.
    await act(async () => {
      const store = useQuestRunStore.getState();
      store.answerRound(0, true);
      store.answerRound(1, true);
      store.markStepComplete();
      store.consumePendingAdvance();
    });
    await settle();
    expect(stored(mina.id)).toMatchObject({ stepIndex: at('reward'), totalCount: 6, startedAt });
    await press(buttonsNamed(r.root, en.learner.quest.seeResults.cta)[0] as ReactTestInstance);
    await settle();
    // The skip made before the reload still caps the stars (row AU-9): six of six with one game skipped is 2 stars.
    expect(nav.dispatch).toHaveBeenCalledTimes(1);
    const [action] = nav.dispatch.mock.calls[0] as [{ payload: { routes: Array<{ name: string; params?: Record<string, unknown> }> } }];
    expect(action.payload.routes[1]).toEqual({ name: 'Results', params: { questId: QUEST.id, episodeId: EPISODE, stars: 2, correct: 6, total: 6, retries: 0 } });
    expect(stored(mina.id)).toBeNull();
  });

  it('Leave in the leave question forgets the run: the quest then starts from its first step', async () => {
    seedRun(mina.id, at('apply'), 30);
    const { nav } = await open();
    expect(useQuestRunStore.getState().stepIndex).toBe(at('apply'));
    // A back asks "Leave this quest?" (the dialog double answers Leave).
    await act(async () => nav.back());
    await settle();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith('EpisodeDetail', { episodeId: EPISODE });
    expect(stored(mina.id)).toBeNull();

    await reload();
    await open();
    expect(useQuestRunStore.getState().stepIndex).toBe(0);
    expect(useQuestRunStore.getState().totalCount).toBe(0);
  });

  it('Keep playing in the leave question keeps the run', async () => {
    vi.mocked(confirm).mockResolvedValueOnce(false);
    seedRun(mina.id, at('apply'), 30);
    const { nav } = await open();
    await act(async () => nav.back());
    await settle();
    expect(nav.replace).not.toHaveBeenCalled();
    expect(stored(mina.id)).toMatchObject({ stepIndex: at('apply') });
  });

  it('a saved run of another quest is not resumed, and the new quest replaces it', async () => {
    seedRun(mina.id, 3, 30, OTHER);
    await open();
    expect(useQuestRunStore.getState().stepIndex).toBe(0);
    expect(stored(mina.id)).toMatchObject({ questId: QUEST.id, stepIndex: 0 });
  });

  it('a run begun more than 24 hours ago starts fresh and is replaced', async () => {
    seedRun(mina.id, at('apply'), 24 * 60 + 1);
    await open();
    expect(useQuestRunStore.getState().stepIndex).toBe(0);
    expect(useQuestRunStore.getState().totalCount).toBe(0);
    expect(stored(mina.id)).toMatchObject({ stepIndex: 0, totalCount: 0 });
  });

  it('a content update that changed the quest\'s steps discards the saved run', async () => {
    seedRun(mina.id, at('apply'), 30);
    const saved = stored(mina.id)!;
    disk.set(QUEST_RUN_KEY(mina.id), JSON.stringify({ ...saved, steps: `${String(saved.steps)}|s7:reward:` }));
    await open();
    expect(useQuestRunStore.getState().stepIndex).toBe(0);
  });

  it('a run is the learner\'s own: another profile on the device starts the quest fresh and keeps the first one\'s run', async () => {
    seedRun(mina.id, at('apply'), 30);
    useProfileStore.setState({ activeId: jun.id });
    await open();
    expect(useQuestRunStore.getState().stepIndex).toBe(0);
    expect(holds).toEqual([jun.id]);
    expect(stored(jun.id)).toMatchObject({ stepIndex: 0 });
    expect(stored(mina.id)).toMatchObject({ stepIndex: at('apply') });
  });

  it('stored damage starts the quest fresh', async () => {
    disk.set(QUEST_RUN_KEY(mina.id), JSON.stringify({ v: 1, questId: QUEST.id, stepIndex: 99 }));
    const { r } = await open();
    expect(useQuestRunStore.getState().stepIndex).toBe(0);
    expect(buttonsNamed(r.root, en.learner.quest.continue.cta)).toHaveLength(1);
  });
});
