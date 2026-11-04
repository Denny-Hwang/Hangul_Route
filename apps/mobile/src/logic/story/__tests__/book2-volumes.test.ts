import { describe, expect, it } from 'vitest';
import { episodesAll, episodesWithVolumes } from '../../../content/episodes';
import { emptyBookmarks } from '../bookmarks';
import { defaultStoryIndex } from '../story-index';
import { nextStoryAfter, storyLockFor } from '../story-pick';

// The Play book 2 (F-CURR-002 row CM-46) on the Volume 2 path: Results walks it to Next story while `volumes` is on
// (the screens read the index through `useStoryIndex`), and nothing of it is offered while the flag is off.
const HAHOE = 'quest:story-hahoe-mask-dance-read';
const HANJI = 'quest:story-hanji-korean-paper-read';

describe('the Play book 2 in the story index', () => {
  it('is in the index with the later volumes only', () => {
    const on = defaultStoryIndex({ volumes: true }).map((e) => e.questId);
    const off = defaultStoryIndex().map((e) => e.questId);
    expect(on).toEqual(expect.arrayContaining([HAHOE, HANJI]));
    expect(off).not.toContain(HAHOE);
    expect(off).not.toContain(HANJI);
  });

  it('offers the next tale of the book after the Hahoe masks while volumes is on', () => {
    const next = nextStoryAfter(HAHOE, {
      entries: defaultStoryIndex({ volumes: true }),
      snapshot: {
        quests: [{ episodeId: 'episode:stage5-crafts-v2', questId: HAHOE, startedAt: '2026-11-04T09:50:00.000Z', stars: 3, attempts: 1, accuracy: 1, completedAt: '2026-11-04T10:00:00.000Z' }],
      },
      bookmarks: emptyBookmarks(),
      isLocked: storyLockFor({ tier: 'premium', gatingEnabled: false, episodes: episodesWithVolumes }),
    });
    expect(next?.questId).toBe(HANJI);
  });

  it('offers nothing from the book with volumes off', () => {
    const next = nextStoryAfter(HAHOE, {
      entries: defaultStoryIndex(),
      snapshot: undefined,
      bookmarks: emptyBookmarks(),
      isLocked: storyLockFor({ tier: 'free', gatingEnabled: false, episodes: episodesAll }),
    });
    expect(next).toBeNull();
  });
});
