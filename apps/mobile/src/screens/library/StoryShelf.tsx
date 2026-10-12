import { Body, Button, Caption, Card, Heading, KoreanText, Spacer, StoryScene, spacing } from '@hangul-route/design-system';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { planOpenStory } from '../../logic/story/open-story';
import { shelfCopy } from '../../logic/story/shelf-copy';
import { shelfEntries, type ShelfCategory, type StoryIndexEntry } from '../../logic/story/story-index';
import { storyFitsForSnapshot } from '../../logic/story/story-fit';
import { pickedForYou } from '../../logic/story/story-pick';
import { heroAction, shelfViewedPayload } from '../../logic/story/story-tile';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { CoverFallback } from './StoryTile';
import { StoryTileGrid, useStoryTiles, useTileGridWidth, type StoryTileItem } from './StoryTileGrid';

/** The hero cover never grows past this on a wide window; the text sits beside it from `sideBySide` widths. */
const HERO_COVER_MAX = 360;
/** `Card padding="md"` (spacing.lg on each side). */
const HERO_PADDING = spacing.lg;

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tabNavigation = useNavigation<BottomTabNavigationProp<MainTabParamList, 'Library'>>();
  const entries = useMemo(() => shelfEntries(index, category), [index, category]);
  const tiles = useStoryTiles(entries);
  const { items, snap, bookmarks, isLocked, copy, romanizationShown, profileId } = tiles;

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
        void track({ name: 'story.shelf.viewed', profileId, payload: { ...payload } });
      }
      return () => {
        if (tabNavigation.isFocused()) return; // a dependency changed, not a blur
        const tabs = tabNavigation.getState();
        coveredByStack.current = tabs.routes[tabs.index]?.name === 'Library';
      };
    }, [category, profileId, tabNavigation]),
  );

  const grid = useTileGridWidth();

  const openHero = (item: StoryTileItem): void => {
    const plan = planOpenStory({ entry: item.entry, status: item.status, source: 'library', mode: heroAction(item.status, copy).mode });
    void track({ name: plan.event.name, profileId, payload: { ...plan.event.payload } });
    // The hero opens the story directly; Keep reading resumes on the story step (QuestPlayer's `questStartStep`).
    if (plan.route === 'StoryReader') navigation.navigate('StoryReader', plan.params);
    else navigation.navigate('QuestPlayer', plan.params);
  };

  return (
    <View testID={`library-shelf-${category}`}>
      {hero ? (
        <HeroTile
          item={hero}
          gridWidth={grid.gridWidth}
          sideBySide={grid.columns >= 3}
          romanizationShown={romanizationShown}
          onOpen={() => openHero(hero)}
        />
      ) : null}
      {hero ? <Spacer size="lg" /> : null}
      <StoryTileGrid tiles={tiles} grid={grid} testID={`library-shelf-${category}-grid`} />
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
  item: StoryTileItem;
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
