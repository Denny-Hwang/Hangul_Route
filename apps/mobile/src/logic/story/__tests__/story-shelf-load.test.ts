import { describe, expect, it, vi } from 'vitest';
import type { StoryShelfChunk } from '../story-chunk-store';
import {
  STORY_SHELF_BUNDLE,
  StoryShelfMismatch,
  StoryShelfTimeout,
  createStoryShelfSlot,
  isStoryShelfNewBuildError,
  loadShelfChunk,
} from '../story-shelf-load';

/** The story shelf as a chunk of its own (F-CURR-002 §10, row CM-8b): the loader the web boot runs before the app. */
const chunk = (hash: string): StoryShelfChunk => ({ CHUNK_HASH: hash, STORY_SHELF: [], HELD_STORY_CARDS: [] });

describe('loadShelfChunk', () => {
  it('resolves the chunk that carries the hash the start bundle names', async () => {
    await expect(loadShelfChunk({ load: () => Promise.resolve(chunk('h1')), hash: 'h1' })).resolves.toEqual(chunk('h1'));
    await expect(loadShelfChunk({ load: () => Promise.resolve(chunk('h1')), hash: 'h1', timeoutMs: 1_000 })).resolves.toEqual(chunk('h1'));
  });

  it('rejects a chunk of another build (StoryShelfMismatch), with or without a time limit', async () => {
    await expect(loadShelfChunk({ load: () => Promise.resolve(chunk('old')), hash: 'h1' })).rejects.toBeInstanceOf(StoryShelfMismatch);
    const error = await loadShelfChunk({ load: () => Promise.resolve(chunk('old')), hash: 'h1', timeoutMs: 1_000 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StoryShelfMismatch);
    expect((error as StoryShelfMismatch).expected).toBe('h1');
    expect((error as StoryShelfMismatch).actual).toBe('old');
  });

  it('passes a failed load on', async () => {
    const offline = new Error('Failed to fetch');
    await expect(loadShelfChunk({ load: () => Promise.reject(offline), hash: 'h1', timeoutMs: 1_000 })).rejects.toBe(offline);
  });

  it('a load that hangs past the limit fails with StoryShelfTimeout and gives up the pending script by its bundle name', async () => {
    vi.useFakeTimers();
    try {
      const abandon = vi.fn();
      const hung = loadShelfChunk({ load: () => new Promise<StoryShelfChunk>(() => undefined), hash: 'h1', timeoutMs: 15_000, abandon });
      const failed = expect(hung).rejects.toBeInstanceOf(StoryShelfTimeout);
      await vi.advanceTimersByTimeAsync(15_000);
      await failed;
      expect(abandon).toHaveBeenCalledWith(STORY_SHELF_BUNDLE);
      expect(STORY_SHELF_BUNDLE).toBe('stories-shelf');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('isStoryShelfNewBuildError', () => {
  it('is true for a chunk of another build and for the HTML page Metro found no module in, false for a network failure', () => {
    expect(isStoryShelfNewBuildError(new StoryShelfMismatch('a', 'b'))).toBe(true);
    expect(isStoryShelfNewBuildError(new Error('Requiring unknown module "123".'))).toBe(true);
    expect(isStoryShelfNewBuildError(new StoryShelfTimeout(15_000))).toBe(false);
    expect(isStoryShelfNewBuildError(new Error('Failed to fetch'))).toBe(false);
    expect(isStoryShelfNewBuildError('nope')).toBe(false);
  });
});

describe('createStoryShelfSlot', () => {
  it('reading the shelf before it is in throws; after ensure it is the loaded chunk', async () => {
    const slot = createStoryShelfSlot({ load: () => Promise.resolve(chunk('h1')), hash: 'h1' });
    expect(slot.isIn()).toBe(false);
    expect(() => slot.shelf()).toThrow(/before its chunk is in/);
    await slot.ensure();
    expect(slot.isIn()).toBe(true);
    expect(slot.shelf()).toEqual(chunk('h1'));
  });

  it('loads once: calls while loading share the load, and a call once it is in loads nothing', async () => {
    const load = vi.fn(() => Promise.resolve(chunk('h1')));
    const slot = createStoryShelfSlot({ load, hash: 'h1' });
    await Promise.all([slot.ensure(), slot.ensure()]);
    await slot.ensure();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a failed load is forgotten, so the next ensure (Try again) asks again', async () => {
    let attempt = 0;
    const slot = createStoryShelfSlot({
      load: () => {
        attempt += 1;
        return attempt === 1 ? Promise.reject(new Error('Failed to fetch')) : Promise.resolve(chunk('h1'));
      },
      hash: 'h1',
    });
    await expect(slot.ensure()).rejects.toThrow('Failed to fetch');
    expect(slot.isIn()).toBe(false);
    await slot.ensure();
    expect(attempt).toBe(2);
    expect(slot.isIn()).toBe(true);
  });
});
