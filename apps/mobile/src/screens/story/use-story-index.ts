import type { Episode } from '@hangul-route/content-schema';
import { episodesAll, episodesWithVolumes } from '../../content/episodes';
import { defaultStoryIndex, type StoryIndexEntry } from '../../logic/story/story-index';
import { useCurrFlag } from '../../store/remote-config-store';

/**
 * The story index a screen reads, with the later volumes while `volumes` is on (F-CURR-002 CM-40, row CM-46): a book 2
 * tale then gets Next story on Results and its culture notes count as found, and none of it shows while the flag is
 * off. A hook over `defaultStoryIndex` and the flag, like `use-story-notes-found.ts`, with no unit test of its own.
 */
export function useStoryIndex(): { readonly entries: readonly StoryIndexEntry[]; readonly episodes: readonly Episode[]; readonly volumesOn: boolean } {
  const volumesOn = useCurrFlag('volumes');
  return {
    entries: defaultStoryIndex({ volumes: volumesOn }),
    episodes: volumesOn ? episodesWithVolumes : episodesAll,
    volumesOn,
  };
}
