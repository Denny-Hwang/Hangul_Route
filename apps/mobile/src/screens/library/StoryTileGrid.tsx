import { layout, spacing, useLayoutClass } from '@hangul-route/design-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { isContentLocked } from '../../logic/content-access';
import { localizeStory } from '../../logic/content-locale';
import { contentWidth, gridCellWidth, gridRows } from '../../logic/layout/pane-sizes';
import { emptyBookmarks, type BookmarkFile } from '../../logic/story/bookmarks';
import { shelfCopy, type StoryShelfCopy } from '../../logic/story/shelf-copy';
import type { StoryIndexEntry } from '../../logic/story/story-index';
import { storyStatus, type StoryStatus } from '../../logic/story/story-status';
import { lockedStoryGate, storyTileColumns, storyTileView, type StoryTileView } from '../../logic/story/story-tile';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useStoryStore } from '../../store/story-store';
import { useAccessTier } from '../../store/tier-store';
import { StoryTile } from './StoryTile';

/**
 * The story tiles of a list of index entries, shared by the Library's story sections (F-STORY-004
 * §3.4) and the cell page (F-STORY-005 §3.6, wireframe design/wireframes/story/cell-stories.md B):
 * the same `StoryTile`, the same states, the same columns (1 at 320, 2 at 360-767, 3-4 from 768) and
 * the same tap (the story's episode page, or the grown-up gate for a locked tile with gating on).
 */

const GRID_GAP = spacing.sm;
const NO_BOOKMARKS = emptyBookmarks();

export interface StoryTileItem {
  entry: StoryIndexEntry;
  status: StoryStatus;
  view: StoryTileView;
}

export interface StoryTiles {
  /** The entries in the order given, localised, with their status and tile view. */
  items: StoryTileItem[];
  /** The episode page, or (locked, gating on) `story.locked.tapped` and the grown-up gate. */
  openTile: (item: StoryTileItem) => void;
  isLocked: (entry: StoryIndexEntry) => boolean;
  snap: ProgressSnapshot | undefined;
  bookmarks: BookmarkFile;
  copy: StoryShelfCopy;
  /** D2: hide-until-tap profiles see no romanization on a tile (one button per tile); the reader reveals it. */
  romanizationShown: boolean;
  profileId: string | undefined;
}

/**
 * `openEpisode` replaces the default open (`navigate('EpisodeDetail')`, right for the Library, whose stack
 * holds no episode page); the cell page pushes instead, so Back returns to it.
 */
export function useStoryTiles(entries: readonly StoryIndexEntry[], openEpisode?: (episodeId: string) => void): StoryTiles {
  const messages = useMessages();
  const copy = useMemo(() => shelfCopy(messages), [messages]);
  const locale = useLocale();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { opensDirectly } = useAudience();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const bookmarks = useStoryStore((s) => (profile ? s.byProfile[profile.id] : undefined)) ?? NO_BOOKMARKS;
  // The access tier (F-ENT-003 section 3.4): a change in the inbox, the spaces or the subscription re-runs `isLocked`.
  const tier = useAccessTier(profile?.id ?? '');
  const romanizationShown = useRomanizationMode() === 'always';

  // Nothing is locked while gating is off (D5): `isContentLocked` is false for every story then.
  const isLocked = useCallback(
    (entry: StoryIndexEntry): boolean =>
      isContentLocked({ kind: 'story', id: entry.storyId, tier, gatingEnabled: gatingActive(flags, bundleOs()) }),
    [tier],
  );

  const items: StoryTileItem[] = useMemo(
    () =>
      entries.map((source) => {
        // Story text in the UI language (F-CNT-002 overlay); taught Korean never changes.
        const entry = { ...source, story: localizeStory(source.story, locale) };
        const status = storyStatus(entry, snap, bookmarks);
        return { entry, status, view: storyTileView({ entry, status, locked: isLocked(entry), copy }) };
      }),
    [entries, locale, snap, bookmarks, isLocked, copy],
  );

  const profileId = profile?.id;
  const openTile = useCallback(
    (item: StoryTileItem): void => {
      if (item.view.locked) {
        void track({ name: 'story.locked.tapped', profileId, payload: { storyId: item.entry.storyId } });
        // The grown-up gate Journey uses for a locked stage (only reachable with gating on).
        const gate = lockedStoryGate(opensDirectly(false));
        if (gate.route === 'Paywall') navigation.navigate('Paywall', gate.params);
        else navigation.navigate('PinEntry', gate.params);
        return;
      }
      if (openEpisode) openEpisode(item.entry.episodeId);
      else navigation.navigate('EpisodeDetail', { episodeId: item.entry.episodeId, from: 'library' });
    },
    [profileId, opensDirectly, navigation, openEpisode],
  );

  return { items, openTile, isLocked, snap, bookmarks, copy, romanizationShown, profileId };
}

/** The measured grid's width, for a hero sized to it; before the first layout, the window's content width. */
export function useTileGridWidth(): { gridWidth: number; columns: number; onGridLayout: (e: LayoutChangeEvent) => void } {
  const lc = useLayoutClass();
  const columns = storyTileColumns(lc.windowWidth);
  const [measured, setMeasured] = useState<number | null>(null);
  const onGridLayout = useCallback((e: LayoutChangeEvent): void => {
    const width = Math.round(e.nativeEvent.layout.width);
    setMeasured((prev) => (prev === width ? prev : width));
  }, []);
  return { gridWidth: measured ?? contentWidth(lc.windowWidth, lc.gutter, layout.maxWidth.full), columns, onGridLayout };
}

export function StoryTileGrid({
  tiles,
  grid,
  testID,
}: {
  tiles: Pick<StoryTiles, 'items' | 'openTile' | 'romanizationShown'>;
  grid: ReturnType<typeof useTileGridWidth>;
  testID: string;
}): React.ReactElement {
  const cellWidth = gridCellWidth(grid.gridWidth, grid.columns, GRID_GAP);
  return (
    <View style={{ gap: GRID_GAP }} onLayout={grid.onGridLayout} testID={testID}>
      {gridRows(tiles.items, grid.columns).map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: GRID_GAP, alignItems: 'stretch' }}>
          {row.map((item, i) =>
            item ? (
              <StoryTile
                key={item.entry.questId}
                view={item.view}
                width={cellWidth}
                romanizationShown={tiles.romanizationShown}
                onPress={() => tiles.openTile(item)}
                testID={`story-tile-${item.entry.storyId}`}
              />
            ) : (
              <View key={`pad-${i}`} style={{ width: cellWidth }} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}
