import type { Episode, Quest, QuestProgress, StageKey, ThemeDef } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { gridEpisodes } from '../content/episodes';

/**
 * Journey grid rules (wireframe journey/grid):
 *  - a stage row is 'open' when every cell has a shipped episode, 'taste'
 *    when only some cells are shipped, 'soon' when none is;
 *  - an episode cell is complete only when *all* of its quests are done.
 */
export type StageAvailability = 'open' | 'taste' | 'soon';

export function stageAvailability(stage: StageKey, episodes: readonly Episode[]): StageAvailability {
  const cells = episodes.filter((e) => e.stage === stage);
  const shipped = cells.filter((e) => e.status === 'shipped').length;
  if (cells.length === 0 || shipped === 0) return 'soon';
  return shipped === cells.length ? 'open' : 'taste';
}

/** The pill words come from the dictionary (`learner.journey.availability`), passed in as a message subtree. */
export function stagePillLabel(
  availability: StageAvailability,
  m: Messages['learner']['journey']['availability'],
): string {
  return m[availability].pill;
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
 * → "Food"). Cells use its initial so every column reads like its header —
 * keyed initials gave two "L" columns (letters, life; audit UX-11).
 */
export function themeColumnLabel(theme: Pick<ThemeDef, 'titleEn'>): string {
  const title = theme.titleEn.trim();
  const gap = title.search(/\s/);
  return gap === -1 ? title : title.slice(0, gap);
}

export function themeCellInitial(theme: Pick<ThemeDef, 'titleEn'>): string {
  return themeColumnLabel(theme).charAt(0).toUpperCase();
}
