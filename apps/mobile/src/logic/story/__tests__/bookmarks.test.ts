import type { ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  BOOKMARK_LIMIT,
  BookmarkFileSchema,
  BookmarkSchema,
  bookmarksKey,
  clampScene,
  clearBookmark,
  emptyBookmarks,
  finishedStoryLevels,
  unfinishedBookmark,
  mergeBookmarks,
  parseBookmarkFile,
  pruneBookmarks,
  resumeStepIndex,
  setBookmark,
  type Bookmark,
  type BookmarkFile,
} from '../bookmarks';

/** F-STORY-004 §3.1 (Bookmark) and §3.8 (continue where you left off). */

const T0 = '2026-10-11T09:00:00.000Z';
const at = (minute: number): string => new Date(Date.parse(T0) + minute * 60_000).toISOString();
const mark = (sceneIndex: number, minute = 0, level: Bookmark['level'] = 'listen'): Bookmark => ({ level, sceneIndex, updatedAt: at(minute) });
const file = (byStory: Record<string, Bookmark>): BookmarkFile => ({ v: 1, byStory });

const storyQuest = (id: string, ref: string): Quest => ({
  id,
  titleEn: id,
  estimatedMinutes: 5,
  steps: [
    { id: `${id}-intro`, kind: 'intro', titleEn: 'Hi' },
    { id: `${id}-read`, kind: 'practice', titleEn: 'Read', minigameKind: 'story-read', minigameRef: ref },
    { id: `${id}-check`, kind: 'check', titleEn: 'Check', minigameKind: 'story-check', minigameRef: ref.replace('story-read', 'story-check') },
    { id: `${id}-reward`, kind: 'reward', titleEn: 'Yay' },
  ],
});
const LISTEN_SUN = storyQuest('quest:story-sun-and-moon-listen', 'minigame:story-read-listen-sun-and-moon');
const READ_SUN = storyQuest('quest:story-sun-and-moon-read', 'minigame:story-read-read-sun-and-moon');
const LESSON: Quest = {
  id: 'quest:lesson',
  titleEn: 'Lesson',
  estimatedMinutes: 5,
  steps: [
    { id: 'l1', kind: 'intro', titleEn: 'Hi' },
    { id: 'l2', kind: 'practice', titleEn: 'Go', minigameKind: 'match-sound', minigameRef: 'minigame:match-sound-1' },
  ],
};

describe('schemas', () => {
  it('accept a well-formed file and reject a scene index outside 0..40 or an unknown level', () => {
    expect(BookmarkFileSchema.safeParse(file({ 'story:a': mark(3) })).success).toBe(true);
    expect(BookmarkSchema.safeParse(mark(41)).success).toBe(false);
    expect(BookmarkSchema.safeParse(mark(-1)).success).toBe(false);
    expect(BookmarkSchema.safeParse({ ...mark(1), level: 'speak' }).success).toBe(false);
    expect(BookmarkFileSchema.safeParse({ v: 2, byStory: {} }).success).toBe(false);
  });

  it('use one storage key per profile', () => {
    expect(bookmarksKey('profile:a')).toBe('story:bookmarks:profile:a');
  });
});

describe('parseBookmarkFile', () => {
  it('returns an empty file for nothing saved, garbage, another version or a broken shape, never throwing', () => {
    for (const raw of [null, undefined, 'x', 42, [], {}, { v: 2, byStory: {} }, { v: 1 }, { v: 1, byStory: [] }, { v: 1, byStory: null }]) {
      expect(parseBookmarkFile(raw)).toEqual(emptyBookmarks());
    }
  });

  it('keeps the valid entries of a v1 file and drops only the broken ones', () => {
    const raw = { v: 1, byStory: { 'story:a': mark(2), 'story:b': { level: 'listen', sceneIndex: 'three' }, 'story:c': mark(99) } };
    expect(parseBookmarkFile(raw)).toEqual(file({ 'story:a': mark(2) }));
  });

  it('applies the 20-bookmark cap to a saved file that holds more', () => {
    const byStory: Record<string, Bookmark> = {};
    for (let i = 0; i < 25; i += 1) byStory[`story:s${i}`] = mark(1, i);
    expect(Object.keys(parseBookmarkFile({ v: 1, byStory }).byStory)).toHaveLength(BOOKMARK_LIMIT);
  });
});

