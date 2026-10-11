import type { Quest } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import type { Bookmark } from '../bookmarks';
import { bookmarkClearedByResults, bookmarkResumedPayload, questStartStep, readerStart, sceneCountOf } from '../resume';
import { readyStory } from './story-fixture';

/** F-STORY-004 §3.8 (continue where you left off), PR 4.4b; F-STORY-002 §3.6 (the reader's bookmark seam). */

const mark = (sceneIndex: number, level: Bookmark['level'] = 'listen'): Bookmark => ({
  level,
  sceneIndex,
  updatedAt: '2026-10-11T09:00:00.000Z',
});

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
const LESSON: Quest = {
  id: 'quest:lesson',
  titleEn: 'Lesson',
  estimatedMinutes: 5,
  steps: [
    { id: 'l-intro', kind: 'intro', titleEn: 'Hi' },
    { id: 'l-game', kind: 'practice', titleEn: 'Tap', minigameKind: 'tap-match', minigameRef: 'minigame:tap-1' },
    { id: 'l-reward', kind: 'reward', titleEn: 'Yay' },
  ],
};

describe('questStartStep', () => {
  it('resume with a bookmark for the quest level starts on the story-read step, skipping the intro', () => {
    const bookmarkOf = vi.fn((storyId: string) => (storyId === 'story:sun-and-moon' ? mark(3) : undefined));
    expect(questStartStep(LISTEN_SUN, true, bookmarkOf)).toBe(1);
    expect(bookmarkOf).toHaveBeenCalledWith('story:sun-and-moon');
  });

  it('without resume the quest starts at step 0 and no bookmark is read', () => {
    const bookmarkOf = vi.fn(() => mark(3));
    expect(questStartStep(LISTEN_SUN, false, bookmarkOf)).toBe(0);
    expect(questStartStep(LISTEN_SUN, undefined, bookmarkOf)).toBe(0);
    expect(bookmarkOf).not.toHaveBeenCalled();
  });

  it('falls back to step 0 silently: no bookmark, another level, an unknown quest, a quest with no story', () => {
    expect(questStartStep(LISTEN_SUN, true, () => undefined)).toBe(0);
    expect(questStartStep(LISTEN_SUN, true, () => mark(3, 'read-along'))).toBe(0);
    expect(questStartStep(undefined, true, () => mark(3))).toBe(0);
    const bookmarkOf = vi.fn(() => mark(3));
    expect(questStartStep(LESSON, true, bookmarkOf)).toBe(0);
    expect(bookmarkOf).not.toHaveBeenCalled();
  });
});

describe('readerStart', () => {
  it('opens on the bookmarked scene of the same level, marked as resumed', () => {
    expect(readerStart(mark(2), 'listen', 5)).toEqual({ initialIndex: 2, resumed: true });
  });

  it('keeps the scene inside a story that got shorter', () => {
    expect(readerStart(mark(7), 'listen', 5)).toEqual({ initialIndex: 4, resumed: true });
  });

  it('ignores a bookmark for another level (scenario 3) and a missing one', () => {
    expect(readerStart(mark(3, 'read-along'), 'listen', 5)).toEqual({ initialIndex: 0, resumed: false });
    expect(readerStart(undefined, 'listen', 5)).toEqual({ initialIndex: 0, resumed: false });
  });

  it('a story with no scenes (the reader shows its fallback) opens on scene 0, not resumed', () => {
    expect(readerStart(mark(3), 'listen', 0)).toEqual({ initialIndex: 0, resumed: false });
  });

  it('a bookmark at scene 0 is not a resume', () => {
    expect(readerStart(mark(0), 'listen', 5)).toEqual({ initialIndex: 0, resumed: false });
  });
});

describe('bookmarkResumedPayload', () => {
  it('carries the story id and the restored scene index only (§3.11)', () => {
    expect(bookmarkResumedPayload('story:sun-and-moon', { initialIndex: 2, resumed: true })).toEqual({
      storyId: 'story:sun-and-moon',
      sceneIndex: 2,
    });
  });

  it('is null when the reader did not open on a restored scene or has no story', () => {
    expect(bookmarkResumedPayload('story:sun-and-moon', { initialIndex: 0, resumed: false })).toBeNull();
    expect(bookmarkResumedPayload('', { initialIndex: 2, resumed: true })).toBeNull();
  });
});

describe('bookmarkClearedByResults', () => {
  it('a story quest whose score was written clears its story bookmark', () => {
    expect(bookmarkClearedByResults(LISTEN_SUN, 3)).toBe('story:sun-and-moon');
  });

  it('nothing is cleared when every game was skipped (no score written, the story is not finished)', () => {
    expect(bookmarkClearedByResults(LISTEN_SUN, 0)).toBeNull();
  });

  it('nothing is cleared for a quest that is not a story quest', () => {
    expect(bookmarkClearedByResults(LESSON, 3)).toBeNull();
  });
});

describe('sceneCountOf', () => {
  const story = readyStory();
  const level = story.tiers[0]!.level;

  it('counts the scenes of the tier the reader plays', () => {
    expect(sceneCountOf(story, level)).toBe(story.tiers[0]!.scenes.length);
  });

  it('is 0 for an unknown story or a level the story lacks', () => {
    expect(sceneCountOf(undefined, 'listen')).toBe(0);
    const missing = (['listen', 'read-along', 'read'] as const).find((l) => !story.tiers.some((t) => t.level === l));
    if (missing) expect(sceneCountOf(story, missing)).toBe(0);
  });
});
