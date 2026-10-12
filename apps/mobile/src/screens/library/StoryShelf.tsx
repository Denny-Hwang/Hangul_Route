import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  KoreanText,
  Spacer,
  StoryScene,
  layout,
  spacing,
  useLayoutClass,
} from '@hangul-route/design-system';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { flags } from '../../config/flags';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { isContentLocked } from '../../logic/content-access';
import { localizeStory } from '../../logic/content-locale';
import { contentWidth, gridCellWidth, gridRows } from '../../logic/layout/pane-sizes';
import { emptyBookmarks } from '../../logic/story/bookmarks';
import { planOpenStory } from '../../logic/story/open-story';
import { shelfCopy } from '../../logic/story/shelf-copy';
import { shelfEntries, type ShelfCategory, type StoryIndexEntry } from '../../logic/story/story-index';
import { storyFitsForSnapshot } from '../../logic/story/story-fit';
import { pickedForYou } from '../../logic/story/story-pick';
import { storyStatus, type StoryStatus } from '../../logic/story/story-status';
import {
  heroAction,
  lockedStoryGate,
  shelfViewedPayload,
  storyTileColumns,
  storyTileView,
  type StoryTileView,
} from '../../logic/story/story-tile';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { useAudience } from '../../store/audience';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useStoryStore } from '../../store/story-store';
import { effectiveTier, useTierStore } from '../../store/tier-store';
import { CoverFallback, StoryTile } from './StoryTile';

const GRID_GAP = spacing.sm;
/** The hero cover never grows past this on a wide window; the text sits beside it from `sideBySide` widths. */
const HERO_COVER_MAX = 360;
/** `Card padding="md"` (spacing.lg on each side). */
const HERO_PADDING = spacing.lg;
const NO_BOOKMARKS = emptyBookmarks();

interface ShelfItem {
  entry: StoryIndexEntry;
  status: StoryStatus;
  view: StoryTileView;
}

/**
 * One story section of the Library (F-STORY-004 §3.4): a "Picked for you"
 * hero with its one primary button, then the category's tiles in
 * `shelf.order` (never re-sorted by progress). Story Time uses it with the
 * hero; the Culture section (PR 4.7) puts its notes card, its one primary
 * action, above the tiles alone (`hero={false}`, wireframe library/culture C).
 * `story.shelf.viewed` fires once each time the section is shown.
 */