describe('emptyBookmarks', () => {
  it('is a fresh v1 file each call', () => {
    const a = emptyBookmarks();
    a.byStory['story:x'] = mark(1);
    expect(emptyBookmarks()).toEqual({ v: 1, byStory: {} });
  });
});

describe('setBookmark', () => {
  it('writes a bookmark from scene 1 on, stamped with the time given', () => {
    const next = setBookmark(emptyBookmarks(), 'story:a', { level: 'read-along', sceneIndex: 3 }, at(5));
    expect(next).toEqual(file({ 'story:a': { level: 'read-along', sceneIndex: 3, updatedAt: at(5) } }));
  });

  it('replaces the story\'s earlier bookmark (one bookmark per story)', () => {
    const next = setBookmark(file({ 'story:a': mark(2, 0) }), 'story:a', { level: 'listen', sceneIndex: 4 }, at(9));
    expect(next.byStory['story:a']).toEqual(mark(4, 9));
  });

  it('writes nothing for scene 0, a negative, a fractional or an out-of-range scene index', () => {
    const start = file({ 'story:a': mark(2) });
    for (const sceneIndex of [0, -1, 1.5, 41, Number.NaN]) {
      expect(setBookmark(start, 'story:a', { level: 'listen', sceneIndex }, at(1))).toBe(start);
    }
  });

  it('does not change the file it is given', () => {
    const start = emptyBookmarks();
    setBookmark(start, 'story:a', { level: 'listen', sceneIndex: 1 }, at(1));
    expect(start).toEqual(emptyBookmarks());
  });

  it('keeps at most 20, dropping the oldest', () => {
    let f = emptyBookmarks();
    for (let i = 0; i < BOOKMARK_LIMIT; i += 1) f = setBookmark(f, `story:s${i}`, { level: 'listen', sceneIndex: 1 }, at(i));
    f = setBookmark(f, 'story:new', { level: 'listen', sceneIndex: 2 }, at(100));
    expect(Object.keys(f.byStory)).toHaveLength(BOOKMARK_LIMIT);
    expect(f.byStory['story:s0']).toBeUndefined();
    expect(f.byStory['story:new']).toEqual(mark(2, 100));
  });
});

describe('clearBookmark', () => {
  it('removes the story\'s bookmark and leaves the rest', () => {
    expect(clearBookmark(file({ 'story:a': mark(2), 'story:b': mark(3) }), 'story:a')).toEqual(file({ 'story:b': mark(3) }));
  });

  it('returns the same file when there is nothing to clear', () => {
    const start = file({ 'story:b': mark(3) });
    expect(clearBookmark(start, 'story:a')).toBe(start);
  });
});

describe('pruneBookmarks', () => {
  it('keeps the newest 20 by updatedAt, ties broken by story id', () => {
    const byStory: Record<string, Bookmark> = {};
    for (let i = 0; i < 22; i += 1) byStory[`story:s${String(i).padStart(2, '0')}`] = mark(1, i);
    byStory['story:tie-b'] = mark(1, 21);
    byStory['story:tie-a'] = mark(1, 21);
    const kept = Object.keys(pruneBookmarks(file(byStory)).byStory);
    expect(kept).toHaveLength(BOOKMARK_LIMIT);
    expect(kept).toContain('story:tie-a');
    expect(kept).toContain('story:tie-b');
    expect(kept).not.toContain('story:s03');
    expect(kept).toContain('story:s04');
  });

  it('drops the bookmarks of stories finished at that level (for example on another device)', () => {
    const f = file({ 'story:a': mark(2, 0, 'listen'), 'story:b': mark(3, 0, 'read') });
    const finished = (storyId: string, level: Bookmark['level']): boolean => storyId === 'story:a' && level === 'listen';
    expect(pruneBookmarks(f, { isFinished: finished })).toEqual(file({ 'story:b': mark(3, 0, 'read') }));
  });

  it('honours a custom limit and returns the same file when nothing is dropped', () => {
    const f = file({ 'story:a': mark(1, 0), 'story:b': mark(1, 1) });
    expect(Object.keys(pruneBookmarks(f, { limit: 1 }).byStory)).toEqual(['story:b']);
    expect(pruneBookmarks(f)).toBe(f);
  });
});

