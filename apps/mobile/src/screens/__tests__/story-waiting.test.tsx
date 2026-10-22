import type { Quest } from '@hangul-route/content-schema';
import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questsAll } from '../../content/quests';
import { storyIdOfQuest, storyReadStep } from '../../logic/story/story-ref';
import { byTestId, render, unmount } from '../../test-support/render';
import { MinigameScreen } from '../minigames/MinigameScreen';
import { QuestPlayerView } from '../quest/QuestPlayerView';
import { CultureNotesScreen } from '../story/CultureNotesScreen';
import { StoryReaderScreen } from '../story/StoryReaderScreen';
import { StorySourcesScreen } from '../story/StorySourcesScreen';

/**
 * The story screens while their story's chunk loads (F-CURR-002 §10, row CM-8). The global test setup
 * preloads every story chunk, so this file holds the readiness hooks of `screens/story-content.tsx` (whose
 * own behaviour `story-content.test.tsx` drives from a cold store) and checks what each screen draws:
 * only the waiting state (the way back, then a calm status line) until its story is in, then its body.
 */
const ready = vi.hoisted(() => ({ story: false, notes: false, asked: [] as Array<string | null | undefined> }));
vi.mock('../story-content', async (importOriginal) => {
  const real = await importOriginal<typeof import('../story-content')>();
  const { storyIdOfQuest: idOf } = await import('../../logic/story/story-ref');
  return {
    ...real,
    useStoryReady: (storyId: string | null | undefined) => {
      ready.asked.push(storyId);
      return storyId == null || ready.story;
    },
    useStoryQuestReady: (quest: Quest | undefined) => {
      const storyId = quest === undefined ? null : idOf(quest);
      ready.asked.push(storyId);
      return storyId === null || ready.story;
    },
    useNoteStoriesReady: () => ready.notes,
  };
});

// The native navigation package and the stroke games' gesture handler have no build that loads in Node.
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});
vi.mock('../minigames/TraceStrokeGame', () => ({ TraceStrokeGame: () => null }));
vi.mock('../minigames/TraceWordGame', () => ({ TraceWordGame: () => null }));

const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  ready.story = false;
  ready.notes = false;
  ready.asked.length = 0;
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

const storyQuest = questsAll.find((q) => storyIdOfQuest(q) !== null);
if (storyQuest === undefined) throw new Error('a story quest ships');
const storyId = storyIdOfQuest(storyQuest)!;
const level = storyReadStep(storyQuest)?.ref.level ?? 'listen';
const navigation = { navigate: vi.fn(), push: vi.fn(), goBack: vi.fn(), canGoBack: () => true, setOptions: vi.fn(), addListener: () => () => undefined };
const waiting = (r: ReactTestRenderer): number => byTestId(r.root, 'lesson-waiting').length;

async function mount(element: React.ReactElement): Promise<ReactTestRenderer> {
  const r = await render(element);
  mounted.push(r);
  return r;
}

describe('the story screens draw only their waiting state until the story chunk is in', () => {
  it('the reader', async () => {
    const r = await mount(<StoryReaderScreen route={{ params: { storyId, level, mode: 'replay', sceneIndex: 0 } }} navigation={navigation as never} />);
    expect(waiting(r)).toBe(1);
    expect(ready.asked).toContain(storyId);
  });

  it('Sources, then its body once the chunk is in', async () => {
    const first = await mount(<StorySourcesScreen route={{ params: { storyId, from: 'reader' } as never }} navigation={navigation as never} />);
    expect(waiting(first)).toBe(1);
    expect(byTestId(first.root, 'story-sources')).toHaveLength(0);
    ready.story = true;
    const second = await mount(<StorySourcesScreen route={{ params: { storyId, from: 'reader' } as never }} navigation={navigation as never} />);
    expect(waiting(second)).toBe(0);
    expect(byTestId(second.root, 'story-sources').length).toBeGreaterThan(0);
  });

  it('the quest player of a story quest', async () => {
    const noop = (): void => undefined;
    const r = await mount(
      <QuestPlayerView questId={storyQuest.id} episodeId="episode:any" ports={{} as never} onOpenGame={noop} onBack={noop} />,
    );
    expect(waiting(r)).toBe(1);
    expect(ready.asked).toContain(storyId);
  });

  it('the game screen of a story game', async () => {
    const r = await mount(<MinigameScreen route={{ params: { questId: storyQuest.id, stepIndex: 0 } } as never} navigation={navigation as never} />);
    expect(waiting(r)).toBe(1);
    expect(ready.asked).toContain(storyId);
  });

  it('Culture notes waits for the stories that carry notes, never flashing its empty card', async () => {
    const r = await mount(<CultureNotesScreen route={{ key: 'notes', name: 'CultureNotes', params: {} }} navigation={navigation as never} />);
    expect(waiting(r)).toBe(1);
    ready.notes = true;
    const after = await mount(<CultureNotesScreen route={{ key: 'notes', name: 'CultureNotes', params: {} }} navigation={navigation as never} />);
    expect(waiting(after)).toBe(0);
  });
});
