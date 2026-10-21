import type { Story } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React, { useState } from 'react';
import { Text } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary';
import { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { createLessonStore } from '../../logic/lessons/lesson-store';
import { StoryChunkMismatch, createStoryStore, splitStory, type StoryBodyChunk } from '../../logic/story/story-chunk-store';
import { readyStory } from '../../logic/story/__tests__/story-fixture';
import { buttonsNamed, byTestId, press, render } from '../../test-support/render';
import { lessonContentBindings } from '../lesson-content';
import { storyContentBindings } from '../story-content';
import { OopsScreen } from '../system/OopsScreen';

/**
 * The screens' side of the on-demand story chunks (F-CURR-002 §10, row CM-8) from a cold store. The
 * global test setup preloads the app's own store, so these drive `storyContentBindings` (and the story
 * half of `withLessonContent`) with a store of their own whose loads resolve or reject only when a test
 * says so.
 */
const TRY_AGAIN = getMessages('en').common.buttons.tryAgain;
const sun: Story = readyStory();
const moon: Story = { ...sun, id: 'story:moon', title: { ...sun.title, en: 'Moon' } };
const split = { [sun.id]: splitStory(sun, 'h-sun'), [moon.id]: splitStory(moon, 'h-moon') };
const chunkOf = (id: string, hash?: string): StoryBodyChunk => ({ CHUNK_HASH: hash ?? split[id]!.entry.chunk, STORY_BODY: split[id]!.body });

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A store whose every load waits for the test: `pending[id]` holds the latest request of each chunk. */
function coldStore() {
  const pending: Record<string, Deferred<StoryBodyChunk>> = {};
  const asked: string[] = [];
  const store = createStoryStore({ entries: [split[sun.id]!.entry, split[moon.id]!.entry] }, (id) => {
    asked.push(id);
    pending[id] = deferred<StoryBodyChunk>();
    return pending[id].promise;
  });
  return { store, pending, asked };
}

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

function bindings(over: { reload?: () => boolean; noteStoryIds?: readonly string[]; answer?: (error: unknown) => Promise<boolean> } = {}) {
  const cold = coldStore();
  const reload = vi.fn(over.reload ?? (() => false));
  const answer = vi.fn(over.answer ?? (async () => false));
  const b = storyContentBindings({ store: cold.store, noteStoryIds: over.noteStoryIds ?? [moon.id], reloadForNewBuild: reload, isNewBuildAnswer: answer });
  return { ...cold, ...b, reload, answer };
}

function Reader({ hook, storyId }: { hook: (id: string | null) => boolean; storyId: string | null }): React.ReactElement {
  return hook(storyId) ? <Text testID="body">{`scenes of ${storyId ?? 'none'}`}</Text> : <Text testID="waiting">waiting</Text>;
}

describe('useStoryReady (the reader, its games, Sources)', () => {
  it('draws only the waiting state until the story’s chunk is in, then the body; no other story loads', async () => {
    const t = bindings();
    const r = await render(<Reader hook={t.useStoryReady} storyId={sun.id} />);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
    expect(t.asked).toEqual([sun.id]);
    await act(async () => t.pending[sun.id]?.resolve(chunkOf(sun.id)));
    expect(byTestId(r.root, 'body')).toHaveLength(1);
    expect(t.asked).toEqual([sun.id]);
  });

  it('is ready at once for no story, and for an id that is not a bundled story', async () => {
    const t = bindings();
    const none = await render(<Reader hook={t.useStoryReady} storyId={null} />);
    const unknown = await render(<Reader hook={t.useStoryReady} storyId="story:not-bundled" />);
    expect(byTestId(none.root, 'body')).toHaveLength(1);
    expect(byTestId(unknown.root, 'body')).toHaveLength(1);
    expect(t.asked).toEqual([]);
  });

  it('a failed load reaches the crash screen, and Try again loads the chunk again', async () => {
    const t = bindings();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await render(
      <ErrorBoundary fallbackRender={({ resetErrorBoundary }) => <OopsScreen onRetry={resetErrorBoundary} />}>
        <Reader hook={t.useStoryReady} storyId={sun.id} />
      </ErrorBoundary>,
    );
    await act(async () => t.pending[sun.id]?.reject(new Error('offline')));
    await settle();
    const retry = buttonsNamed(r.root, TRY_AGAIN);
    expect(retry).toHaveLength(1);
    expect(t.reload).not.toHaveBeenCalled();
    await press(retry[0]!);
    expect(t.asked).toEqual([sun.id, sun.id]);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
    await act(async () => t.pending[sun.id]?.resolve(chunkOf(sun.id)));
    expect(byTestId(r.root, 'body')).toHaveLength(1);
    errors.mockRestore();
  });

  it('a chunk of a newer build reloads the page instead of throwing', async () => {
    const t = bindings({ reload: () => true });
    const r = await render(<Reader hook={t.useStoryReady} storyId={sun.id} />);
    await act(async () => t.pending[sun.id]?.resolve(chunkOf(sun.id, 'another-build')));
    await settle();
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
  });

  it('a script error whose URL now answers for a newer build (its HTML page refused as a script) reloads the page', async () => {
    const t = bindings({ reload: () => true, answer: async () => true });
    const r = await render(<Reader hook={t.useStoryReady} storyId={sun.id} />);
    const refused = Object.assign(new Error('Loading module failed.'), { name: 'AsyncRequireError' });
    await act(async () => t.pending[sun.id]?.reject(refused));
    await settle();
    expect(t.answer).toHaveBeenCalledWith(refused);
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
  });

  it('a newer-build chunk throws when the reload was refused (offline, or reloaded a moment ago)', async () => {
    const t = bindings({ reload: () => false });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await render(
      <ErrorBoundary fallbackRender={() => <Text testID="crash">crash</Text>}>
        <Reader hook={t.useStoryReady} storyId={sun.id} />
      </ErrorBoundary>,
    );
    await act(async () => t.pending[sun.id]?.reject(new Error('Requiring unknown module "904".')));
    await settle();
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'crash')).toHaveLength(1);
    errors.mockRestore();
  });

  it('a host that reuses the screen for another story never shows the old story’s failure', async () => {
    const t = bindings();
    let show: (id: string) => void = () => undefined;
    function Host(): React.ReactElement {
      const [storyId, setStoryId] = useState(sun.id);
      show = setStoryId;
      return (
        <ErrorBoundary fallbackRender={() => <Text testID="crash">crash</Text>}>
          <Reader hook={t.useStoryReady} storyId={storyId} />
        </ErrorBoundary>
      );
    }
    const r = await render(<Host />);
    await act(async () => show(moon.id));
    await act(async () => t.pending[sun.id]?.reject(new Error('offline')));
    await settle();
    expect(byTestId(r.root, 'crash')).toHaveLength(0);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
    await act(async () => t.pending[moon.id]?.resolve(chunkOf(moon.id)));
    expect(byTestId(r.root, 'body')).toHaveLength(1);
  });
});

