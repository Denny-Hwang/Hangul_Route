import type { HeritageCard, ThemeKey } from '@hangul-route/content-schema';
import {
  Body,
  Caption,
  Card,
  Heading,
  HeritageCardArt,
  Icon,
  Pill,
  Screen,
  SectionTabs,
  Spacer,
  SplitPane,
  TAB_SCREEN_EDGES,
  borderWidth,
  colors,
  layout,
  radii,
  spacing,
  supportedCardIds,
  typography,
  useLayoutClass,
  useMediaSize,
} from '@hangul-route/design-system';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { heritageCardsAll, themes } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard, localizeTheme } from '../../logic/content-locale';
import { initialCard, latchedSelection, reconcileSelection, type PaneLatch } from '../../logic/layout/pane-selection';
import {
  cardGalleryColumns,
  cardThumbArtSize,
  contentWidth,
  galleryGridWidth,
  gridCellWidth,
  type GalleryMode,
  gridRows,
} from '../../logic/layout/pane-sizes';
import { selectedSection, visibleSections, type LibrarySectionId } from '../../logic/story/library-sections';
import { sectionTitle, shelfCopy } from '../../logic/story/shelf-copy';
import { defaultStoryIndex } from '../../logic/story/story-index';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { CardDetailView } from './CardDetailView';
import { StoryShelf } from './StoryShelf';

/** Card art in a gallery thumb at scale 1 (phones), and the thumb's padding plus its thickest border on both sides. */
const THUMB_ART = 96;
const THUMB_PADDING = spacing.md;
const THUMB_CHROME = 2 * THUMB_PADDING + 2 * borderWidth.thick;
const GALLERY_GAP = spacing.sm;
/** The phone gallery: two cards a row at 47 %, exactly as before F-LAYOUT-001. */
const PHONE_CELL: ViewStyle = { flexBasis: '47%' };
const ROW_CELL: ViewStyle = { flex: 1 };
/** The sections this build can draw; Culture joins with its section (F-STORY-004 PR 4.7). */
const DRAWN_SECTIONS: ReadonlySet<LibrarySectionId> = new Set(['cards', 'story-time']);

