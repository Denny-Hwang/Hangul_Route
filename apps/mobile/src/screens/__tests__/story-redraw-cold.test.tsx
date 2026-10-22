import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StoryBodyChunk } from '../../logic/story/story-chunk-store';

/**
 * The screens that draw story bodies as their chunks arrive (F-CURR-002 §10, row CM-8), from a cold
 * store. The global test setup preloads the app's story store, so this file swaps `content/stories` for
 * the same shelf over a store whose chunks arrive only when a test hands them over (`cold.arrive`). Each
 * redraw site mounts with nothing loaded, shows its placeholder (the theme tint for a cover, the card's
 * keyword alone for the words), and draws the body once its story's chunk is in: the memo keys
 * (`coverChunks`, `storyChunks`) are what make it redraw. Results knows its story extras from the shelf
 * (`logic/story/__tests__/results-extras.test.ts`), so it has nothing to redraw.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const cold = vi.hoisted(() => ({
  waiting: new Map<string, (chunk: StoryBodyChunk) => void>(),
  ensure: null as null | ((ids: readonly string[]) => Promise<void>),
}));

vi.mock('../../content/stories', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../content/stories')>();
  const { STORY_SHELF, loadStoryBody } = await import('../../content/__generated__/stories-index');
  const { createStoryStore, storiesOverStore } = await import('../../logic/story/story-chunk-store');
  const store = createStoryStore({ entries: STORY_SHELF }, (id) =>
    loadStoryBody(id) === undefined
      ? undefined
      : new Promise<StoryBodyChunk>((resolve) => {
          cold.waiting.set(id, resolve);
        }),
  );
  cold.ensure = store.ensureStories;
  const storiesAll = storiesOverStore(STORY_SHELF, store);
  const byId = new Map(storiesAll.map((s) => [s.id, s]));
  return { ...real, storyContent: store, storiesAll, storyById: (id: string) => byId.get(id) };
});
vi.mock('@react-navigation/native', async () => {
  const { createContext } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});

const { STORY_SHELF, loadStoryBody } = await import('../../content/__generated__/stories-index');
const { episodesAll } = await import('../../content/episodes');
const { storyEpisodeEntries } = await import('../../logic/story/story-episode');
const { defaultStoryIndex } = await import('../../logic/story/story-index');
const { byTestId, render, unmount } = await import('../../test-support/render');
const { useLocaleStore } = await import('../../store/locale-store');
const { StoryEpisodeDetail } = await import('../episode/StoryEpisodeDetail');
const { useStoryTiles } = await import('../library/StoryTileGrid');
type Tiles = ReturnType<typeof useStoryTiles>;

/** Hands the real chunk of a story to the cold store, as the precache would. */
async function arrive(storyId: string): Promise<void> {
  const chunk = (await loadStoryBody(storyId)) as StoryBodyChunk;
  await act(async () => {
    const resolve = cold.waiting.get(storyId);
    if (resolve === undefined) throw new Error(`${storyId} was never asked for`);
    resolve(chunk);
    await cold.ensure?.([storyId]);
  });
}

const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useLocaleStore.setState({ device: null, deviceAt: null });
});

describe('the story tile grid (Library, the cell page): covers from a cold store', () => {
  it('draws the theme tint until a story’s chunk is in, then its cover; the other tiles keep theirs', async () => {
    const entries = defaultStoryIndex().slice(0, 2);
    expect(entries).toHaveLength(2);
    const seen: Tiles[] = [];
    function Grid(): null {
      seen.push(useStoryTiles(entries));
      return null;
    }
    mounted.push(await render(<Grid />));
    expect([...cold.waiting.keys()].sort()).toEqual(entries.map((e) => e.storyId).sort());
    expect(seen.at(-1)!.items.map((i) => i.view.cover)).toEqual([null, null]);

    await arrive(entries[0]!.storyId);
    const [first, second] = seen.at(-1)!.items;
    expect(first!.view.cover).not.toBeNull();
    expect(second!.view.cover).toBeNull();

    await arrive(entries[1]!.storyId);
    expect(seen.at(-1)!.items.every((i) => i.view.cover !== null)).toBe(true);
  });
});

describe('the story episode page: words from a cold store', () => {
  // Single-story pages whose stories no other test of this file loads (the store keeps what it loaded).
  const tiled = new Set(defaultStoryIndex().slice(0, 2).map((e) => e.storyId));
  const pages = episodesAll
    .map((episode) => ({ episode, entries: storyEpisodeEntries(episode, defaultStoryIndex()) }))
    .filter((e) => e.entries !== null && e.entries.length === 1 && !tiled.has(e.entries[0]!.storyId));

  // In Spanish the page draws a localized copy of each story, which reads the body once: the memo must make it again.
  it.each([
    ['en', 0],
    ['es', 1],
  ] as const)('lists only the card’s keyword until the story’s chunk is in, then every word (%s)', async (locale, page) => {
    const found = pages[page];
    if (!found?.entries) throw new Error('two story episodes ship');
    useLocaleStore.setState({ device: locale, deviceAt: '2026-10-21T09:00:00.000Z', hydrated: true });
    const storyId = found.entries[0]!.storyId;
    expect(STORY_SHELF.some((e) => e.id === storyId)).toBe(true);
    const noop = (): void => undefined;
    const r = await render(
      <StoryEpisodeDetail
        episode={found.episode}
        entries={found.entries}
        cellStoryCount={0}
        onOpenStory={noop}
        onOpenCard={noop}
        onOpenSources={noop}
        onOpenCultureNotes={noop}
        onOpenCellStories={noop}
        onOpenCellStoriesRow={noop}
      />,
    );
    mounted.push(r);
    const speakers = (): number =>
      byTestId(r.root, 'story-episode-words').flatMap((w) =>
        w.findAll((n) => typeof n.props.onClick === 'function' && String(n.props['data-testid'] ?? '').startsWith('story-episode-hear-')),
      ).length;
    expect(cold.waiting.has(storyId)).toBe(true);
    const before = speakers();
    expect(before).toBeLessThanOrEqual(1);

    await arrive(storyId);
    expect(speakers()).toBeGreaterThan(Math.max(before, 1));
  });
});
