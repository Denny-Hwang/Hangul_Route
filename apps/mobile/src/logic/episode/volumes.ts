import type { Episode } from '@hangul-route/content-schema';
import { episodesFor, episodesWithVolumes, shownVolumeOf, withVolumes } from '../../content/episodes';
import { isPlayable } from '../journey-cells';

/**
 * A cell's volumes on its page (F-CURR-002 §5.1 and row CM-40, F-STORY-005 PR 5.8). Pure over the episode list
 * (`episodesWithVolumes` by default), so the rules are tested with a fixture Volume 2.
 */

/**
 * The episode a cell's page shows for the asked id: that episode, except a later volume while `volumes` is off, which
 * shows its cell's first volume instead (an older link or back stack), so no Volume 2 entry point shows while it is off.
 * A book 2 tale's shelf episode counts as a later volume (`shownVolumeOf`, F-CURR-002 row CM-46).
 */
export function volumePageEpisode(asked: Episode | undefined, volumesOn: boolean, list: readonly Episode[] = episodesWithVolumes): Episode | undefined {
  if (asked === undefined || volumesOn || shownVolumeOf(asked) === 1) return asked;
  return episodesFor(asked.stage, asked.theme, withVolumes(false, list))[0] ?? asked;
}

/** The cell's playable volumes, in order, for "Vol 1" and "Vol 2": the first volume alone while `volumes` is off. */
export function cellVolumes(episode: Pick<Episode, 'stage' | 'theme'>, volumesOn: boolean, list: readonly Episode[] = episodesWithVolumes): Episode[] {
  return episodesFor(episode.stage, episode.theme, withVolumes(volumesOn, list)).filter(isPlayable);
}

/**
 * Whether the quest player is asked to play a later volume (row CM-41 S2): the quest belongs to a volume 2 or later, or
 * is opened under one. While `volumes` is off such a quest does not start (an older Play again, an assignment or a deck
 * link): the player shows the episode page instead, which `volumePageEpisode` turns into the cell's first volume.
 */
export function isLaterVolumeQuest(questId: string, episodeId: string, list: readonly Episode[] = episodesWithVolumes): boolean {
  return list.some((e) => volumeOf(e) >= 2 && (e.id === episodeId || e.questIds.includes(questId)));
}
