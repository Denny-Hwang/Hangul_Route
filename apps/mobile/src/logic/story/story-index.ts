import type { Episode, Quest, StageKey, Story, StoryLevel, ThemeKey } from '@hangul-route/content-schema';
import { flags } from '../../config/flags';
import { episodesAll } from '../../content/episodes';
import { questsAll } from '../../content/quests';
import { storiesAll } from '../../content/stories';
import { homeCellOf } from './home-cell';
import { storyReadStep } from './story-ref';

/**
 * The story index (F-STORY-004 §3.1): one entry per playable *story quest*, so
 * the shelf, Home, the episode page and Culture notes all read the same list.
 * A story can have several entries (its Listen shelf quest and a Read quest in
 * a Stage 5 book, F-STORY-005). Pure; `defaultStoryIndex` builds it once from
 * the bundle.
 */

export type ShelfCategory = 'story-time' | 'culture';

/** Defined here and nowhere else: F-STORY-005 and F-STORY-006 read it. */
export interface StoryIndexEntry {
  storyId: string;
  story: Story;
  questId: string;
  episodeId: string;
  /** From the quest's `story-read` ref. */
  level: StoryLevel;
  placement: 'shelf' | 'grid';
  /** The episode's stage: a book (grid) entry sits in a stage that callers must check entitlement for. */
  stage: StageKey;
  /** Shelf only; null for a book (grid) entry. */
  category: ShelfCategory | null;
  /** `shelf.order` for a shelf entry, the episode order for a grid entry. */
  order: number;
  minutes: number;
  theme: ThemeKey;
}

export interface BuildStoryIndexInput {
  stories: readonly Story[];
  episodes: readonly Episode[];
  quests: readonly Pick<Quest, 'id' | 'steps'>[];
  /** Flag `showUnreviewedStories` (dev and design-preview builds only). */
  showUnreviewed: boolean;
}

/**
 * D14: only `ready`, language- and culture-reviewed stories reach a production
 * shelf (the bundle can carry drafts when built with `--include-drafts`).
 */
function isProductionReady(story: Story): boolean {
  return (
    story.state === 'ready' &&
    story.review.language === 'native-reviewed' &&
    story.review.culture === 'culture-reviewed'
  );
}

/**
 * Entries in episode order, then quest order inside each episode. Skipped:
 * quests of `draft` / `preview` episodes, quests that are missing or are not
 * story quests, stories that are not bundled or lack the quest's level, shelf
 * quests of a story with no `shelf` block (no Library section could show them,
 * so Home must not offer them either), and (unless `showUnreviewed`) draft or
 * unreviewed stories.
 */
export function buildStoryIndex(input: BuildStoryIndexInput): StoryIndexEntry[] {
  const storyById = new Map(input.stories.map((s) => [s.id, s]));
  const questById = new Map(input.quests.map((q) => [q.id, q]));
  const entries: StoryIndexEntry[] = [];
  for (const episode of input.episodes) {
    if (episode.status === 'draft' || episode.status === 'preview') continue;
    const placement = episode.placement === 'shelf' ? 'shelf' : 'grid';
    for (const questId of episode.questIds) {
      const quest = questById.get(questId);
      const read = quest ? storyReadStep(quest) : null;
      const story = read ? storyById.get(read.ref.storyId) : undefined;
      if (!read || !story) continue;
      if (!story.tiers.some((t) => t.level === read.ref.level)) continue;
      if (!input.showUnreviewed && !isProductionReady(story)) continue;
      const shelf = placement === 'shelf' ? story.shelf : undefined;
      if (placement === 'shelf' && !shelf) continue;
      entries.push({
        storyId: story.id,
        story,
        questId,
        episodeId: episode.id,
        level: read.ref.level,
        placement,
        stage: episode.stage,
        category: shelf?.category ?? null,
        order: shelf?.order ?? episode.order,
        minutes: shelf?.minutes ?? story.minutes,
        theme: story.theme,
      });
    }
  }
  return entries;
}

const CATEGORY_RANK: Record<ShelfCategory, number> = { 'story-time': 0, culture: 1 };

function rank(entry: Pick<StoryIndexEntry, 'placement' | 'category'>): number {
  if (entry.placement === 'grid' || entry.category === null) return 2;
  return CATEGORY_RANK[entry.category];
}

/**
 * The one order every list walks ("next story", Culture notes): shelf before
 * grid, Story Time before Culture, then `order`. `Array.prototype.sort` is
 * stable, so equal entries keep index order (episode, then quest order).
 */
export function compareShelfOrder(
  a: Pick<StoryIndexEntry, 'placement' | 'category' | 'order'>,
  b: Pick<StoryIndexEntry, 'placement' | 'category' | 'order'>,
): number {
  return rank(a) - rank(b) || a.order - b.order;
}

/** The shelf entries of one Library category, in `shelf.order`; never re-sorted by progress. */
export function shelfEntries(index: readonly StoryIndexEntry[], category: ShelfCategory): StoryIndexEntry[] {
  return index.filter((e) => e.placement === 'shelf' && e.category === category).sort(compareShelfOrder);
}

export function entryForQuest(index: readonly StoryIndexEntry[], questId: string): StoryIndexEntry | undefined {
  return index.find((e) => e.questId === questId);
}

/** The story's shelf entry when it has one (the shelf shows that one), else its first entry. */
export function entryForStory(index: readonly StoryIndexEntry[], storyId: string): StoryIndexEntry | undefined {
  const ofStory = index.filter((e) => e.storyId === storyId);
  return ofStory.find((e) => e.placement === 'shelf') ?? ofStory[0];
}

/**
 * The shelf entries whose home cell (F-STORY-005 §3.2) is this grid cell, in
 * shelf order. A book (grid) entry is the cell's own episode, not a story that
 * calls the cell home, so it is left out. The review gate is the index's own.
 */
export function entriesForCell(index: readonly StoryIndexEntry[], stage: StageKey, theme: ThemeKey): StoryIndexEntry[] {
  return index
    .filter((e) => {
      if (e.placement !== 'shelf') return false;
      const home = homeCellOf(e.story);
      return home.stage === stage && home.theme === theme;
    })
    .sort(compareShelfOrder);
}

let cached: readonly StoryIndexEntry[] | undefined;

/** The bundle's index, built on first use and memoised for the life of the app. */
export function defaultStoryIndex(): readonly StoryIndexEntry[] {
  cached ??= buildStoryIndex({
    stories: storiesAll,
    episodes: episodesAll,
    quests: questsAll,
    showUnreviewed: flags.showUnreviewedStories,
  });
  return cached;
}