export function StoryShelf({
  category,
  index,
  hero: withHero = true,
}: {
  category: ShelfCategory;
  index: readonly StoryIndexEntry[];
  /** The "Picked for you" hero; `false` draws the tiles only. */
  hero?: boolean;
}): React.ReactElement {
  const messages = useMessages();
  const copy = shelfCopy(messages);
  const locale = useLocale();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabNavigation = useNavigation<BottomTabNavigationProp<MainTabParamList, 'Library'>>();
  const { opensDirectly } = useAudience();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const bookmarks = useStoryStore((s) => (profile ? s.byProfile[profile.id] : undefined)) ?? NO_BOOKMARKS;
  // `effectiveTier` reads both stores imperatively: subscribe to each so a change re-runs `isLocked`.
  const cachedTier = useTierStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const subscription = useAccountStore((s) => s.subscription);
  void cachedTier;
  void subscription;
  const tier = effectiveTier(profile?.id ?? '', new Date()).tier;
  // D2: hide-until-tap profiles see no romanization on the shelf (one button per tile, no reveal); the reader reveals it.
  const romanizationShown = useRomanizationMode() === 'always';

  // Nothing is locked while gating is off (D5): `isContentLocked` is false for every story then.
  const isLocked = useCallback(
    (entry: StoryIndexEntry): boolean =>
      isContentLocked({ kind: 'story', id: entry.storyId, tier, gatingEnabled: flags.contentGatingEnabled }),
    [tier],
  );

  const items: ShelfItem[] = useMemo(
    () =>
      shelfEntries(index, category).map((source) => {
        // Story text in the UI language (F-CNT-002 overlay); taught Korean never changes.
        const entry = { ...source, story: localizeStory(source.story, locale) };
        const status = storyStatus(entry, snap, bookmarks);
        return { entry, status, view: storyTileView({ entry, status, locked: isLocked(entry), copy }) };
      }),
    [index, category, locale, snap, bookmarks, isLocked, copy],
  );

  const hero = useMemo(() => {
    if (!withHero) return null;
    // F-STORY-005 §3.4: stories near the learner's stage come first; it only orders, never hides.
    const fits = storyFitsForSnapshot(snap);
    const pick = pickedForYou({ entries: items.map((i) => i.entry), snapshot: snap, bookmarks, isLocked, category, fits });
    return pick ? items.find((i) => i.entry.questId === pick.entry.questId) ?? null : null;
  }, [withHero, items, snap, bookmarks, isLocked, category]);

  // Once per visit (§3.11): switching to this section, or the Library tab gaining focus with it shown.
  // Coming back from a screen pushed over the tabs (a story, its episode page, the paywall) is the same
  // visit: that blur leaves Library the focused tab, so the next focus is not counted.
  const latest = useRef(items);
  latest.current = items;
  const coveredByStack = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (coveredByStack.current) {
        coveredByStack.current = false;
      } else {
        const payload = shelfViewedPayload(category, latest.current.map((i) => i.status));
        void track({ name: 'story.shelf.viewed', profileId: profile?.id, payload: { ...payload } });
      }
      return () => {
        if (tabNavigation.isFocused()) return; // a dependency changed, not a blur
        const tabs = tabNavigation.getState();
        coveredByStack.current = tabs.routes[tabs.index]?.name === 'Library';
      };
    }, [category, profile?.id, tabNavigation]),
  );

  const lc = useLayoutClass();
  const columns = storyTileColumns(lc.windowWidth);
  const [measured, setMeasured] = useState<number | null>(null);
  const onGridLayout = (e: LayoutChangeEvent): void => {
    const width = Math.round(e.nativeEvent.layout.width);
    setMeasured((prev) => (prev === width ? prev : width));
  };
  const gridWidth = measured ?? contentWidth(lc.windowWidth, lc.gutter, layout.maxWidth.full);
  const cellWidth = gridCellWidth(gridWidth, columns, GRID_GAP);

  const openHero = (item: ShelfItem): void => {
    const plan = planOpenStory({ entry: item.entry, status: item.status, source: 'library', mode: heroAction(item.status, copy).mode });
    void track({ name: plan.event.name, profileId: profile?.id, payload: { ...plan.event.payload } });
    // The hero opens the story directly; Keep reading resumes on the story step (QuestPlayer's `questStartStep`).
    if (plan.route === 'StoryReader') navigation.navigate('StoryReader', plan.params);
    else navigation.navigate('QuestPlayer', plan.params);
  };

  const openTile = (item: ShelfItem): void => {
    if (item.view.locked) {
      void track({ name: 'story.locked.tapped', profileId: profile?.id, payload: { storyId: item.entry.storyId } });
      // The grown-up gate Journey uses for a locked stage (only reachable with gating on).
      const gate = lockedStoryGate(opensDirectly(false));
      if (gate.route === 'Paywall') navigation.navigate('Paywall', gate.params);
      else navigation.navigate('PinEntry', gate.params);
      return;
    }
    navigation.navigate('EpisodeDetail', { episodeId: item.entry.episodeId });
  };

  return (
    <View testID={`library-shelf-${category}`}>
      {hero ? (
        <HeroTile
          item={hero}
          gridWidth={gridWidth}
          sideBySide={columns >= 3}
          romanizationShown={romanizationShown}
          onOpen={() => openHero(hero)}
        />
      ) : null}
      {hero ? <Spacer size="lg" /> : null}
      <View style={{ gap: GRID_GAP }} onLayout={onGridLayout} testID={`library-shelf-${category}-grid`}>
        {gridRows(items, columns).map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: GRID_GAP, alignItems: 'stretch' }}>
            {row.map((item, i) =>
              item ? (
                <StoryTile
                  key={item.entry.questId}
                  view={item.view}
                  width={cellWidth}
                  romanizationShown={romanizationShown}
                  onPress={() => openTile(item)}
                  testID={`story-tile-${item.entry.storyId}`}
                />
              ) : (
                <View key={`pad-${i}`} style={{ width: cellWidth }} />
              ),
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/** "Picked for you": cover, titles, "about N min" and the one primary button (Start, Keep reading or Read it again). */
function HeroTile({
  item,
  gridWidth,
  sideBySide,
  romanizationShown,
  onOpen,
}: {
  item: ShelfItem;
  gridWidth: number;
  /** Cover left, text right (3+ tile columns); stacked otherwise. */
  sideBySide: boolean;
  /** D2, as on the tiles. */
  romanizationShown: boolean;
  onOpen: () => void;
}): React.ReactElement {
  const copy = shelfCopy(useMessages());
  const { view, status } = item;
  const action = heroAction(status, copy);
  // The card's inner width: its `md` padding on both sides.
  const inner = gridWidth - 2 * HERO_PADDING;
  const coverWidth = Math.max(0, Math.min(HERO_COVER_MAX, sideBySide ? Math.floor(inner / 2) : inner));
  return (
    <Card padding="md" tone="paper" testID="library-hero">
      <Heading level="prompt">{copy.pickedForYou}</Heading>
      <Spacer size="sm" />
      <View style={{ flexDirection: sideBySide ? 'row' : 'column', gap: spacing.lg, alignItems: sideBySide ? 'center' : 'stretch' }}>
        {coverWidth > 0 ? (
          <View style={{ alignItems: 'center' }}>
            <StoryScene
              art={view.cover}
              theme={view.theme}
              width={coverWidth}
              decorative
              fallback={<CoverFallback ko={view.ko} coverWidth={coverWidth} />}
            />
          </View>
        ) : null}
        <View style={{ flex: sideBySide ? 1 : undefined, gap: spacing.sm }}>
          <Body weight="bold" size="lg">
            {view.titleEn}
          </Body>
          <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
            <KoreanText ko={view.ko} romanization={view.romanization} romanizationShown={romanizationShown} size="sm" />
          </View>
          <Caption tone="muted">{view.minutesLine}</Caption>
          <Button
            label={action.label}
            accessibilityLabel={copy.heroLabel(action.label, view.titleEn)}
            onPress={onOpen}
            tone="primary"
            size="lg"
            fullWidth={!sideBySide}
            testID="library-hero-cta"
          />
        </View>
      </View>
    </Card>
  );
}
