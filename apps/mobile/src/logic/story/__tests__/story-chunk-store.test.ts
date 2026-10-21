import { describe, expect, it, vi } from 'vitest';
import type { Story } from '@hangul-route/content-schema';
import {
  SHELF_DEFAULTS,
  STORY_BODY_FIELDS,
  StoryChunkMismatch,
  StoryChunkTimeout,
  createStoryStore,
  isStoryNewBuildError,
  shelfLevelOf,
  splitStory,
  storiesOverStore,
  storyChunkBundleName,
  storyTierLevels,
  type StoryBodyChunk,
  type StoryShelfEntry,
} from '../story-chunk-store';
import { readyStory } from './story-fixture';

/**
 * The lazy path of the story chunks (F-CURR-002 §10, row CM-8): the shelf is in hand at start, a
 * story's body loads on demand, once, from its chunk, checked against the hash the shelf names.
 */
const story: Story = readyStory();
const other: Story = { ...story, id: 'story:other', title: { ...story.title, en: 'Other' } };
const { entry, body } = splitStory(story, 'h-hangul');
const second = splitStory(other, 'h-other');
const entries: StoryShelfEntry[] = [entry, second.entry];

/** A loader that records what it was asked for and resolves on `flush`, so a test sees the in-flight state. */
function loader(chunks: Record<string, StoryBodyChunk> = { [story.id]: { CHUNK_HASH: 'h-hangul', STORY_BODY: body }, [other.id]: { CHUNK_HASH: 'h-other', STORY_BODY: second.body } }) {
  const calls: string[] = [];
  const pending: Array<() => void> = [];
  const fail = new Set<string>();
  const load = (id: string): Promise<StoryBodyChunk> | undefined => {
    const chunk = chunks[id];
    if (chunk === undefined) return undefined;
    calls.push(id);
    return new Promise((resolve, reject) => {
      pending.push(() => (fail.has(id) ? reject(new Error(`offline: ${id}`)) : resolve(chunk)));
    });
  };
  const flush = async (): Promise<void> => {
    for (const settle of pending.splice(0)) settle();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { load, calls, flush, fail };
}

describe('createStoryStore', () => {
  it('loads a story chunk on demand, once, and notifies on arrival', async () => {
    const l = loader();
    const store = createStoryStore({ entries }, l.load);
    const seen: number[] = [];
    store.subscribe(() => seen.push(store.version()));
    expect(store.isStoryReady(story.id)).toBe(false);
    expect(store.bodyOf(story.id)).toBeUndefined();
    const first = store.ensureStories([story.id]);
    const again = store.ensureStories([story.id]);
    expect(l.calls).toEqual([story.id]);
    await l.flush();
    await Promise.all([first, again]);
    expect(store.isStoryReady(story.id)).toBe(true);
    expect(store.bodyOf(story.id)?.tiers).toEqual(story.tiers);
    expect(seen).toEqual([1]);
    // Loaded: no second request.
    await store.ensureStories([story.id]);
    expect(l.calls).toEqual([story.id]);
    expect(store.isAllReady()).toBe(false);
  });

  it('ensureAll loads every story of the shelf; an id outside the shelf is ready and skipped', async () => {
    const l = loader();
    const store = createStoryStore({ entries }, l.load);
    expect(store.isStoryReady('story:not-bundled')).toBe(true);
    const all = store.ensureAll();
    await l.flush();
    await all;
    expect(l.calls.sort()).toEqual([other.id, story.id].sort());
    expect(store.isAllReady()).toBe(true);
    await store.ensureStories(['story:not-bundled']);
    expect(store.entryOf(story.id)).toBe(entry);
    expect(store.entryOf('story:not-bundled')).toBeUndefined();
  });

  it('refuses a chunk whose hash is not the one the shelf names (another build), and can try again', async () => {
    const l = loader({ [story.id]: { CHUNK_HASH: 'h-stale', STORY_BODY: body } });
    const store = createStoryStore({ entries }, l.load);
    const p = expect(store.ensureStories([story.id])).rejects.toThrow(
      new StoryChunkMismatch(story.id, 'h-hangul', 'h-stale'),
    );
    await l.flush();
    await p;
    expect(store.isStoryReady(story.id)).toBe(false);
    // A failed load is not kept: the next ensure asks again.
    const retry = expect(store.ensureStories([story.id])).rejects.toBeInstanceOf(StoryChunkMismatch);
    expect(l.calls).toEqual([story.id, story.id]);
    await l.flush();
    await retry;
    expect(new StoryChunkMismatch(story.id, 'h-hangul', 'h-stale').message).toBe('story chunk story:hangul-day carries h-stale, the manifest names h-hangul');
  });

  it('a failed load notifies (the waiting screen then shows the crash screen) and a retry loads it', async () => {
    const l = loader();
    l.fail.add(story.id);
    const store = createStoryStore({ entries }, l.load);
    let changes = 0;
    store.subscribe(() => {
      changes += 1;
    });
    const p = expect(store.ensureStories([story.id])).rejects.toThrow('offline: story:hangul-day');
    await l.flush();
    await p;
    expect(changes).toBe(1);
    l.fail.clear();
    const retry = store.ensureStories([story.id]);
    await l.flush();
    await retry;
    expect(store.isStoryReady(story.id)).toBe(true);
    expect(changes).toBe(2);
  });

  it('a shelf story without a loader rejects; inline bodies (an e2e build) are ready at start', async () => {
    const store = createStoryStore({ entries }, () => undefined);
    await expect(store.ensureStories([story.id])).rejects.toThrow('no loader for the story chunk of story:hangul-day');
    const inline = createStoryStore({ entries, inline: { [story.id]: body } }, () => undefined);
    expect(inline.isStoryReady(story.id)).toBe(true);
    expect(inline.bodyOf(story.id)).toBe(body);
    expect(inline.isStoryReady(other.id)).toBe(false);
  });

  it('unsubscribe stops notifications', async () => {
    const l = loader();
    const store = createStoryStore({ entries }, l.load);
    let changes = 0;
    const off = store.subscribe(() => {
      changes += 1;
    });
    off();
    const p = store.ensureStories([story.id]);
    await l.flush();
    await p;
    expect(changes).toBe(0);
  });
});

describe('storiesOverStore', () => {
  it('a story reads its shelf at once and its body once its chunk is in, on the same object', async () => {
    const l = loader();
    const store = createStoryStore({ entries }, l.load);
    const [lazy] = storiesOverStore(entries, store);
    expect(lazy?.id).toBe(story.id);
    expect(lazy?.title).toEqual(story.title);
    expect(lazy?.shelf).toEqual(story.shelf);
    expect(lazy?.hoyaIntroEn).toBe(story.hoyaIntroEn);
    expect(lazy?.review.language).toBe(story.review.language);
    // Before the chunk: placeholders, and the card's keyword alone.
    expect(lazy?.tiers).toEqual([]);
    expect(lazy?.facts).toEqual([]);
    expect(lazy?.summaryEn).toBe('');
    expect(lazy?.keywords).toEqual([story.keywords.find((k) => k.id === story.card?.keywordId)]);
    expect(lazy?.review.advisory).toEqual(story.review.advisory);
    expect(lazy?.review.reviewedBy).toBeUndefined();
    // The shelf-only fields are not on the story.
    expect(Object.keys(lazy ?? {})).not.toContain('levels');
    expect(Object.keys(lazy ?? {})).not.toContain('chunk');
    // Levels from the shelf, before the chunk.
    expect(lazy && storyTierLevels(lazy)).toEqual(story.tiers.map((t) => t.level));
    const p = store.ensureStories([story.id]);
    await l.flush();
    await p;
    expect(lazy).toEqual(story);
    expect(lazy?.review.reviewedBy).toBe(story.review.reviewedBy);
  });

  it('fills the shelf defaults back in, and placeholders are schema-shaped', () => {
    const bare = { ...entry };
    delete bare.pillarTags;
    delete bare.companionId;
    delete bare.cultureNotes;
    const [lazy] = storiesOverStore([bare], { bodyOf: () => undefined });
    expect(lazy?.pillarTags).toEqual(SHELF_DEFAULTS.pillarTags);
    expect(lazy?.companionId).toBe('hoya');
    expect(lazy?.cultureNotes).toEqual([]);
    expect(lazy?.v).toBe(1);
    expect(lazy?.origin).toEqual({ type: 'original', noteEn: '' });
    expect(lazy?.verification).toEqual({ passes: 0, checkedAt: '', scope: 'story', notes: '' });
    expect(lazy?.errata).toEqual([]);
    expect(lazy?.referenceDisplay).toBe('');
    expect(lazy?.authorNotes).toBeUndefined();
    const noCard = { ...entry };
    delete noCard.cardKeyword;
    expect(storiesOverStore([noCard], { bodyOf: () => undefined })[0]?.keywords).toEqual([]);
  });

  it('storyTierLevels reads a copy or a fixture from its own tiers', () => {
    const [lazy] = storiesOverStore(entries, { bodyOf: () => undefined });
    expect(lazy && storyTierLevels({ ...lazy })).toEqual([]);
    expect(storyTierLevels(story)).toEqual(story.tiers.map((t) => t.level));
  });
});

describe('splitStory and shelfLevelOf', () => {
  it('splits a story into its shelf entry and the body fields, which together are the story', () => {
    for (const field of STORY_BODY_FIELDS) {
      if (field !== 'review') expect(Object.keys(entry), field).not.toContain(field);
    }
    expect(entry.chunk).toBe('h-hangul');
    expect(entry.levels).toEqual(story.tiers.map((t) => ({ level: t.level, scenes: t.scenes.length })));
    expect(entry.review).toEqual({ language: story.review.language, culture: story.review.culture, advisory: story.review.advisory, advisoryNoteEn: story.review.advisoryNoteEn });
    expect(Object.keys(body).sort()).toEqual(STORY_BODY_FIELDS.filter((f) => story[f] !== undefined).sort());
    const quiet = splitStory({ ...story, review: { ...story.review, advisory: [], advisoryNoteEn: undefined } }, 'h').entry.review;
    expect(quiet).toEqual({ language: story.review.language, culture: story.review.culture });
    expect(splitStory({ ...story, card: undefined }, 'h').entry.cardKeyword).toBeUndefined();
  });

  it('the shelf tier is listen, else the first tier', () => {
    expect(shelfLevelOf([{ level: 'read', scenes: 3 }, { level: 'listen', scenes: 4 }])).toBe('listen');
    expect(shelfLevelOf([{ level: 'read-along', scenes: 3 }, { level: 'read', scenes: 4 }])).toBe('read-along');
    expect(shelfLevelOf([])).toBeUndefined();
  });
});

describe('a hung load, and which failures only a fresh page mends', () => {
  it('a load that has not settled in time fails with StoryChunkTimeout, and a later ensure tries again', async () => {
    vi.useFakeTimers();
    try {
      const calls: string[] = [];
      let answer: ((chunk: StoryBodyChunk) => void) | undefined;
      const store = createStoryStore({ entries }, (id) => {
        calls.push(id);
        return new Promise<StoryBodyChunk>((resolve) => {
          answer = resolve;
        });
      }, { timeoutMs: 1_000 });
      const first = store.ensureStories([story.id]);
      const failed = expect(first).rejects.toBeInstanceOf(StoryChunkTimeout);
      await vi.advanceTimersByTimeAsync(1_000);
      await failed;
      expect(store.isStoryReady(story.id)).toBe(false);
      const second = store.ensureStories([story.id]);
      expect(calls).toEqual([story.id, story.id]);
      answer?.({ CHUNK_HASH: 'h-hangul', STORY_BODY: body });
      await second;
      expect(store.isStoryReady(story.id)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a timed-out load gives up its pending script (Metro keeps it by its path), so the retry asks the network again', async () => {
    vi.useFakeTimers();
    try {
      // Metro's web loader hands a pending load back to every later try until its script tag settles.
      const pendingByBundle = new Map<string, { promise: Promise<StoryBodyChunk>; fail: () => void }>();
      let network: 'hung' | 'back' = 'hung';
      const requests: string[] = [];
      const metroLoad = (bundle: string): Promise<StoryBodyChunk> => {
        const pending = pendingByBundle.get(bundle);
        if (pending !== undefined) return pending.promise;
        requests.push(bundle);
        let fail = (): void => undefined;
        const promise = new Promise<StoryBodyChunk>((resolve, reject) => {
          fail = () => reject(new Error(`Loading module ${bundle} failed.`));
          if (network === 'back') resolve({ CHUNK_HASH: 'h-hangul', STORY_BODY: body });
        });
        promise.catch(() => pendingByBundle.delete(bundle));
        if (network === 'hung') pendingByBundle.set(bundle, { promise, fail });
        return promise;
      };
      const abandon = vi.fn((bundle: string) => pendingByBundle.get(bundle)?.fail());
      const store = createStoryStore({ entries }, (id) => metroLoad(storyChunkBundleName(id)), { timeoutMs: 15_000, abandon });
      const first = expect(store.ensureStories([story.id])).rejects.toBeInstanceOf(StoryChunkTimeout);
      await vi.advanceTimersByTimeAsync(15_000);
      await first;
      expect(abandon).toHaveBeenCalledWith(storyChunkBundleName(story.id));
      network = 'back';
      await store.ensureStories([story.id]);
      expect(store.isStoryReady(story.id)).toBe(true);
      expect(requests).toEqual([storyChunkBundleName(story.id), storyChunkBundleName(story.id)]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('maps a story to the web bundle name of its chunk', () => {
    expect(storyChunkBundleName('story:sejong-new-letters')).toBe('story-sejong-new-letters');
  });

  it('a load in time is not cut off by the timer', async () => {
    const store = createStoryStore({ entries }, () => Promise.resolve({ CHUNK_HASH: 'h-hangul', STORY_BODY: body }), { timeoutMs: 1_000 });
    await store.ensureStories([story.id]);
    expect(store.isStoryReady(story.id)).toBe(true);
  });

  it('another build’s chunk, or the app page served in its place, is a newer build; a network failure or a timeout is not', () => {
    expect(isStoryNewBuildError(new StoryChunkMismatch(story.id, 'a', 'b'))).toBe(true);
    expect(isStoryNewBuildError(new Error('Requiring unknown module "812".'))).toBe(true);
    expect(isStoryNewBuildError(new Error('offline'))).toBe(false);
    expect(isStoryNewBuildError(new StoryChunkTimeout(story.id, 15_000))).toBe(false);
    expect(isStoryNewBuildError('Requiring unknown module')).toBe(false);
  });
});