describe('useStoryLoaded (a card face, a card page)', () => {
  it('loads its story and redraws when that chunk arrives, not when another story’s does; a failure keeps the placeholder', async () => {
    const t = bindings();
    const renders: boolean[] = [];
    function Card(): null {
      renders.push(t.useStoryLoaded(sun.id));
      return null;
    }
    await render(<Card />);
    expect(renders).toEqual([false]);
    expect(t.asked).toEqual([sun.id]);
    // Another story arriving changes the store, not this card.
    const other = t.store.ensureStories([moon.id]);
    await act(async () => t.pending[moon.id]?.resolve(chunkOf(moon.id)));
    await other;
    expect(renders).toEqual([false]);
    await act(async () => t.pending[sun.id]?.reject(new Error('offline')));
    await settle();
    expect(renders.every((r) => !r)).toBe(true);
    // The next mount tries again and draws the cover once it is in.
    const again: boolean[] = [];
    function Again(): null {
      again.push(t.useStoryLoaded(sun.id));
      return null;
    }
    await render(<Again />);
    await act(async () => t.pending[sun.id]?.resolve(chunkOf(sun.id)));
    expect(again.at(-1)).toBe(true);
    expect(t.asked.filter((id) => id === sun.id)).toHaveLength(2);
  });

  it('is ready at once for a card with no story', async () => {
    const t = bindings();
    const seen: boolean[] = [];
    function Card(): null {
      seen.push(t.useStoryLoaded(undefined));
      return null;
    }
    await render(<Card />);
    expect(seen).toEqual([true]);
    expect(t.asked).toEqual([]);
  });
});

describe('useStoriesLoaded and useStoryContentVersion (the shelf, Home, every story)', () => {
  it('load the stories asked for (or all) and change as each arrives; a failed one is swallowed', async () => {
    const t = bindings();
    const seen: number[] = [];
    function Shelf(): null {
      seen.push(t.useStoriesLoaded([moon.id]));
      return null;
    }
    await render(<Shelf />);
    expect(t.asked).toEqual([moon.id]);
    await act(async () => t.pending[moon.id]?.resolve(chunkOf(moon.id)));
    expect(new Set(seen).size).toBe(2);

    const all = bindings();
    const versions: number[] = [];
    function Every(): null {
      versions.push(all.useStoryContentVersion());
      return null;
    }
    await render(<Every />);
    expect(all.asked.sort()).toEqual([moon.id, sun.id].sort());
    await act(async () => all.pending[sun.id]?.resolve(chunkOf(sun.id)));
    await act(async () => all.pending[moon.id]?.reject(new Error('offline')));
    await settle();
    expect(new Set(versions).size).toBeGreaterThanOrEqual(3);
  });
});

