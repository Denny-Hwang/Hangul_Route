import type { ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
const reads = vi.hoisted(() => ({ count: 0 }));
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => {
    reads.count += 1;
    return mem.get(k) ?? null;
  }),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));

/** One story quest at the `listen` level, so "finished elsewhere" can be exercised. */
const SUN_LISTEN: Quest = vi.hoisted(() => ({
  id: 'quest:story-sun-and-moon-listen',
  titleEn: 'The Sun and the Moon',
  estimatedMinutes: 5,
  steps: [
    { id: 'i', kind: 'intro', titleEn: 'Hi' },
    { id: 'r', kind: 'practice', titleEn: 'Read', minigameKind: 'story-read', minigameRef: 'minigame:story-read-listen-sun-and-moon' },
  ],
}));
vi.mock('../../content/quests', () => ({ questsAll: [SUN_LISTEN] }));

import { readJson, writeJson } from '../../platform/storage';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { STORY_BOOKMARKS_KEY_PREFIX, useStoryStore } from '../story-store';

const A = 'profile:a';
const B = 'profile:b';
const keyOf = (profileId: string): string => `story:bookmarks:${profileId}`;
const saved = (byStory: Record<string, { level: string; sceneIndex: number; updatedAt: string }>, v: unknown = 1) => ({ v, byStory });
const T_OLD = '2026-10-01T09:00:00.000Z';

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

beforeEach(() => {
  mem.clear();
  reads.count = 0;
  vi.mocked(writeJson).mockClear();
  vi.mocked(readJson).mockClear();
  useStoryStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set(), clearedFor: {} });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(), pendingFor: new Set() });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('story-store: storage key', () => {
  it('saves under story:bookmarks:<profileId> (the hr: prefix is added by platform/storage)', () => {
    expect(STORY_BOOKMARKS_KEY_PREFIX).toBe('story:bookmarks:');
  });
});

describe('story-store: hydrate', () => {
  it('reads each profile\'s saved bookmarks into memory, per profile', async () => {
    mem.set(keyOf(A), saved({ 'story:a': { level: 'listen', sceneIndex: 3, updatedAt: T_OLD } }));
    mem.set(keyOf(B), saved({ 'story:b': { level: 'read', sceneIndex: 2, updatedAt: T_OLD } }));

    await Promise.all([useStoryStore.getState().hydrate(A), useStoryStore.getState().hydrate(B)]);

    const s = useStoryStore.getState();
    expect([...s.hydratedFor].sort()).toEqual([A, B]);
    expect(s.getBookmark(A, 'story:a')).toEqual({ level: 'listen', sceneIndex: 3, updatedAt: T_OLD });
    expect(s.getBookmark(A, 'story:b')).toBeUndefined();
    expect(s.getBookmark(B, 'story:b')?.sceneIndex).toBe(2);
  });

  it('treats corrupt JSON, another version or nothing saved as empty, without throwing or writing', async () => {
    mem.set(keyOf(A), 'not json at all');
    mem.set(keyOf(B), saved({ 'story:a': { level: 'listen', sceneIndex: 3, updatedAt: T_OLD } }, 2));

    await useStoryStore.getState().hydrate(A);
    await useStoryStore.getState().hydrate(B);
    await useStoryStore.getState().hydrate('profile:new');

    const s = useStoryStore.getState();
    expect(s.byProfile[A]).toEqual({ v: 1, byStory: {} });
    expect(s.byProfile[B]).toEqual({ v: 1, byStory: {} });
    expect(s.hydratedFor.has('profile:new')).toBe(true);
    expect(writeJson).not.toHaveBeenCalled();
  });

  it('reads storage once per profile, even for overlapping calls', async () => {
    await Promise.all([useStoryStore.getState().hydrate(A), useStoryStore.getState().hydrate(A)]);
    await useStoryStore.getState().hydrate(A);
    expect(reads.count).toBe(1);
  });
});

