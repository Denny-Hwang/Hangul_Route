import { describe, expect, it } from 'vitest';
import { emptyBookmarks } from '../bookmarks';
import { storyStatus } from '../story-status';
import { bookmarks, questId, shelfIndex, snapshot, story } from './shelf-fixture';

const [entry] = shelfIndex([story('sun-and-moon')]);
if (!entry) throw new Error('fixture');
const QUEST = questId('sun-and-moon');

describe('storyStatus', () => {
  it('is new with no progress and no bookmark', () => {
    expect(storyStatus(entry, undefined, emptyBookmarks())).toEqual({ state: 'new', stars: 0 });
    expect(storyStatus(entry, snapshot([]), emptyBookmarks())).toEqual({ state: 'new', stars: 0 });
  });

  it('is in progress with a bookmark at the same level, and carries it', () => {
    const file = bookmarks({ 'story:sun-and-moon': { sceneIndex: 3 } });
    expect(storyStatus(entry, snapshot([]), file)).toEqual({
      state: 'in-progress',
      stars: 0,
      bookmark: file.byStory['story:sun-and-moon'],
    });
  });

  it('ignores a bookmark of another level (behaviour 3)', () => {
    const file = bookmarks({ 'story:sun-and-moon': { level: 'read-along' } });
    expect(storyStatus(entry, snapshot([]), file).state).toBe('new');
  });

  it('is finished when the quest has completedAt, with its stars', () => {
    const done = snapshot([{ questId: QUEST, completedAt: '2026-10-09T10:00:00.000Z', stars: 2 }]);
    expect(storyStatus(entry, done, emptyBookmarks())).toEqual({ state: 'finished', stars: 2 });
  });

  it('a finished story ignores its bookmark (finished on another device, behaviour 4)', () => {
    const done = snapshot([{ questId: QUEST, completedAt: '2026-10-09T10:00:00.000Z', stars: 0 }]);
    const file = bookmarks({ 'story:sun-and-moon': {} });
    expect(storyStatus(entry, done, file)).toEqual({ state: 'finished', stars: 0 });
  });

  it('a quest row without completedAt is not finished and shows no stars', () => {
    const started = snapshot([{ questId: QUEST, stars: 2 }]);
    expect(storyStatus(entry, started, emptyBookmarks())).toEqual({ state: 'new', stars: 0 });
  });
});
