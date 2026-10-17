import type { HeritageCard, ThemeKey } from '@hangul-route/content-schema';
import {
  Body,
  Caption,
  Card,
  Heading,
  Icon,
  Pill,
  Screen,
  SectionTabs,
  sectionTabId,
  Spacer,
  SplitPane,
  TAB_SCREEN_EDGES,
  borderWidth,
  colors,
  layout,
  radii,
  spacing,
  typography,
  useLayoutClass,
  useMediaSize,
  KOREAN_LINE_BREAK,
  useTypeScale,
} from '@hangul-route/design-system';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { CardArt } from '../../components/CardArt';
import { themes } from '../../content';
import { awardWorld } from '../../content/award-world';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { earnHint } from '../../logic/awards/earn-hint';
import { libraryExplainer } from '../../logic/awards/explainer';
import { obtainableCards } from '../../logic/awards/obtainable';
import { cardTitleIsKo } from '../../logic/card-art';
import { localizeCard, localizeEpisode, localizeTheme } from '../../logic/content-locale';
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
import { librarySectionTabs, selectedSection, type LibrarySectionId } from '../../logic/story/library-sections';
import { sectionTitle, shelfCopy } from '../../logic/story/shelf-copy';
import { defaultStoryIndex } from '../../logic/story/story-index';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { CardDetailView } from './CardDetailView';
import { CultureSection } from './CultureSection';
import { StoryShelf } from './StoryShelf';
import { wordsOffered } from '../vocab/topic-data';
import { WordsSection } from '../vocab/WordsSection';

/** Card art in a gallery thumb at scale 1 (phones), and the thumb's padding plus its thickest border on both sides. */
const THUMB_ART = 96;
const THUMB_PADDING = spacing.md;
const THUMB_CHROME = 2 * THUMB_PADDING + 2 * borderWidth.thick;
const GALLERY_GAP = spacing.sm;
/** The phone gallery: two cards a row at 47 %, exactly as before F-LAYOUT-001. */
const PHONE_CELL: ViewStyle = { flexBasis: '47%' };
const ROW_CELL: ViewStyle = { flex: 1 };
/** The section body the tabs control (`role="tabpanel"`). */
const SECTION_PANEL_ID = 'library-section-panel';

