import type { Episode, ProgressSnapshot, Quest, Story, StoryLevel, StoryShelf } from '@hangul-route/content-schema';
import { emptyBookmarks, type Bookmark, type BookmarkFile } from '../bookmarks';
import { storyMinigameRef } from '../story-ref';
import { buildStoryIndex, type StoryIndexEntry } from '../story-index';
import { readyStory } from './story-fixture';

/**
 * Small builders for the story-shelf tests (F-STORY-004 PR 4.3b): stories from
 * the schema-valid fixture, story quests with one `story-read` step, and shelf
 * or book episodes that follow the §3.1 conventions.
 */

type StoryPatch = Partial<Omit<Story, 'shelf'>> & { shelf?: Partial<StoryShelf> | null };

export function story(slug: string, patch: StoryPatch = {}): Story {
  const base = readyStory();
  const { shelf, ...rest } = patch;
  const merged: Story = { ...base, ...rest, id: `story:${slug}` };
  if (shelf === null) delete merged.shelf;
  else merged.shelf = { ...(base.shelf as StoryShelf), ...shelf };
  return merged;
}

export function unreviewed(s: Story, which: 'language' | 'culture' | 'both' = 'both'): Story {
  return {
    ...s,
    review: {
      ...s.review,
      language: which === 'culture' ? s.review.language : 'draft',
      culture: which === 'language' ? s.review.culture : 'draft',
    },
  };
}

const LEVEL_CODE: Record<StoryLevel, string> = { listen: 'listen', 'read-along': 'along', read: 'read' };

export function questId(slug: string, level: StoryLevel = 'listen'): string {
  return `quest:story-${slug}-${LEVEL_CODE[level]}`;
}

export function storyQuest(slug: string, level: StoryLevel = 'listen'): Pick<Quest, 'id' | 'steps'> {
  const id = `story:${slug}`;
  return {
    id: questId(slug, level),
    steps: [
      { id: 'intro', kind: 'discover', titleEn: 'Meet the story' },
      { id: 'read', kind: 'practice', titleEn: 'Read', minigameKind: 'story-read', minigameRef: storyMinigameRef('read', level, id) },
      { id: 'check', kind: 'check', titleEn: 'Check', minigameKind: 'story-check', minigameRef: storyMinigameRef('check', level, id) },
    ],
  };
}

export function shelfEpisode(s: Story, patch: Partial<Episode> = {}): Episode {
  const slug = s.id.replace(/^story:/, '');
  return {
    id: `episode:shelf-${slug}`,
    stage: 'stage1',
    theme: s.theme,
    order: 100 + (s.shelf?.order ?? 0),
    titleEn: s.title.en,
    hoyaIntroEn: 'Hoya has a story.',
    questIds: [questId(slug)],
    rewardCardIds: [],
    estimatedMinutes: 5,
    status: 'shipped',
    format: 'story',
    placement: 'shelf',
    ...patch,
  };
}

export function bookEpisode(id: string, questIds: string[], patch: Partial<Episode> = {}): Episode {
  return {
    id,
    stage: 'stage5',
    theme: 'letters',
    order: 1,
    titleEn: 'Stories of Letters',
    hoyaIntroEn: 'A book of stories.',
    questIds,
    rewardCardIds: [],
    estimatedMinutes: 15,
    status: 'shipped',
    format: 'story',
    ...patch,
  };
}

/** A shelf world: every story gets its shelf episode and listen quest. */
export function shelfIndex(stories: Story[], extra: { episodes?: Episode[]; quests?: Pick<Quest, 'id' | 'steps'>[] } = {}): StoryIndexEntry[] {
  return buildStoryIndex({
    stories,
    episodes: [...stories.filter((s) => s.shelf).map((s) => shelfEpisode(s)), ...(extra.episodes ?? [])],
    quests: [...stories.map((s) => storyQuest(s.id.replace(/^story:/, ''))), ...(extra.quests ?? [])],
    showUnreviewed: false,
  });
}

export function snapshot(done: Array<{ questId: string; completedAt?: string; stars?: 0 | 1 | 2 | 3 }>): Pick<ProgressSnapshot, 'quests'> {
  return {
    quests: done.map((d) => ({
      questId: d.questId,
      completedAt: d.completedAt,
      stars: d.stars ?? 3,
    })) as ProgressSnapshot['quests'],
  };
}

export function bookmarks(entries: Record<string, Partial<Bookmark>>): BookmarkFile {
  const file = emptyBookmarks();
  for (const [storyId, b] of Object.entries(entries)) {
    file.byStory[storyId] = { level: 'listen', sceneIndex: 3, updatedAt: '2026-10-10T10:00:00.000Z', ...b };
  }
  return file;
}