describe('useNoteStoriesReady (Culture notes)', () => {
  function Notes({ hook }: { hook: () => boolean }): React.ReactElement {
    return hook() ? <Text testID="notes">notes</Text> : <Text testID="waiting">waiting</Text>;
  }

  it('waits for every story that carries notes, then shows the notes', async () => {
    const t = bindings({ noteStoryIds: [sun.id, moon.id] });
    const r = await render(<Notes hook={t.useNoteStoriesReady} />);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
    await act(async () => t.pending[sun.id]?.resolve(chunkOf(sun.id)));
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
    await act(async () => t.pending[moon.id]?.resolve(chunkOf(moon.id)));
    expect(byTestId(r.root, 'notes')).toHaveLength(1);
  });

  it('a note story that fails reaches the crash screen (a found note never goes missing), and Try again loads it', async () => {
    const t = bindings({ noteStoryIds: [sun.id, moon.id] });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await render(
      <ErrorBoundary fallbackRender={({ resetErrorBoundary }) => <OopsScreen onRetry={resetErrorBoundary} />}>
        <Notes hook={t.useNoteStoriesReady} />
      </ErrorBoundary>,
    );
    await act(async () => t.pending[sun.id]?.resolve(chunkOf(sun.id)));
    await act(async () => t.pending[moon.id]?.reject(new Error('offline')));
    await settle();
    expect(byTestId(r.root, 'notes')).toHaveLength(0);
    const retry = buttonsNamed(r.root, TRY_AGAIN);
    expect(retry).toHaveLength(1);
    expect(t.reload).not.toHaveBeenCalled();
    await press(retry[0]!);
    expect(t.asked.filter((id) => id === moon.id)).toHaveLength(2);
    expect(t.asked.filter((id) => id === sun.id)).toHaveLength(1);
    await act(async () => t.pending[moon.id]?.resolve(chunkOf(moon.id)));
    expect(byTestId(r.root, 'notes')).toHaveLength(1);
    errors.mockRestore();
  });

  it('a note story of a newer build reloads the page instead', async () => {
    const t = bindings({ noteStoryIds: [sun.id], reload: () => true });
    const r = await render(<Notes hook={t.useNoteStoriesReady} />);
    await act(async () => t.pending[sun.id]?.resolve(chunkOf(sun.id, 'another-build')));
    await settle();
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
  });

  it('is ready at once when every note story is in', async () => {
    const t = bindings({ noteStoryIds: [sun.id] });
    const loading = t.store.ensureStories([sun.id]);
    t.pending[sun.id]?.resolve(chunkOf(sun.id));
    await loading;
    const seen: boolean[] = [];
    function Notes(): null {
      seen.push(t.useNoteStoriesReady());
      return null;
    }
    await render(<Notes />);
    expect(seen).toEqual([true]);
  });
});

describe('withLessonContent with the story chunks (All lessons and the presenter)', () => {
  function Root(): React.ReactElement {
    return <Text testID="root">root</Text>;
  }
  /** Lessons already in (an empty manifest); the stories from a cold store. */
  function roots(over: { reload?: () => boolean } = {}) {
    const stories = coldStore();
    const lessons = createLessonStore({ episodes: [], cells: {}, titles: { es: 'h-es', ko: 'h-ko' } }, { cell: () => undefined, titles: () => new Promise(() => undefined) });
    const reload = vi.fn(over.reload ?? (() => false));
    const b = lessonContentBindings({ store: lessons, locale: () => 'en', reloadForNewBuild: reload, isNewBuildAnswer: async () => false, stories: stories.store });
    return { ...stories, ...b, reload };
  }

  it('waits for every story chunk, then mounts the root', async () => {
    const t = roots();
    const Wrapped = t.withLessonContent(Root);
    const r = await render(<Wrapped />);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
    expect(t.asked.sort()).toEqual([moon.id, sun.id].sort());
    await act(async () => t.pending[sun.id]?.resolve(chunkOf(sun.id)));
    expect(byTestId(r.root, 'root')).toHaveLength(0);
    await act(async () => t.pending[moon.id]?.resolve(chunkOf(moon.id)));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(1);
  });

  it('a story chunk that fails shows the crash screen, never a root without that story; Try again loads it', async () => {
    const t = roots();
    const Wrapped = t.withLessonContent(Root);
    const r = await render(<Wrapped />);
    await act(async () => t.pending[sun.id]?.resolve(chunkOf(sun.id)));
    await act(async () => t.pending[moon.id]?.reject(new Error('offline')));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(0);
    const retry = buttonsNamed(r.root, TRY_AGAIN);
    expect(retry).toHaveLength(1);
    await press(retry[0]!);
    expect(t.asked.filter((id) => id === moon.id)).toHaveLength(2);
    expect(t.asked.filter((id) => id === sun.id)).toHaveLength(1);
    await act(async () => t.pending[moon.id]?.resolve(chunkOf(moon.id)));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(1);
  });

  it('a story chunk of a newer build reloads the page', async () => {
    const t = roots({ reload: () => true });
    const Wrapped = t.withLessonContent(Root);
    const r = await render(<Wrapped />);
    await act(async () => t.pending[sun.id]?.reject(new StoryChunkMismatch(sun.id, 'h-sun', 'x')));
    await act(async () => t.pending[moon.id]?.resolve(chunkOf(moon.id)));
    await settle();
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
  });
});
