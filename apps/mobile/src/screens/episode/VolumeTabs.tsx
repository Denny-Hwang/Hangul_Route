import { SectionTabs, Spacer } from '@hangul-route/design-system';
import type { Episode } from '@hangul-route/content-schema';
import type { ReactElement } from 'react';
import { volumeOf } from '../../content/episodes';
import { useMessages } from '../../i18n/use-messages';

export interface VolumeTabsProps {
  /** The cell's playable volumes in order (`episodesFor` over `withVolumes`); fewer than two draws nothing. */
  volumes: readonly Pick<Episode, 'id' | 'volume'>[];
  /** The volume this page shows. */
  currentId: string;
  /** Opens another volume's page (the stack screen sets its param; the Journey pane selects it). */
  onOpenVolume?: (episodeId: string) => void;
}

/**
 * "Vol 1" and "Vol 2" on a cell's page (F-CURR-002 §5.1 and row CM-40, F-STORY-005 PR 5.8; wireframe
 * `journey/volumes.md` B): a tab row under the pills, only for a cell with two playable volumes, which the caller
 * passes only while `volumes` is on. Each tab is read as "Volume 1" / "Volume 2"; the page itself is the volume's
 * episode page, so a tap opens the other volume's page.
 */
export function VolumeTabs({ volumes, currentId, onOpenVolume }: VolumeTabsProps): ReactElement | null {
  const m = useMessages().learner.episode.volumes;
  if (volumes.length < 2) return null;
  return (
    <>
      <Spacer size="sm" />
      <SectionTabs
        items={volumes.map((v) => ({ id: v.id, label: m.tab(volumeOf(v)), accessibilityLabel: m.tabA11y(volumeOf(v)) }))}
        value={currentId}
        onChange={(id) => {
          if (id !== currentId) onOpenVolume?.(id);
        }}
        accessibilityLabel={m.label}
        testID="episode-volumes"
      />
    </>
  );
}
