import React from 'react';
import { Text } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary';
import { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoryChunkMismatch, StoryChunkTimeout } from '../../logic/story/story-chunk-store';
import { byTestId, render } from '../../test-support/render';

/**
 * `useStoryReady` (F-CURR-002 §10, row CM-8) on a cold story: the reader and its games wait for the chunk; a
 * chunk of a newer build reloads the page once (as the lesson chunks do, row CM-5), and any other failure (or
 * a reload that was refused) reaches the crash screen. The global test setup preloads the app's own store,
 * so the store and the reload are stand-ins here.
 */
const h = vi.hoisted(() => ({
  ready: false,
  reject: null as null | ((error: unknown) => void),
  resolve: null as null | (() => void),
  listeners: new Set<() => void>(),
  version: 0,
  reload: vi.fn(() => false),
}));

vi.mock('../../platform/new-build-reload', () => ({ reloadForNewBuild: () => h.reload() }));
vi.mock('../../content/stories', () => ({
  storiesAll: [],
  storyContent: {
    subscribe: (l: () => void) => {
      h.listeners.add(l);
      return () => h.listeners.delete(l);
    },
    version: () => h.version,
    isStoryReady: () => h.ready,
    ensureAll: () => Promise.resolve(),
    ensureStories: () =>
      new Promise<void>((resolve, reject) => {
        h.resolve = () => {
          h.ready = true;
          h.version += 1;
          resolve();
          for (const l of [...h.listeners]) l();
        };
        h.reject = (error) => {
          h.version += 1;
          reject(error);
          for (const l of [...h.listeners]) l();
        };
      }),
  },
}));

const { useStoryReady } = await import('../story-content');

function Reader(): React.ReactElement {
  return useStoryReady('story:sun-and-moon') ? <Text testID="body">body</Text> : <Text testID="waiting">waiting</Text>;
}

const tree = (): React.ReactElement => (
  <ErrorBoundary fallbackRender={() => <Text testID="crash">crash</Text>}>
    <Reader />
  </ErrorBoundary>
);

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe('useStoryReady (the reader, its games, Sources and Results)', () => {
  beforeEach(() => {
    h.ready = false;
    h.reload.mockReset();
    h.reload.mockReturnValue(false);
  });

  it('waits for the chunk, then draws the body', async () => {
    const r = await render(tree());
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
    await act(async () => h.resolve?.());
    await settle();
    expect(byTestId(r.root, 'body')).toHaveLength(1);
  });

  it('a chunk of a newer build reloads the page instead of reaching the crash screen', async () => {
    h.reload.mockReturnValue(true);
    const r = await render(tree());
    await act(async () => h.reject?.(new StoryChunkMismatch('story:sun-and-moon', 'a', 'b')));
    await settle();
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'crash')).toHaveLength(0);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
  });

  it('a newer-build chunk reaches the crash screen when the reload was refused; a timeout never reloads', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await render(tree());
    await act(async () => h.reject?.(new Error('Requiring unknown module "812".')));
    await settle();
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'crash')).toHaveLength(1);

    h.reload.mockReset();
    const again = await render(tree());
    await act(async () => h.reject?.(new StoryChunkTimeout('story:sun-and-moon', 15_000)));
    await settle();
    expect(h.reload).not.toHaveBeenCalled();
    expect(byTestId(again.root, 'crash')).toHaveLength(1);
    errors.mockRestore();
  });
});