describe('story-store: setBookmark / getBookmark / clearBookmark', () => {
  it('writes from scene 1 on and persists the whole file under the profile key', async () => {
    await useStoryStore.getState().hydrate(A);
    useStoryStore.getState().setBookmark(A, 'story:a', { level: 'read-along', sceneIndex: 2 });
    await flush();

    const expected = { level: 'read-along', sceneIndex: 2, updatedAt: '2026-10-11T10:00:00.000Z' };
    expect(useStoryStore.getState().getBookmark(A, 'story:a')).toEqual(expected);
    expect(mem.get(keyOf(A))).toEqual({ v: 1, byStory: { 'story:a': expected } });
  });

  it('writes nothing for scene 0', async () => {
    await useStoryStore.getState().hydrate(A);
    useStoryStore.getState().setBookmark(A, 'story:a', { level: 'listen', sceneIndex: 0 });
    await flush();
    expect(useStoryStore.getState().getBookmark(A, 'story:a')).toBeUndefined();
    expect(writeJson).not.toHaveBeenCalled();
  });

  it('clears one story and persists the rest', async () => {
    mem.set(keyOf(A), saved({ 'story:a': { level: 'listen', sceneIndex: 3, updatedAt: T_OLD }, 'story:b': { level: 'listen', sceneIndex: 1, updatedAt: T_OLD } }));
    await useStoryStore.getState().hydrate(A);

    useStoryStore.getState().clearBookmark(A, 'story:a');
    await flush();

    expect(useStoryStore.getState().getBookmark(A, 'story:a')).toBeUndefined();
    expect(mem.get(keyOf(A))).toEqual(saved({ 'story:b': { level: 'listen', sceneIndex: 1, updatedAt: T_OLD } }));
  });

  it('clearing a story that has no bookmark writes nothing', async () => {
    await useStoryStore.getState().hydrate(A);
    useStoryStore.getState().clearBookmark(A, 'story:none');
    await flush();
    expect(writeJson).not.toHaveBeenCalled();
  });

  it('prunes the bookmark of a story finished at that level on the next write (finished on another device)', async () => {
    mem.set(keyOf(A), saved({ 'story:sun-and-moon': { level: 'listen', sceneIndex: 3, updatedAt: T_OLD } }));
    const done: ProgressSnapshot = {
      profileId: A,
      updatedAt: T_OLD,
      episodes: [],
      quests: [{ questId: SUN_LISTEN.id, episodeId: 'episode:shelf-sun-and-moon', startedAt: T_OLD, completedAt: T_OLD, stars: 3, attempts: 1, accuracy: 1 }],
      cards: [],
      sessions: [],
      homework: [],
      reviews: [],
      streakDays: 1,
    };
    useProgressStore.setState({ byProfile: { [A]: done }, hydratedFor: new Set([A]) });
    await useStoryStore.getState().hydrate(A);
    expect(useStoryStore.getState().getBookmark(A, 'story:sun-and-moon')).toBeDefined();

    useStoryStore.getState().setBookmark(A, 'story:other', { level: 'listen', sceneIndex: 1 });
    await flush();

    expect(useStoryStore.getState().getBookmark(A, 'story:sun-and-moon')).toBeUndefined();
    expect(Object.keys((mem.get(keyOf(A)) as { byStory: object }).byStory)).toEqual(['story:other']);
  });

  it('a failed save keeps the bookmark in memory for the session', async () => {
    await useStoryStore.getState().hydrate(A);
    vi.mocked(writeJson).mockRejectedValueOnce(new Error('quota'));
    useStoryStore.getState().setBookmark(A, 'story:a', { level: 'listen', sceneIndex: 2 });
    await flush();
    expect(useStoryStore.getState().getBookmark(A, 'story:a')?.sceneIndex).toBe(2);
  });
});

