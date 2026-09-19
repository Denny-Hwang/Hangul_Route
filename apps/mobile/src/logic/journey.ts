import type { Episode, QuestProgress, StageKey } from '@hangul-route/content-schema';

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

export function stagePillLabel(availability: StageAvailability): string {
  switch (availability) {
    case 'open':
      return 'Open';
    case 'taste':
      return 'Taste';
    default:
      return 'Soon';
  }
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