export function LibraryScreen(): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.library;
  const locale = useLocale();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const [filter, setFilter] = useState<ThemeKey | 'all'>('all');

  // Library sections (F-STORY-004 §3.3): reviewed stories only (D14), so a production build with no
  // reviewed story offers Cards alone and the screen is exactly today's gallery, with no tab row.
  const copy = shelfCopy(messages);
  const storyIndex = defaultStoryIndex();
  const sections = useMemo(
    () => visibleSections({ entries: storyIndex }).filter((id) => DRAWN_SECTIONS.has(id)),
    [storyIndex],
  );
  const requested = useRoute<RouteProp<MainTabParamList, 'Library'>>().params?.section;
  const tabNavigation = useNavigation<BottomTabNavigationProp<MainTabParamList, 'Library'>>();
  const [section, setSection] = useState<LibrarySectionId>(() => selectedSection(requested, sections));
  // A deep link (`params.section`) selects its section, then is cleared so the same link works again.
  // Switching tabs is local state only: not persisted, no navigation.
  useEffect(() => {
    if (requested === undefined) return;
    setSection(selectedSection(requested, sections));
    tabNavigation.setParams({ section: undefined });
  }, [requested, sections, tabNavigation]);
  const tabsShown = sections.length >= 2;
  const active: LibrarySectionId = tabsShown ? section : 'cards';
  const tabs = tabsShown ? (
    <>
      <Spacer size="md" />
      <SectionTabs
        items={sections.map((id) => ({ id, label: sectionTitle(id, copy) }))}
        value={active}
        onChange={setSection}
        accessibilityLabel={copy.sectionsLabel}
        testID="library-sections"
      />
    </>
  ) : null;

  const unlockedIds = useMemo(() => new Set((snap?.cards ?? []).map((c) => c.cardId)), [snap]);

  const visible = useMemo(() => {
    return filter === 'all' ? heritageCardsAll : heritageCardsAll.filter((c) => c.theme === filter);
  }, [filter]);

  // Two panes (wide window, F-LAYOUT-001 §3.6, §3.7): a card tap selects it and the right pane shows the
  // card page; one pane: a tap opens the card screen as always. 3 columns on regular and in the master pane.
  const lc = useLayoutClass();
  const paneMode = lc.panes === 2;
  const columns = cardGalleryColumns(lc, layout.columns.cards.compact);
  const phoneGallery = columns === layout.columns.cards.compact;
  const ownerId = profile?.id ?? null;
  const [latch, setLatch] = useState<PaneLatch | null>(null);
  const selected = latchedSelection(latch, ownerId);
  const setSelected = (id: string): void => setLatch({ ownerId, id });
  const selectedId = reconcileSelection(selected, visible, initialCard(visible, snap?.cards ?? []));
  // Latch the first selection (the latest earned card) so earning another one does not move it; it
  // survives rotation as screen state. A filter that hides it shows another card without forgetting it.
  // The latch belongs to the profile: switching learner starts from that learner's latest card.
  useEffect(() => {
    if (paneMode && selected === null && selectedId !== null) setLatch({ ownerId, id: selectedId });
  }, [paneMode, selected, selectedId, ownerId]);

  const screenWidth = phoneGallery ? 'reading' : 'full';
  // The grid's measured width (a classic scrollbar narrows the master pane; a notch narrows a window),
  // falling back to the computed width on the first frame.
  const galleryMode: GalleryMode = paneMode ? 'pane' : 'row';
  const [measured, setMeasured] = useState<{ mode: GalleryMode; width: number } | null>(null);
  const onGridLayout = (e: LayoutChangeEvent): void => {
    const width = e.nativeEvent.layout.width;
    setMeasured((prev) => (prev?.mode === galleryMode && prev.width === width ? prev : { mode: galleryMode, width }));
  };
  const fallbackWidth = paneMode ? layout.pane.master : contentWidth(lc.windowWidth, lc.gutter, lc.maxWidth[screenWidth]);
  const gridWidth = phoneGallery ? fallbackWidth : galleryGridWidth(measured, galleryMode, fallbackWidth);
  const artSize = cardThumbArtSize(useMediaSize(THUMB_ART), gridCellWidth(gridWidth, columns, GALLERY_GAP), THUMB_CHROME);

  const thumb = (card: HeritageCard, cellStyle: ViewStyle): React.ReactElement => (
    <CardThumb
      key={card.id}
      card={card}
      unlocked={unlockedIds.has(card.id)}
      cellStyle={cellStyle}
      artSize={artSize}
      narrow={paneMode}
      selected={paneMode ? card.id === selectedId : undefined}
      onPress={() => (paneMode ? setSelected(card.id) : navigation.navigate('CardDetail', { cardId: card.id }))}
    />
  );

  const gallery = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Heading level="title">{m.title}</Heading>
          <Caption tone="muted">{m.collected.line(unlockedIds.size, heritageCardsAll.length)}</Caption>
        </View>
        <Pill label={m.collected.pill(unlockedIds.size, heritageCardsAll.length)} tone="primary" />
      </View>
      {tabs}

      <Spacer size="md" />
      <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
        <FilterChip label={m.filterAll} active={filter === 'all'} onPress={() => setFilter('all')} />
        {themes.map((theme) => localizeTheme(theme, locale)).map((t) => (
          <FilterChip
            key={t.key}
            label={t.titleEn.split(' ')[0] ?? t.titleEn}
            active={filter === t.key}
            onPress={() => setFilter(t.key)}
          />
        ))}
      </View>

      <Spacer size="lg" />
      {phoneGallery ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GALLERY_GAP }}>
          {visible.map((card) => thumb(card, PHONE_CELL))}
        </View>
      ) : (
        // Rows of `columns` equal cells; the last row is padded so its cards keep the same width.
        <View style={{ gap: GALLERY_GAP }} onLayout={onGridLayout}>
          {gridRows(visible, columns).map((row, r) => (
            <View key={r} style={{ flexDirection: 'row', gap: GALLERY_GAP }}>
              {row.map((card, i) => (card ? thumb(card, ROW_CELL) : <View key={`pad-${i}`} style={ROW_CELL} />))}
            </View>
          ))}
        </View>
      )}
      <Spacer size="xl" />

      <Card padding="md" tone="brand">
        <Heading level="prompt">{m.how.title}</Heading>
        <Spacer size="xs" />
        <Body tone="secondary" size="sm">
          {m.how.body}
        </Body>
      </Card>
      <Spacer size="xl" />
    </>
  );

  // The card page as the stack screen shows it, without its close button; a locked card also says how it is earned.
  const detail = selectedId ? <CardDetailView key={selectedId} cardId={selectedId} showHowToEarn /> : null;

  if (active === 'story-time') {
    // Story sections use the full width with no detail pane on every window (F-LAYOUT-001 §3.6).
    return (
      <Screen tone="canvas" edges={TAB_SCREEN_EDGES} width="full" scrollable>
        <Heading level="title">{m.title}</Heading>
        {tabs}
        <Spacer size="lg" />
        <StoryShelf category="story-time" index={storyIndex} />
        <Spacer size="xl" />
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" edges={TAB_SCREEN_EDGES} width={screenWidth} scrollable={!paneMode}>
      <SplitPane master={gallery} detail={detail} masterLabel={m.panes.master} detailLabel={m.panes.detail} detailScrolls={false} />
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: active ? colors.brand.primary : colors.surface.paper,
        borderWidth: 1,
        borderColor: active ? colors.brand.primary : colors.border.subtle,
      }}
    >
      <Text style={{ color: active ? colors.text.inverse : colors.text.primary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function CardThumb({
  card: source,
  unlocked,
  cellStyle,
  artSize,
  narrow,
  selected,
  onPress,
}: {
  card: HeritageCard;
  unlocked: boolean;
  /** `flexBasis: '47%'` in the phone gallery, `flex: 1` in a row of the 3-column gallery. */
  cellStyle: ViewStyle;
  artSize: number;
  /** A 128-wide master-pane cell: the Korean line steps down one size so a four-syllable word stays on one line. */
  narrow: boolean;
  /** Two panes only: the card shown in the detail pane (focus border, `aria-selected`). */
  selected?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const card = localizeCard(source, useLocale());
  const messages = useMessages();
  const m = messages.learner.library;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      aria-selected={selected}
      accessibilityLabel={unlocked ? card.titleEn : messages.a11y.lockedCard}
      style={{
        ...cellStyle,
        backgroundColor: unlocked ? colors.surface.paper : colors.surface.sunken,
        borderRadius: radii.lg,
        borderWidth: selected ? borderWidth.thick : 2,
        borderColor: selected ? colors.border.focus : unlocked ? colors.rarity[card.rarity] : colors.border.subtle,
        padding: THUMB_PADDING,
        minHeight: 140,
      }}
    >
      {!unlocked ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Icon name="lock" size={32} color={colors.text.muted} />
          <Caption tone="muted">{m.locked}</Caption>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Pill tone={card.rarity === 'legendary' ? 'nudge' : card.rarity === 'rare' ? 'info' : card.rarity === 'uncommon' ? 'success' : 'neutral'} label={m.rarity[card.rarity]} size="sm" />
          </View>
          <Spacer size="xs" />
          {supportedCardIds.includes(card.id) ? (
            <View style={{ alignItems: 'center' }}>
              <HeritageCardArt cardId={card.id} size={artSize} accessibilityLabel={messages.a11y.cardArt(card.titleEn)} />
            </View>
          ) : null}
          <Spacer size="xs" />
          <Text style={{ fontSize: narrow ? typography.size.prompt : typography.size.title, fontWeight: '700', color: colors.text.primary }}>
            {card.subtitleKo ?? card.titleEn}
          </Text>
          {card.romanization ? (
            <Caption tone="muted" style={{ fontStyle: 'italic' }}>
              {card.romanization}
            </Caption>
          ) : null}
          <Caption tone="secondary">{card.titleEn}</Caption>
        </>
      )}
    </Pressable>
  );
}