describe('story-store: writes before hydration merge on load', () => {
  it('a bookmark written before the saved file loads is kept in memory, then merged with what was saved and persisted', async () => {
    mem.set(keyOf(A), saved({ 'story:saved': { level: 'listen', sceneIndex: 4, updatedAt: T_OLD } }));

    useStoryStore.getState().setBookmark(A, 'story:new', { level: 'listen', sceneIndex: 1 });
    expect(useStoryStore.getState().getBookmark(A, 'story:new')?.sceneIndex).toBe(1);
    expect(mem.get(keyOf(A))).toEqual(saved({ 'story:saved': { level: 'listen', sceneIndex: 4, updatedAt: T_OLD } }));

    await useStoryStore.getState().hydrate(A);

    const file = mem.get(keyOf(A)) as { byStory: Record<string, unknown> };
    expect(Object.keys(file.byStory).sort()).toEqual(['story:new', 'story:saved']);
    expect(useStoryStore.getState().getBookmark(A, 'story:saved')?.sceneIndex).toBe(4);
    expect(useStoryStore.getState().pendingFor.has(A)).toBe(false);
  });

  it('a story cleared before the saved file loads stays cleared', async () => {
    mem.set(keyOf(A), saved({ 'story:a': { level: 'listen', sceneIndex: 4, updatedAt: T_OLD }, 'story:b': { level: 'listen', sceneIndex: 2, updatedAt: T_OLD } }));

    useStoryStore.getState().clearBookmark(A, 'story:a');
    await useStoryStore.getState().hydrate(A);

    expect(useStoryStore.getState().getBookmark(A, 'story:a')).toBeUndefined();
    expect(useStoryStore.getState().getBookmark(A, 'story:b')?.sceneIndex).toBe(2);
    expect(Object.keys((mem.get(keyOf(A)) as { byStory: object }).byStory)).toEqual(['story:b']);
    expect(useStoryStore.getState().clearedFor[A]).toBeUndefined();
  });

  it('the newer of two bookmarks for one story wins', async () => {
    mem.set(keyOf(A), saved({ 'story:a': { level: 'listen', sceneIndex: 5, updatedAt: T_OLD } }));
    useStoryStore.getState().setBookmark(A, 'story:a', { level: 'listen', sceneIndex: 2 });
    await useStoryStore.getState().hydrate(A);
    expect(useStoryStore.getState().getBookmark(A, 'story:a')?.sceneIndex).toBe(2);
  });
});

describe('story-store: profile removal', () => {
  it('a read still in flight when the profile is removed lands nowhere', async () => {
    mem.set(keyOf(A), saved({ 'story:a': { level: 'listen', sceneIndex: 3, updatedAt: T_OLD } }));
    const reading = useStoryStore.getState().hydrate(A);
    useStoryStore.getState().forgetProfile(A);
    await reading;
    expect(useStoryStore.getState().byProfile[A]).toBeUndefined();
    expect(useStoryStore.getState().hydratedFor.has(A)).toBe(false);
  });


  it('removing a profile drops its bookmarks from memory and storage, and leaves other profiles alone', async () => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: true });
    const input = { displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const };
    const a = useProfileStore.getState().createProfile(input);
    const b = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    await useStoryStore.getState().hydrate(a.id);
    await useStoryStore.getState().hydrate(b.id);
    useStoryStore.getState().setBookmark(a.id, 'story:a', { level: 'listen', sceneIndex: 2 });
    useStoryStore.getState().setBookmark(b.id, 'story:b', { level: 'listen', sceneIndex: 3 });
    await flush();

    useProfileStore.getState().remove(a.id);
    await flush();

    expect(useStoryStore.getState().byProfile[a.id]).toBeUndefined();
    expect(useStoryStore.getState().hydratedFor.has(a.id)).toBe(false);
    expect(mem.has(keyOf(a.id))).toBe(false);
    expect(useStoryStore.getState().getBookmark(b.id, 'story:b')?.sceneIndex).toBe(3);
    expect(mem.has(keyOf(b.id))).toBe(true);
  });
});
