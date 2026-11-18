import { episodeById } from '../../content/episodes';
import { LATER_CELLS, LATER_STORY_IDS, contentScope, type ContentScope } from '../../content/later-content';

/**
 * Whether the presenter's chooser lists an episode before its body is in ([FN] AMENDMENTS-FINISH-2026-11 row FN-4: the
 * home lists from the manifest, and a deck loads its cells when chosen): a known episode of Volume 1 always; a later
 * volume (row CM-5B) when its cell and its book 2 tales can load, on the device or over the network now, as the grown-up
 * roots listed it once they had loaded it. Its own module, so it rides in the presenter's chunk, not the start bundle.
 */
export function presenterListsEpisode(episodeId: string, scope: ContentScope = contentScope()): boolean {
  const episode = episodeById(episodeId);
  if (episode === undefined) return false;
  if ((episode.volume ?? 1) < 2) return true;
  const later = scope.later(true);
  // A book 2 of Stage 5 is no lesson cell: its tales are what load.
  const cellOk = !LATER_CELLS.includes(episode.id) || later.cells.includes(episode.id);
  return cellOk && (episode.storyIds ?? []).every((id) => !LATER_STORY_IDS.has(id) || later.stories.includes(id));
}
