import type { Episode, Quest, QuestProgress, StageKey, ThemeDef, ThemeKey } from '@hangul-route/content-schema';
import type { IconName } from '@hangul-route/design-system';
import type { Messages } from '@hangul-route/i18n';
import { cellKey, gridEpisodes } from '../content/episodes';

/**
 * Journey grid rules (wireframe journey/grid):
 *  - a stage row is 'open' when every cell has a shipped episode, 'taste'
 *    when only some cells are shipped, 'soon' when none is;
 *  - an episode cell is complete only when *all* of its quests are done.
 */
export type StageAvailability = 'open' | 'taste' | 'soon';

/**
 * Counts cells, not episodes (F-STORY-005 §3.5): a cell is shipped when any of
 * its episodes is shipped. Callers pass grid episodes (`gridEpisodes`).
 */
export function stageAvailability(stage: StageKey, episodes: readonly Episode[]): StageAvailability {
  const inStage = episodes.filter((e) => e.stage === stage);
  const cells = new Set(inStage.map(cellKey));
  const shipped = new Set(inStage.filter((e) => e.status === 'shipped').map(cellKey));
  if (shipped.size === 0) return 'soon';
  return shipped.size === cells.size ? 'open' : 'taste';
}

/**
 * What a stage header pill says: its availability word, or "Complete" once the stage is complete
 * (F-QUEST-002 §3.8; `completeStages` in `logic/my-route/latch.ts` decides which stages are).
 */
export type StagePillState = StageAvailability | 'complete';

/** `complete` wins over the availability word; otherwise the pill keeps it. */
export function stagePillState(availability: StageAvailability, complete: boolean): StagePillState {
  return complete ? 'complete' : availability;
}

/** The pill words come from the dictionary (`learner.journey.availability`), passed in as a message subtree. */
export function stagePillLabel(
  state: StagePillState,
  m: Messages['learner']['journey']['availability'],
): string {
  return m[state].pill;
}

export function isEpisodeComplete(
  episode: Pick<Episode, 'id' | 'questIds'>,
  quests: readonly Pick<QuestProgress, 'questId' | 'episodeId' | 'completedAt'>[],
): boolean {
  if (episode.questIds.length === 0) return false;
  const done = new Set(
    quests.filter((q) => q.episodeId === episode.id && q.completedAt).map((q) => q.questId),
  );
  return episode.questIds.every((id) => done.has(id));
}

/**
 * A cell is complete when every one of its episodes is (F-STORY-005 §3.5);
 * with one episode per cell this equals `isEpisodeComplete`. An empty cell is
 * never complete.
 */
export function isCellComplete(
  episodes: readonly Pick<Episode, 'id' | 'questIds'>[],
  quests: readonly Pick<QuestProgress, 'questId' | 'episodeId' | 'completedAt'>[],
): boolean {
  return episodes.length > 0 && episodes.every((e) => isEpisodeComplete(e, quests));
}

/**
 * The Home progress line, "completed of total" (F-STORY-004 §3.10 and behaviour #9): both sides
 * count the quests of grid episodes only, so a finished shelf story never pushes the count past
 * the total. A quest id that no grid episode lists (a shelf quest, retired content), or that a
 * grid episode lists but the bundle does not ship, is left out of both sides.
 */
export function gridQuestProgress(
  episodes: readonly Pick<Episode, 'placement' | 'questIds'>[],
  quests: readonly Pick<Quest, 'id'>[],
  progress: readonly Pick<QuestProgress, 'questId' | 'completedAt'>[],
): { completed: number; total: number } {
  const gridIds = new Set(gridEpisodes(episodes).flatMap((e) => e.questIds));
  // One set feeds both sides: a grid id with no bundled quest counts on neither.
  const countable = new Set(quests.filter((q) => gridIds.has(q.id)).map((q) => q.id));
  const done = new Set(progress.filter((q) => q.completedAt && countable.has(q.questId)).map((q) => q.questId));
  return { completed: done.size, total: countable.size };
}

/**
 * Journey column header: the theme title's first word ("Food & Daily Life"
 * → "Food"), shown under the column's theme glyph.
 */
export function themeColumnLabel(theme: Pick<ThemeDef, 'titleEn'>): string {
  const title = theme.titleEn.trim();
  const gap = title.search(/\s/);
  return gap === -1 ? title : title.slice(0, gap);
}

/**
 * The glyph a Journey cell draws and its column header shows (design/components/Icon/theme-glyphs.md).
 * Owner decision 2026-10-14: the single letters L / F / H / N / P could not be decoded, so every
 * theme has a picture instead. Decorative: the cell label and the column word name the theme.
 */
const THEME_GLYPHS: Record<ThemeKey, IconName> = {
  letters: 'hangul-tile',
  life: 'rice-bowl',
  rites: 'lantern',
  nature: 'leaf',
  crafts: 'spinning-top',
};

export function themeGlyph(theme: ThemeKey): IconName {
  return THEME_GLYPHS[theme];
}