export function LibraryScreen(): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.library;
  const locale = useLocale();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const markCardsSeen = useProgressStore((s) => s.markCardsSeen);
  const [filter, setFilter] = useState<ThemeKey | 'all'>('all');

  // Library sections (F-STORY-004 §3.3): reviewed stories only (D14), so a production build with no
  // reviewed story offers Cards alone and the screen is exactly today's gallery, with no tab row.
  const copy = shelfCopy(messages);
  const storyIndex = defaultStoryIndex();
  // Empty when only Cards is offered: no tab row at all. Words (F-VOC-003 T1) joins with its flag and a ready topic.
  const sections = useMemo(() => librarySectionTabs({ entries: storyIndex, words: wordsOffered() }), [storyIndex]);
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
  const tabsShown = sections.length > 0;
  const active: LibrarySectionId = tabsShown ? section : 'cards';
  // Cards sits in the split pane and Story Time spans the window, so a switch remounts the row: the
  // pressed tab then takes focus again instead of dropping keyboard and screen-reader focus (§3.12).
  const [tabFocus, setTabFocus] = useState(false);
  const switchSection = (id: LibrarySectionId): void => {
    setTabFocus(true);
    setSection(id);
  };
  const panel = (body: React.ReactNode): React.ReactNode =>
    tabsShown ? (
      <View role="tabpanel" id={SECTION_PANEL_ID} aria-labelledby={sectionTabId(SECTION_PANEL_ID, active)}>
        {body}
      </View>
    ) : (
      body
    );
  const tabs = tabsShown ? (
    <>
      <Spacer size="md" />
      <SectionTabs
        items={sections.map((id) => ({ id, label: sectionTitle(id, copy) }))}
        value={active}
        onChange={switchSection}
        accessibilityLabel={copy.sectionsLabel}
        testID="library-sections"
        panelId={SECTION_PANEL_ID}
        focusSelected={tabFocus}
      />
    </>
  ) : null;

  const unlockedIds = useMemo(() => new Set((snap?.cards ?? []).map((c) => c.cardId)), [snap]);
  // Earned since the learner last opened them (a catch-up or a Results award): a New pill until opened.
  const newIds = useMemo(() => new Set((snap?.cards ?? []).filter((c) => c.newSinceLastView).map((c) => c.cardId)), [snap]);

  // Only cards the learner holds or can still earn (F-STORY-006 §3.7): a card no rule can award is never a lock.
  const listed = useMemo(() => obtainableCards(awardWorld, unlockedIds), [unlockedIds]);
  const collected = listed.filter((c) => unlockedIds.has(c.id)).length;
  const explainer = libraryExplainer(awardWorld, listed, m.how);
  // Earn hints name episodes in the UI language.
  const hintWorld = useMemo(
    () => ({ ...awardWorld, episodes: awardWorld.episodes.map((e) => localizeEpisode(e, locale)) }),
    [locale],
  );

  const visible = useMemo(() => {
    return filter === 'all' ? listed : listed.filter((c) => c.theme === filter);
  }, [filter, listed]);

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

  const thumb = (card: HeritageCard, cellStyle: ViewStyle): React.ReactElement => {
    const unlocked = unlockedIds.has(card.id);
    return (
      <CardThumb
        key={card.id}
        card={card}
        unlocked={unlocked}
        isNew={unlocked && newIds.has(card.id)}
        hint={unlocked ? null : (earnHint(card, hintWorld, m.earnHint)?.text ?? messages.learner.cardDetail.earn.later)}
        cellStyle={cellStyle}
        artSize={artSize}
        narrow={paneMode}
        selected={paneMode ? card.id === selectedId : undefined}
        onPress={() => {
          // Opening an owned card clears its New pill (wireframe library/earn-hints).
          if (unlocked && profile) markCardsSeen(profile.id, [card.id]);
          if (paneMode) setSelected(card.id);
          else navigation.navigate('CardDetail', { cardId: card.id });
        }}
      />
    );
  };

  const gallery = (
    <>
      {/* A plain count, no N/M pill: the total grows with every release (F-STORY-006 §3.7, decision 3). */}
      <Heading level="title">{m.title}</Heading>
      <Caption tone="muted">{m.collected.line(collected)}</Caption>
      {tabs}
      {panel(
        <>
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
            {/* One line per award rule this build can fire, so the explainer never promises more. */}
            {explainer.map((line) => (
              <React.Fragment key={line}>
                <Spacer size="xs" />
                <Body tone="secondary" size="sm">
                  {line}
                </Body>
              </React.Fragment>
            ))}
          </Card>
          <Spacer size="xl" />
        </>,
      )}
    </>
  );

  // The card page as the stack screen shows it, without its close button; a locked card also says how it is earned.
  const detail = selectedId ? <CardDetailView key={selectedId} cardId={selectedId} showHowToEarn /> : null;

  if (active === 'theme-packs') {
    // Words (F-VOC-003 T1): the picker's grid inline, full width with no detail pane, like the story sections.
    return (
      <Screen tone="canvas" edges={TAB_SCREEN_EDGES} width="full" scrollable>
        <Heading level="title">{m.title}</Heading>
        {tabs}
        {panel(
          <>
            <Spacer size="lg" />
            <WordsSection />
            <Spacer size="xl" />
          </>,
        )}
      </Screen>
    );
  }

  if (active === 'story-time' || active === 'culture') {
    // Story sections use the full width with no detail pane on every window (F-LAYOUT-001 §3.6).
    return (
      <Screen tone="canvas" edges={TAB_SCREEN_EDGES} width="full" scrollable>
        <Heading level="title">{m.title}</Heading>
        {tabs}
        {panel(
          <>
            <Spacer size="lg" />
            {active === 'culture' ? <CultureSection index={storyIndex} /> : <StoryShelf category="story-time" index={storyIndex} />}
            <Spacer size="xl" />
          </>,
        )}
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
      <Text {...KOREAN_LINE_BREAK} style={{ color: active ? colors.text.inverse : colors.text.primary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function CardThumb({
  card: source,
  unlocked,
  isNew,
  hint,
  cellStyle,
  artSize,
  narrow,
  selected,
  onPress,
}: {
  card: HeritageCard;
  unlocked: boolean;
  /** Earned since the learner last opened it: the New pill. */
  isNew: boolean;
  /** A locked card's earn hint (how it is earned, never how far along); null when unlocked. */
  hint: string | null;
  /** `flexBasis: '47%'` in the phone gallery, `flex: 1` in a row of the 3-column gallery. */
  cellStyle: ViewStyle;
  artSize: number;
  /** A 128-wide master-pane cell: the Korean line steps down one size so a four-syllable word stays on one line. */
  narrow: boolean;
  /** Two panes only: the card shown in the detail pane (focus border, `aria-selected`). */
  selected?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const textScale = useTypeScale();
  const card = localizeCard(source, useLocale());
  const messages = useMessages();
  const m = messages.learner.library;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      aria-selected={selected}
      accessibilityLabel={unlocked ? (isNew ? messages.a11y.newCard(card.titleEn) : card.titleEn) : messages.a11y.lockedCardHint(hint ?? '')}
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
        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, gap: spacing.xs }}>
          <Icon name="lock" size={32} color={colors.text.muted} />
          {/* The earn hint, at most two lines; the full text is in the label and on the card page. */}
          <Text {...KOREAN_LINE_BREAK}
            numberOfLines={2}
            style={{
              fontSize: textScale.size.caption,
              lineHeight: textScale.size.caption * typography.leading.normal,
              fontWeight: typography.weight.medium,
              color: colors.text.muted,
              textAlign: 'center',
            }}
          >
            {hint}
          </Text>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing.xxs }}>
            <Pill tone={card.rarity === 'legendary' ? 'nudge' : card.rarity === 'rare' ? 'info' : card.rarity === 'uncommon' ? 'success' : 'neutral'} label={m.rarity[card.rarity]} size="sm" />
            {isNew ? <Pill tone="info" label={m.new.pill} size="sm" /> : null}
          </View>
          <Spacer size="xs" />
          <View style={{ alignItems: 'center' }}>
            <CardArt card={card} size={artSize} accessibilityLabel={messages.a11y.cardArt(card.titleEn)} style={{ borderRadius: radii.md }} />
          </View>
          <Spacer size="xs" />
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: narrow ? textScale.size.prompt : textScale.size.title, fontWeight: '700', color: colors.text.primary }}>
            {card.subtitleKo ?? card.titleEn}
          </Text>
          {card.romanization ? (
            <Caption tone="muted" style={{ fontStyle: 'italic' }}>
              {card.romanization}
            </Caption>
          ) : null}
          {cardTitleIsKo(card) ? null : <Caption tone="secondary">{card.titleEn}</Caption>}
        </>
      )}
    </Pressable>
  );
}
