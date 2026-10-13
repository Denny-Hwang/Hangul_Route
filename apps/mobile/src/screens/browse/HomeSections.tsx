import { localize, type HeritageCard, type StageKey, type ThemeKey } from '@hangul-route/content-schema';
import {
  Body,
  Caption,
  Heading,
  Icon,
  Pill,
  Spacer,
  borderWidth,
  colors,
  layout,
  radii,
  spacing,
  touchTarget,
  typography,
  useLayoutClass,
} from '@hangul-route/design-system';
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { CardArt } from '../../components/CardArt';
import { JourneyGrid } from '../../components/JourneyGrid';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { browseLibrary, browseRouteTrail, stageOneLiners, type BrowseLibraryGroup, type BrowseSection } from '../../logic/browse/catalogue';
import { accessOf, browseGridAccess, browseGridEpisodes, itemViewedEvent, sectionAfter } from '../../logic/browse/home-view';
import { localizeCard, localizeStage, localizeStory, localizeTheme } from '../../logic/content-locale';
import { themeColumnLabel } from '../../logic/journey';
import { sectionTitle, shelfCopy } from '../../logic/story/shelf-copy';
import type { StoryIndexEntry } from '../../logic/story/story-index';
import { storyTileView } from '../../logic/story/story-tile';
import { LaterRowItem, StageRowItem } from '../my-route/TrailRow';
import { StoryTile } from '../library/StoryTile';
import { EpisodeOutlineView } from './EpisodeOutlineView';
import { focusRing, useItemViewed, WordChip, type FocusState } from './browse-ui';
import { useBrowseSession } from './browse-session';
import { BROWSE_GALLERY_FACE, BROWSE_SECTION_TRACK_MAX, BROWSE_TEXT_SCALE_CAP } from '../../logic/browse/layout';

/**
 * The sections of the All lessons home (F-BROWSE-001 section 4.5; mock
 * `design/screens/browse/home.md`): the one-row section control, then the
 * learner's own Learning Route trail, Journey grid and Library groups in the
 * browse state: nothing done, no stars, no Next, no "In your plan"; closed
 * marks only for a sampler pass with the switch on, drawn by the learner
 * visuals themselves (the dotted ring, never a lock glyph on the grid).
 */

const SEGMENT_FONT_CAP = BROWSE_TEXT_SCALE_CAP;
const TRACK_MAX = BROWSE_SECTION_TRACK_MAX;
const GALLERY_FACE = BROWSE_GALLERY_FACE;

export interface OpenTargets {
  openEpisode: (episodeId: string) => void;
  openItem: (item: { kind: 'quest' | 'story' | 'vocab-topic'; id: string }) => void;
  openCard: (cardId: string) => void;
  showStage: (stage: StageKey) => void;
}

