import type { Episode } from '@hangul-route/content-schema';
import { useEffect, useSyncExternalStore } from 'react';
import { useOnline } from '../../components/use-online';
import { cellOpensOffline, storyOpensOffline } from '../../content/later-content';
import { lessonContent } from '../../content/lessons';
import { storyContent } from '../../content/stories';
import { offlinePacks, useOfflinePacks } from '../../store/offline-packs-store';

/**
 * A later volume (a cell's Volume 2, a book 2) that cannot open now (F-CURR-002 row CM-5B): the device is offline and
 * its body is neither loaded in this session nor saved on the device. Its page then says, calmly, that it needs the
 * internet the first time, instead of a Start that would end on the crash screen. False for every first volume, which
 * is precached, and whenever the device is online.
 */
export function useLaterNeedsInternet(episode: Pick<Episode, 'id' | 'volume' | 'format' | 'storyIds'> | undefined): boolean {
  const online = useOnline();
  // Re-read when a save lands or a chunk arrives.
  useOfflinePacks((s) => s.available);
  useSyncExternalStore(lessonContent.subscribe, lessonContent.version);
  useSyncExternalStore(storyContent.subscribe, storyContent.version);
  useEffect(() => {
    void offlinePacks.getState().init();
  }, []);
  if (episode === undefined || online || (episode.volume ?? 1) < 2) return false;
  if (episode.format === 'story') {
    return !(episode.storyIds ?? []).every((id) => storyContent.isStoryReady(id) || storyOpensOffline(id));
  }
  return !(lessonContent.isCellReady(episode.id) || cellOpensOffline(episode.id));
}