describe('finishedStoryLevels', () => {
  const snap = (quests: Array<{ questId: string; completedAt?: string }>): Pick<ProgressSnapshot, 'quests'> => ({
    quests: quests.map((q) => ({ questId: q.questId, episodeId: 'episode:e', startedAt: T0, stars: 2, attempts: 1, accuracy: 0.8, ...(q.completedAt ? { completedAt: q.completedAt } : {}) })),
  });

  it('is true for a story and level whose quest has a completedAt', () => {
    const finished = finishedStoryLevels([LISTEN_SUN, READ_SUN, LESSON], snap([{ questId: LISTEN_SUN.id, completedAt: at(1) }, { questId: READ_SUN.id }]));
    expect(finished('story:sun-and-moon', 'listen')).toBe(true);
    expect(finished('story:sun-and-moon', 'read')).toBe(false);
    expect(finished('story:other', 'listen')).toBe(false);
  });

  it('is false for everything without a snapshot or with a lesson quest done', () => {
    expect(finishedStoryLevels([LISTEN_SUN], undefined)('story:sun-and-moon', 'listen')).toBe(false);
    expect(finishedStoryLevels([LESSON], snap([{ questId: LESSON.id, completedAt: at(1) }]))('story:sun-and-moon', 'listen')).toBe(false);
  });
});

describe('unfinishedBookmark', () => {
  const finishedListen = (storyId: string, level: Bookmark['level']): boolean => storyId === 'story:sun-and-moon' && level === 'listen';

  it('drops a bookmark of a (story, level) already finished, for example on another device (§3.8)', () => {
    expect(unfinishedBookmark('story:sun-and-moon', mark(3), finishedListen)).toBeUndefined();
  });

  it('keeps a bookmark of another level or another story, and passes a missing one through', () => {
    expect(unfinishedBookmark('story:sun-and-moon', mark(3, 0, 'read'), finishedListen)).toEqual(mark(3, 0, 'read'));
    expect(unfinishedBookmark('story:other', mark(2), finishedListen)).toEqual(mark(2));
    expect(unfinishedBookmark('story:sun-and-moon', undefined, finishedListen)).toBeUndefined();
  });
});

describe('mergeBookmarks', () => {
  it('keeps the newer bookmark of each story and every story from both files', () => {
    const saved = file({ 'story:a': mark(2, 0), 'story:b': mark(3, 5) });
    const unsaved = file({ 'story:a': mark(4, 9), 'story:b': mark(1, 1), 'story:c': mark(1, 2) });
    expect(mergeBookmarks(unsaved, saved)).toEqual(file({ 'story:a': mark(4, 9), 'story:b': mark(3, 5), 'story:c': mark(1, 2) }));
  });

  it('leaves out stories cleared before the saved file loaded', () => {
    const saved = file({ 'story:a': mark(2, 0), 'story:b': mark(3, 5) });
    expect(mergeBookmarks(emptyBookmarks(), saved, new Set(['story:a']))).toEqual(file({ 'story:b': mark(3, 5) }));
  });
});

describe('resumeStepIndex', () => {
  it('is the index of the quest\'s story-read step when the bookmark matches its level', () => {
    expect(resumeStepIndex(LISTEN_SUN, mark(3, 0, 'listen'))).toBe(1);
  });

  it('is 0 without a bookmark, with another level, or for a quest with no story-read step', () => {
    expect(resumeStepIndex(LISTEN_SUN, undefined)).toBe(0);
    expect(resumeStepIndex(LISTEN_SUN, mark(3, 0, 'read-along'))).toBe(0);
    expect(resumeStepIndex(LESSON, mark(3, 0, 'listen'))).toBe(0);
  });

  it('is 0 when the story-read step has a malformed ref', () => {
    const broken = storyQuest('quest:broken', 'minigame:not-a-story');
    expect(resumeStepIndex(broken, mark(3, 0, 'listen'))).toBe(0);
  });
});

describe('clampScene', () => {
  it('is the bookmark scene while the story still has it', () => {
    expect(clampScene(mark(3), 6)).toBe(3);
  });

  it('is the last scene when the story got shorter', () => {
    expect(clampScene(mark(7), 5)).toBe(4);
  });

  it('is 0 without a bookmark or without scenes', () => {
    expect(clampScene(undefined, 6)).toBe(0);
    expect(clampScene(mark(3), 0)).toBe(0);
  });
});
