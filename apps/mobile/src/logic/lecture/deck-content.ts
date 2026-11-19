import type { LectureBlock, UiLocale } from '@hangul-route/content-schema';

/**
 * The content one presenter deck reads ([FN] AMENDMENTS-FINISH-2026-11 row FN-4, finding F6). The presenter home lists
 * from the lesson and story manifests; a deck, once chosen (or opened from a link), loads only the lesson cells and
 * story bodies its own blocks hold, then expands (`deck-builder.ts` reads them synchronously). Pure over the lookups and
 * loaders it is given: `screens/presenter/use-deck-content.ts` binds the app's stores.
 *
 * What a block holds:
 * - `quest`: its quest; `word-review`: its quests; `episode`: its quests and, for a story episode, its stories;
 * - `story`: its story;
 * - every other kind (letters, revisit, vocabulary, cards, quiz, activity, class code): nothing that loads.
 * A quest's steps (in its cell) can name a story (a story read, its checks and order): those load once the cells are in.
 */

export interface DeckContentLookups {
  /** The lesson cell (episode id) that holds a quest; undefined for a quest that is not in a cell (Stage 1, a shelf quest). */
  cellOfQuest: (questId: string) => string | undefined;
  /** An episode's quests and stories from the manifest; undefined for an unknown episode. */
  episodeOf: (episodeId: string) => { questIds: readonly string[]; storyIds?: readonly string[] | undefined } | undefined;
  /** The stories a quest's steps play, read once its cell is in (none for a quest that plays no story). */
  storiesOfQuest: (questId: string) => readonly string[];
}

export interface DeckContentLoaders {
  ensureCells: (cellIds: readonly string[]) => Promise<void>;
  ensureStories: (storyIds: readonly string[]) => Promise<void>;
  /** The slide locale's lesson titles and display lines; never rejects (`LessonStore.ensureTitles`). */
  ensureTitles: (locale: UiLocale) => Promise<void>;
  /** The slide locale's UI text and content glosses; a failure keeps English. */
  ensureLocale: (locale: UiLocale) => Promise<void>;
  /** A later volume's cell (row CM-5B): a failure leaves its block out instead of failing the deck. */
  isLaterCell: (cellId: string) => boolean;
  /** A tale only a book 2 holds (row CM-5B): the same. */
  isLaterStory: (storyId: string) => boolean;
  /** A later chunk's failure that means a newer build on the host: the page reloads (as the grown-up roots did). */
  onLaterNewBuild: (error: unknown) => boolean;
}

export interface DeckContentIds {
  questIds: string[];
  cellIds: string[];
  storyIds: string[];
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/** The quests, cells and stories a deck's blocks hold before any cell is in (the stories inside quests come later). */
export function deckContentIds(blocks: readonly LectureBlock[], lookups: Pick<DeckContentLookups, 'cellOfQuest' | 'episodeOf'>): DeckContentIds {
  const questIds: string[] = [];
  const storyIds: string[] = [];
  const cellIds: string[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case 'quest':
        questIds.push(block.id);
        break;
      case 'word-review':
        questIds.push(...block.questIds);
        break;
      case 'episode': {
        const episode = lookups.episodeOf(block.id);
        if (episode === undefined) break;
        questIds.push(...episode.questIds);
        storyIds.push(...(episode.storyIds ?? []));
        break;
      }
      case 'story':
        storyIds.push(block.storyId);
        break;
      default:
        break;
    }
  }
  for (const id of questIds) {
    const cell = lookups.cellOfQuest(id);
    if (cell !== undefined) cellIds.push(cell);
  }
  return { questIds: unique(questIds), cellIds: unique(cellIds), storyIds: unique(storyIds) };
}

/**
 * Loads what a deck reads: its cells, the slide locale's titles and text, then its stories (those of its blocks and
 * those its quests play). Rejects when a core cell or story fails (the presenter shows the crash screen with Try
 * again); a later volume that fails is left out, and its block is skipped as the deck builder skips any unknown id.
 */
export async function loadDeckContent(blocks: readonly LectureBlock[], locale: UiLocale, lookups: DeckContentLookups, loaders: DeckContentLoaders): Promise<void> {
  const ids = deckContentIds(blocks, lookups);
  const split = (values: readonly string[], later: (id: string) => boolean): { core: string[]; later: string[] } => ({
    core: values.filter((id) => !later(id)),
    later: values.filter(later),
  });
  const quietLater = (load: Promise<void>): Promise<void> =>
    load.catch((error: unknown) => {
      loaders.onLaterNewBuild(error);
    });
  const cells = split(ids.cellIds, loaders.isLaterCell);
  await Promise.all([
    loaders.ensureCells(cells.core),
    cells.later.length === 0 ? Promise.resolve() : quietLater(loaders.ensureCells(cells.later)),
    loaders.ensureTitles(locale),
    loaders.ensureLocale(locale).catch(() => undefined),
  ]);
  const stories = split(unique([...ids.storyIds, ...ids.questIds.flatMap(lookups.storiesOfQuest)]), loaders.isLaterStory);
  await Promise.all([
    stories.core.length === 0 ? Promise.resolve() : loaders.ensureStories(stories.core),
    stories.later.length === 0 ? Promise.resolve() : quietLater(loaders.ensureStories(stories.later)),
  ]);
}
