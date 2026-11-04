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
  if (episode.format === 'story') return (episode.storyIds ?? []).some(laterTaleNeedsInternet);
  return !(lessonContent.isCellReady(episode.id) || cellOpensOffline(episode.id));
}

/**
 * One tale of a book 2 page that cannot open offline (row CM-5B): neither loaded in this session nor on the device. Read
 * while `useLaterNeedsInternet` says the page needs the internet (that hook subscribes to the saves and the chunks).
 */
export function laterTaleNeedsInternet(storyId: string): boolean {
  return !(storyContent.isStoryReady(storyId) || storyOpensOffline(storyId));
}
