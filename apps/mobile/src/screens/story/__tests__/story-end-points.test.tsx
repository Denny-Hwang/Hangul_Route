import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questsAll } from '../../../content/quests';
import { storyById } from '../../../content/stories';
import { storyIdOfQuest } from '../../../logic/story/story-ref';
import { recordActivityPointsLater } from '../../../store/goals-entry';
import { useProfileStore } from '../../../store/profile-store';
import { byTestId, press, render, unmount } from '../../../test-support/render';
import { StoryReaderScreen } from '../StoryReaderScreen';

/**
 * A story read to its end page keeps its points however the reader leaves (F-TCH-004 section 3.5 amendment NB-1,
 * F-CURR-002 section 7.4): the end page reached earns them once, so Close or Back from the end page counts as Done.
 * A reader who leaves before the end page earns none, as before.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
    useIsFocused: () => true,
  };
});
vi.mock('../../../store/goals-entry', () => ({ recordActivityPointsLater: vi.fn(async () => undefined) }));
vi.mock('../../use-practice-session', () => ({ usePracticeSession: () => undefined }));

const PROFILE = 'profile:mina';
const storyId = questsAll.map((q) => storyIdOfQuest(q)).find((id): id is string => id !== null)!;
const level = 'listen' as const;
const mounted: ReactTestRenderer[] = [];

function navigation() {
  return { navigate: vi.fn(), push: vi.fn(), goBack: vi.fn(), canGoBack: () => true, setOptions: vi.fn(), addListener: () => () => undefined };
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function readerAt(sceneIndex: number): Promise<ReactTestRenderer> {
  const r = await render(<StoryReaderScreen route={{ params: { storyId, level, mode: 'replay', sceneIndex } }} navigation={navigation() as never} />);
  mounted.push(r);
  await settle();
  return r;
}

const clickable = (r: ReactTestRenderer, id: string) => byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function');

beforeEach(() => {
  vi.mocked(recordActivityPointsLater).mockClear();
  useProfileStore.setState({
    profiles: [{ id: PROFILE, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' }],
    activeId: PROFILE,
  });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useProfileStore.setState({ profiles: [], activeId: null });
});

describe('story points on the end page (row NB-1)', () => {
  it('reaching the end page earns the points once, before any Done, so leaving with Close or Back keeps them', async () => {
    const story = storyById(storyId);
    expect(story).toBeDefined();
    const tier = story!.tiers.find((t) => t.level === level)!;
    const r = await readerAt(tier.scenes.length - 1);
    expect(recordActivityPointsLater).not.toHaveBeenCalled();
    await press(clickable(r, 'story-reader-next')!);
    await settle();
    expect(clickable(r, 'story-reader-end-primary')).toBeDefined();
    expect(recordActivityPointsLater).toHaveBeenCalledTimes(1);
    expect(recordActivityPointsLater).toHaveBeenCalledWith(PROFILE, 'story');
    // Done afterwards adds nothing: one story, one award.
    await press(clickable(r, 'story-reader-end-primary')!);
    await settle();
    expect(recordActivityPointsLater).toHaveBeenCalledTimes(1);
  });

  it('a reader who leaves before the end page earns nothing', async () => {
    await readerAt(0);
    expect(recordActivityPointsLater).not.toHaveBeenCalled();
  });
});