/** One row of Route · Journey · Library: a radiogroup, arrow keys move and select, one Tab stop (section 7). */
export function SectionControl({ sections, value, onChange }: { sections: readonly BrowseSection[]; value: BrowseSection; onChange: (s: BrowseSection) => void }): React.ReactElement {
  const m = useMessages().caregiver.browse.home.section;
  const regular = useLayoutClass().width !== 'compact';
  const refs = useRef(new Map<BrowseSection, View | null>());
  const move = (key: string): void => {
    const next = sectionAfter(sections, value, key);
    if (next === null) return;
    onChange(next);
    refs.current.get(next)?.focus?.();
  };
  return (
    <View
      role="radiogroup"
      aria-label={m.label}
      testID="browse-sections"
      style={{
        flexDirection: 'row',
        gap: spacing.xxs,
        padding: spacing.xxs,
        borderRadius: radii.pill,
        backgroundColor: colors.surface.sunken,
        borderWidth: borderWidth.thin,
        borderColor: colors.border.subtle,
        width: '100%',
        maxWidth: regular ? TRACK_MAX : undefined,
      }}
    >
      {sections.map((section) => {
        const selected = section === value;
        return (
          <Pressable
            key={section}
            ref={(el) => {
              refs.current.set(section, el);
            }}
            role="radio"
            aria-checked={selected}
            accessibilityState={{ checked: selected }}
            tabIndex={selected ? 0 : -1}
            onPress={() => onChange(section)}
            {...{ onKeyDown: (e: { key: string; preventDefault?: () => void }) => {
              if (sectionAfter(sections, value, e.key) !== null) e.preventDefault?.();
              move(e.key);
            } }}
            testID={`browse-section-${section}`}
            style={({ focused }: FocusState) => ({
              flex: 1,
              minHeight: touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.xs,
              borderRadius: radii.pill,
              backgroundColor: selected ? colors.brand.primary : 'transparent',
              ...focusRing(focused),
            })}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={SEGMENT_FONT_CAP}
              style={{
                fontSize: typography.size.body,
                fontWeight: selected ? typography.weight.bold : typography.weight.semibold,
                color: selected ? colors.text.onPrimary : colors.text.primary,
              }}
            >
              {m[section]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Route: the learner trail's own rows in the no-progress state; a stage row shows that stage on the Journey. */
export function RouteSection({ open }: { open: OpenTargets }): React.ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  const { bundle } = useBrowseSession();
  const rows = useMemo(() => browseRouteTrail({ bundle, messages, locale }), [bundle, messages, locale]);
  return (
    <View testID="browse-route">
      {rows.map((row) =>
        row.kind === 'stage' ? (
          <StageRowItem
            key={row.key}
            row={{ ...row, a11yLabel: messages.caregiver.browse.home.routeRowA11y(row.a11yLabel) }}
            open={false}
            look="pips"
            reducedMotion
            expandable={false}
            onToggle={() => open.showStage(row.stage)}
            onOpenEpisode={open.openEpisode}
          />
        ) : (
          <LaterRowItem key={row.key} row={row} open={false} onToggle={() => undefined} expandable={false} />
        ),
      )}
    </View>
  );
}

/** Journey: the learner grid (two panes from the wide class), with the stage line when the Route section is absent. */
export function JourneySection({ open, withStageLine }: { open: OpenTargets; withStageLine: boolean }): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.browse.home;
  const locale = useLocale();
  const { bundle, pass, gatingEnabled } = useBrowseSession();
  const paneMode = useLayoutClass().panes === 2;
  const [expanded, setExpanded] = useState(false);
  const access = useMemo(() => ({ bundle, scope: pass?.scope ?? 'sampler', gatingEnabled }), [bundle, pass, gatingEnabled]);
  const gridEpisodes = useMemo(() => browseGridEpisodes(access), [access]);
  const firstOpen = gridEpisodes.find((e) => accessOf({ kind: 'episode', id: e.id }, access) !== 'later')?.id ?? null;
  const [selected, setSelected] = useState<string | null>(null);
  const selectedId = selected ?? firstOpen;
  // A cell a person picks in the detail pane is an opened outline (section 9), as BrowseEpisode counts it on
  // phones; the first open cell the pane shows by itself is not counted.
  useItemViewed(paneMode && selected !== null && pass ? itemViewedEvent('episode', selected, accessOf({ kind: 'episode', id: selected }, access)) : null);
  const stages = useMemo(() => bundle.stages.map((s) => localizeStage(s, locale)), [bundle, locale]);
  const themes = useMemo(() => bundle.themes.map((t) => localizeTheme(t, locale)), [bundle, locale]);

  const stageLine = withStageLine ? (
    <View style={{ marginBottom: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.paper, borderWidth: borderWidth.thin, borderColor: colors.border.subtle }}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        aria-expanded={expanded}
        accessibilityState={{ expanded }}
        testID="browse-stage-line"
        style={({ focused }: FocusState) => ({
          minHeight: touchTarget.min,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radii.md,
          ...focusRing(focused),
        })}
      >
        <View style={{ flex: 1 }}>
          <Body weight="semibold">{m.stages.line(bundle.stages.length)}</Body>
        </View>
        <Icon name="arrow-right" size={spacing.xl} color={colors.text.secondary} />
      </Pressable>
      {expanded ? (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm }}>
          {stageOneLiners(bundle, locale).map((s) => (
            <View key={s.stage}>
              <Body weight="semibold">{m.stages.item(s.order, s.title)}</Body>
              <Body tone="secondary">{s.oneLiner}</Body>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  ) : null;

  const grid = (
    <JourneyGrid
      stages={stages}
      themes={themes}
      gridEpisodes={gridEpisodes}
      paneMode={paneMode}
      selectedId={paneMode ? selectedId : null}
      onOpen={(episodeId) => (paneMode ? setSelected(episodeId) : open.openEpisode(episodeId))}
      storyEntries={bundle.storyIndex}
      access={browseGridAccess(access)}
    />
  );

  if (!paneMode) {
    return (
      <View testID="browse-journey">
        {stageLine}
        {grid}
      </View>
    );
  }
  return (
    <View testID="browse-journey" style={{ flexDirection: 'row', gap: layout.pane.gap, alignItems: 'flex-start' }}>
      <View style={{ width: layout.pane.master }}>
        {stageLine}
        {grid}
      </View>
      <View style={{ flex: 1 }} role="region" aria-label={messages.learner.journey.panes.detail}>
        {selectedId ? <EpisodeOutlineView episodeId={selectedId} asPane onOpenItem={open.openItem} onOpenCard={open.openCard} /> : null}
      </View>
    </View>
  );
}

/** Library: the learner Library's groups in its order (Cards, Story Time, Culture, Words); a group with nothing is left out. */
export function LibrarySection({ open }: { open: OpenTargets }): React.ReactElement {
  const { bundle } = useBrowseSession();
  const groups = useMemo(() => browseLibrary(bundle), [bundle]);
  return (
    <View testID="browse-library" style={{ gap: spacing.xl }}>
      {groups.map((group) => (
        <LibraryGroup key={group.section} group={group} open={open} />
      ))}
    </View>
  );
}

function LibraryGroup({ group, open }: { group: BrowseLibraryGroup; open: OpenTargets }): React.ReactElement {
  const messages = useMessages();
  const copy = shelfCopy(messages);
  switch (group.section) {
    case 'cards':
      return <CardsGroup cards={group.cards} title={sectionTitle('cards', copy)} open={open} />;
    case 'story-time':
    case 'culture':
      return (
        <View>
          <Heading level="prompt">{sectionTitle(group.section, copy)}</Heading>
          <Spacer size="sm" />
          <StoryTiles entries={group.entries} open={open} />
        </View>
      );
    case 'words':
      return (
        <View>
          <Heading level="prompt">{sectionTitle('theme-packs', copy)}</Heading>
          <Spacer size="sm" />
          <View style={{ gap: spacing.sm }}>
            {group.rows.map((row) => (
              <WordsRow key={row.topic.id} row={row} onPress={() => open.openItem({ kind: 'vocab-topic', id: row.topic.id })} />
            ))}
          </View>
        </View>
      );
  }
}

function CardsGroup({ cards, title, open }: { cards: readonly HeritageCard[]; title: string; open: OpenTargets }): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.browse.home;
  const locale = useLocale();
  const { bundle } = useBrowseSession();
  const columns = useLayoutClass().cardColumns;
  const [filter, setFilter] = useState<ThemeKey | 'all'>('all');
  const shown = filter === 'all' ? cards : cards.filter((c) => c.theme === filter);
  const filters: { key: ThemeKey | 'all'; label: string }[] = [
    { key: 'all', label: messages.learner.library.filterAll },
    ...bundle.themes.map((t) => ({ key: t.key, label: themeColumnLabel(localizeTheme(t, locale)) })),
  ];
  return (
    <View>
      <Heading level="prompt">{title}</Heading>
      <Spacer size="sm" />
      <View role="group" aria-label={m.themes} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              aria-pressed={active}
              testID={`browse-theme-${f.key}`}
              style={({ focused }: FocusState) => ({
                minHeight: touchTarget.min,
                minWidth: touchTarget.min,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: spacing.lg,
                borderRadius: radii.pill,
                backgroundColor: active ? colors.brand.primary : colors.surface.paper,
                ...focusRing(focused, active ? colors.brand.primary : colors.border.subtle),
              })}
            >
              <Text style={{ fontSize: typography.size.bodySm, fontWeight: typography.weight.semibold, color: active ? colors.text.onPrimary : colors.text.primary }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Spacer size="md" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {shown.map((card) => (
          <CardSlot key={card.id} card={card} basis={columns >= 3 ? '31%' : '47%'} onPress={() => open.openCard(card.id)} />
        ))}
      </View>
    </View>
  );
}

const RARITY_TONE = { legendary: 'nudge', rare: 'info', uncommon: 'success', common: 'neutral' } as const;

/** A Library card slot, face up: the rarity pill, the face, the Korean with romanization and the English title. No earn hint, no New pill. */
function CardSlot({ card: source, basis, onPress }: { card: HeritageCard; basis: '31%' | '47%'; onPress: () => void }): React.ReactElement {
  const messages = useMessages();
  const card = localizeCard(source, useLocale());
  const rarity = messages.learner.library.rarity[card.rarity];
  const [face, setFace] = useState(GALLERY_FACE);
  const onLayout = (e: LayoutChangeEvent): void => {
    const inner = e.nativeEvent.layout.width - 2 * spacing.md - 2 * borderWidth.thick;
    setFace((prev) => (Math.min(GALLERY_FACE, Math.max(0, Math.floor(inner))) === prev ? prev : Math.min(GALLERY_FACE, Math.max(0, Math.floor(inner)))));
  };
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel={messages.caregiver.browse.home.cardSlotA11y(rarity, card.titleEn, card.subtitleKo ?? '', card.romanization ?? '')}
      testID={`browse-card-${card.id}`}
      style={({ focused }: FocusState) => ({
        flexBasis: basis,
        flexGrow: 1,
        padding: spacing.md,
        borderRadius: radii.lg,
        backgroundColor: colors.surface.paper,
        borderWidth: borderWidth.thick,
        borderColor: focused ? colors.border.focus : colors.rarity[card.rarity],
        gap: spacing.xs,
      })}
    >
      <View style={{ flexDirection: 'row' }}>
        <Pill tone={RARITY_TONE[card.rarity]} label={rarity} size="sm" />
      </View>
      <View style={{ alignItems: 'center' }}>{face > 0 ? <CardArt card={card} size={face} style={{ borderRadius: radii.md }} /> : null}</View>
      {card.subtitleKo ? (
        <Text {...{ lang: 'ko' }} style={{ fontSize: typography.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {card.subtitleKo}
        </Text>
      ) : null}
      {card.romanization ? (
        <Caption tone="muted" style={{ fontStyle: 'italic' }}>
          {card.romanization}
        </Caption>
      ) : null}
      <Body size="sm" tone="secondary">
        {card.titleEn}
      </Body>
    </Pressable>
  );
}

/** Story Time and Culture: the learner `StoryTile` with no learner state (no state line, no stars), closed tiles as the learner draws them. */
function StoryTiles({ entries, open }: { entries: readonly StoryIndexEntry[]; open: OpenTargets }): React.ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  const copy = shelfCopy(messages);
  const romanization = useRomanizationMode();
  const { bundle, pass, gatingEnabled } = useBrowseSession();
  const [width, setWidth] = useState(0);
  const columns = useLayoutClass().cardColumns >= 3 ? 3 : 2;
  const tileWidth = width > 0 ? Math.floor((width - (columns - 1) * spacing.sm) / columns) : 0;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {tileWidth > 0
        ? entries.map((entry) => {
            const closed = accessOf({ kind: 'story', id: entry.storyId }, { bundle, scope: pass?.scope ?? 'sampler', gatingEnabled }) === 'closed';
            const view = storyTileView({ entry: { ...entry, story: localizeStory(entry.story, locale) }, status: { state: 'new', stars: 0 }, locked: closed, copy, catalogueLabel: messages.caregiver.browse.home.storyTileA11y });
            return (
              <StoryTile
                key={entry.storyId}
                view={view}
                width={tileWidth}
                romanizationShown={romanization === 'always'}
                onPress={() => open.openItem({ kind: 'story', id: entry.storyId })}
                testID={`browse-story-${entry.storyId}`}
              />
            );
          })
        : null}
    </View>
  );
}

/** One Words row: the topic title, its word count and its first three words; one button to the topic page. */
function WordsRow({ row, onPress }: { row: Extract<BrowseLibraryGroup, { section: 'words' }>['rows'][number]; onPress: () => void }): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.browse.home;
  const locale = useLocale();
  const title = localize(row.topic, row.topic.id, locale).titleEn;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={m.wordsRowA11y(title, row.count)}
      testID={`browse-words-${row.topic.key}`}
      style={({ focused }: FocusState) => ({
        minHeight: touchTarget.min,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radii.lg,
        backgroundColor: colors.surface.paper,
        ...focusRing(focused, colors.border.subtle),
      })}
    >
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.xs }}>
          <Body weight="bold">{title}</Body>
          <Body size="sm" tone="secondary">
            {m.wordCount(row.count)}
          </Body>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {row.samples.map((w) => (
            <WordChip key={w.id} ko={w.ko} romanization={w.romanization} gloss={w.glosses[locale] ?? w.glosses.en} />
          ))}
        </View>
      </View>
      <Icon name="arrow-right" size={spacing.xl} color={colors.text.secondary} />
    </Pressable>
  );
}
