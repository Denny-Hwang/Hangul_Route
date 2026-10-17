import type { Episode, StageKey, ThemeKey } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Card,
  Heading,
  HoyaBubble,
  Icon,
  KoreanText,
  Pill,
  Screen,
  Spacer,
  StarRow,
  StoryScene,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  useMediaSize,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CardArt } from '../../components/CardArt';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { cardById, stageByKey, themeByKey } from '../../content';
import { storiesAll } from '../../content/stories';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { localizeCard, localizeStage, localizeStory, localizeTheme } from '../../logic/content-locale';
import { emptyBookmarks } from '../../logic/story/bookmarks';
import { homeCellLink } from '../../logic/story/cell-stories';
import { foundNotes } from '../../logic/story/culture-notes';
import { planOpenStory, type OpenStoryPlan } from '../../logic/story/open-story';
import { shelfCopy } from '../../logic/story/shelf-copy';
import {
  STORY_EPISODE_AUDIO_SOURCE,
  episodeRewardCards,
  episodeTitleKorean,
  episodeWordChip,
  episodeWordSpeech,
  storyEpisodeView,
  type EpisodeRewardCard,
  type EpisodeTitleKorean,
  type TaleRowAction,
  type TaleRowView,
} from '../../logic/story/story-episode';
import { defaultStoryIndex, type StoryIndexEntry } from '../../logic/story/story-index';
import { storyCoverVariant } from '../../logic/story/story-tile';
import { playPrompt, stop } from '../../platform/audio';
import { track } from '../../platform/telemetry';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useStoryStore } from '../../store/story-store';
import { CellLinkRow } from '../story/CellLinkRow';
import { SpeakerButton } from '../story/ReaderParts';
import { CoverFallback } from '../library/StoryTile';

const NO_BOOKMARKS = emptyBookmarks();
/** Earned card art and the silhouette share one size (spec §3.6: `HeritageCardArt` 96). */
const CARD_SIZE = touchTarget.hero;
/** The tale row cover; it grows with the window's media scale (F-LAYOUT-001). */
const THUMB_BASE = touchTarget.hero;

/** Where a story action goes: the scored quest (optionally resumed) or the unscored replay reader. */
export type StoryTarget = Pick<Extract<OpenStoryPlan, { route: 'QuestPlayer' }>, 'route' | 'params'> | Pick<Extract<OpenStoryPlan, { route: 'StoryReader' }>, 'route' | 'params'>;

export interface StoryEpisodeNavigation {
  onOpenStory: (target: StoryTarget) => void;
  onOpenCard: (cardId: string) => void;
  /** Sources of the page's one story (`StorySources { storyId, from: 'episode' }`). */
  onOpenSources: (storyId: string) => void;
  /** "Culture notes: N found" opens `CultureNotes { storyId }` (§3.6). */
  onOpenCultureNotes: (storyId: string) => void;
  /** A shelf story's home-cell pill opens its cell page (F-STORY-005 §3.6); informational, never a lock. */
  onOpenCellStories: (stage: StageKey, theme: ThemeKey) => void;
  /** A book page's "Heritage stories for this cell" row opens the book's cell page (F-STORY-005 PR 5.6). */
  onOpenCellStoriesRow: () => void;
}

interface Props extends StoryEpisodeNavigation {
  /** Localised by the host. */
  episode: Episode;
  /** `storyEpisodeEntries(episode, index)`: one per quest, in the episode's quest order. */
  entries: readonly StoryIndexEntry[];
  /**
   * `lessonRowCount(episode, index)`: the shelf stories whose home is this grid page's cell. A book page
   * draws the row when it is above 0 (wireframe episode/detail-cell-stories-row D); a shelf page has 0.
   */
  cellStoryCount: number;
}

/**
 * The story variant of the episode page (F-STORY-004 §3.6; wireframe
 * design/wireframes/episode/detail-story.md E, brief
 * design/brief/screens/25-story-episode-detail.md). `EpisodeDetailView`
 * renders it for a story episode that is not a preview. What is shown and
 * which button is the one large one is `storyEpisodeView`; every action runs
 * through `planOpenStory`, so the page reports `story.opened` like every
 * other surface. Start over clears the bookmark first. A Stage 5 book page
 * also has the cell's "Heritage stories for this cell" row after its tale
 * rows (F-STORY-005 PR 5.6; wireframe
 * design/wireframes/episode/detail-cell-stories-row.md D).
 */
export function StoryEpisodeDetail({
  episode,
  entries: sourceEntries,
  onOpenStory,
  onOpenCard,
  onOpenSources,
  onOpenCultureNotes,
  onOpenCellStories,
  cellStoryCount,
  onOpenCellStoriesRow,
}: Props): React.ReactElement {
  const messages = useMessages();
  const copy = shelfCopy(messages);
  const locale = useLocale();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const bookmarks = useStoryStore((s) => (profile ? s.byProfile[profile.id] : undefined)) ?? NO_BOOKMARKS;
  const romanizationMode = useRomanizationMode();
  const thumb = useMediaSize(THUMB_BASE);

  // Story text in the UI language (F-CNT-002 overlay); taught Korean never changes.
  const entries = useMemo(
    () => sourceEntries.map((e) => ({ ...e, story: localizeStory(e.story, locale) })),
    [sourceEntries, locale],
  );
  const notes = useMemo(() => foundNotes(defaultStoryIndex(), storiesAll, snap), [snap]);
  const stageDef = stageByKey(episode.stage);
  const themeDef = themeByKey(episode.theme);
  const view = useMemo(
    () =>
      storyEpisodeView({
        episode,
        entries,
        snapshot: snap,
        bookmarks,
        notes,
        copy,
        stageTitle: stageDef ? localizeStage(stageDef, locale).titleEn : '',
        themeTitle: themeDef ? localizeTheme(themeDef, locale).titleEn : '',
      }),
    [episode, entries, snap, bookmarks, notes, copy, stageDef, themeDef, locale],
  );

  const unlocked = useMemo(() => new Set((snap?.cards ?? []).map((c) => c.cardId)), [snap]);
  const cards = useMemo(() => episodeRewardCards(episode.rewardCardIds, unlocked, cardById), [episode.rewardCardIds, unlocked]);

  // The words' speakers: the card-detail pattern (the word is printed, so the panel only explains a silence).
  const slot = usePromptSlot({ source: STORY_EPISODE_AUDIO_SOURCE, textOnScreen: true });
  useEffect(() => () => stop(), []);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const hear = useCallback(
    (wordId: string): void => {
      const word = view.words.find((w) => w.id === wordId);
      if (!word) return;
      void slot.play(() => playPrompt(episodeWordSpeech(word)));
      // Hearing a word shows how to say it (hide-until-tap, D2), as in the reader.
      setRevealed((r) => (r.has(wordId) ? r : new Set([...r, wordId])));
    },
    [view.words, slot],
  );
  // D2: a Korean title hidden until tapped plays the title and shows how to say it, like a word chip.
  const titleKorean = (storyId: string, ko: string): EpisodeTitleKorean => episodeTitleKorean(storyId, ko, { romanizationMode, revealed });
  const hearTitle = (title: EpisodeTitleKorean): void => {
    void slot.play(() => playPrompt(title.speech));
    setRevealed((r) => (r.has(title.key) ? r : new Set([...r, title.key])));
  };
  const pageTitle = view.storyId && view.title.ko ? titleKorean(view.storyId, view.title.ko) : null;

  const runAction = (row: TaleRowView, action: TaleRowAction): void => {
    const plan = planOpenStory({ entry: row.entry, status: row.status, source: 'episode', mode: action.mode });
    if (plan.clearBookmark && profile) useStoryStore.getState().clearBookmark(profile.id, row.entry.storyId);
    void track({ name: plan.event.name, profileId: profile?.id, payload: { ...plan.event.payload } });
    onOpenStory(plan.route === 'StoryReader' ? { route: plan.route, params: plan.params } : { route: plan.route, params: plan.params });
  };

  const notesStoryId = view.storyId;
  // The story's home cell on the map (F-STORY-005 §3.6 "Library link-back"); none on a book page.
  const home = homeCellLink(sourceEntries);
  const homeStage = home ? stageByKey(home.stage) : undefined;
  const homeTheme = home ? themeByKey(home.theme) : undefined;

  return (
    <Screen tone="canvas" scrollable>
      <View testID="story-episode">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} testID="story-episode-pills">
          <Pill tone="primary" label={view.pills[0]} size="sm" />
          <Pill tone="secondary" label={view.pills[1]} size="sm" />
          <Pill tone="neutral" label={view.pills[2]} size="sm" />
        </View>
        {home && homeStage && homeTheme ? (
          <Pressable
            onPress={() => onOpenCellStories(home.stage, home.theme)}
            accessibilityRole="button"
            accessibilityLabel={messages.learner.journey.cellStories.homePillLabel(
              homeStage.order,
              localizeStage(homeStage, locale).titleEn,
              localizeTheme(homeTheme, locale).titleEn,
            )}
            testID="story-episode-home-cell"
            style={{ alignSelf: 'flex-start', minHeight: touchTarget.min, justifyContent: 'center' }}
          >
            <Pill tone="neutral" label={messages.learner.journey.cellStories.homePill(homeStage.order, localizeTheme(homeTheme, locale).titleEn)} size="sm" />
          </Pressable>
        ) : null}

        <Spacer size="md" />
        <Heading level="display" testID="story-episode-title">
          {view.title.en}
        </Heading>
        {view.title.ko && pageTitle ? (
          <>
            <Spacer size="xs" />
            <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
              <KoreanText
                ko={view.title.ko}
                romanization={view.title.romanization ?? ''}
                romanizationShown={pageTitle.romanizationShown}
                size="sm"
                onPress={pageTitle.tappable ? () => hearTitle(pageTitle) : undefined}
                accessibilityLabel={messages.a11y.koreanItem({ ko: view.title.ko, romanization: view.title.romanization ?? '', gloss: view.title.en })}
                testID="story-episode-title-ko"
              />
            </View>
          </>
        ) : null}

        <Spacer size="lg" />
        <HoyaBubble tone="idle" message={episode.hoyaIntroEn} />

        <Spacer size="lg" />
        <View role="list" style={{ gap: spacing.sm }} testID="story-episode-rows">
          {view.rows.map((row) => (
            <TaleRow
              key={row.entry.questId}
              row={row}
              thumb={thumb}
              titleKo={titleKorean(row.entry.storyId, row.ko)}
              onHearTitle={hearTitle}
              onAction={(action) => runAction(row, action)}
            />
          ))}
        </View>

        {cellStoryCount > 0 ? (
          <>
            <Spacer size="lg" />
            <CellLinkRow
              label={messages.learner.journey.cellStories.row}
              accessibilityLabel={messages.learner.journey.cellStories.rowLabel(cellStoryCount)}
              count={messages.learner.journey.countMark(cellStoryCount, false)}
              icon="library"
              onPress={onOpenCellStoriesRow}
              testID="story-episode-cell-stories-row"
            />
          </>
        ) : null}

        {view.words.length > 0 ? (
          <>
            <Spacer size="xl" />
            <Heading level="prompt">{copy.episode.wordsTitle}</Heading>
            <Spacer size="sm" />
            <View role="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} testID="story-episode-words">
              {view.words.map((word) => {
                const chip = episodeWordChip(word, { romanizationMode, revealed }, copy, messages.a11y.koreanItem);
                return (
                  <View
                    key={chip.id}
                    role="listitem"
                    testID={`story-episode-word-${chip.id}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.sm,
                      maxWidth: '100%',
                      backgroundColor: colors.surface.paper,
                      borderRadius: radii.lg,
                      borderWidth: borderWidth.thin,
                      borderColor: colors.border.subtle,
                    }}
                  >
                    <View style={{ flexShrink: 1 }}>
                      <KoreanText
                        ko={chip.ko}
                        romanization={chip.romanization}
                        gloss={chip.gloss}
                        size="sm"
                        accessibilityLabel={chip.accessibilityLabel}
                      />
                    </View>
                    <SpeakerButton label={chip.hearLabel} onPress={() => hear(chip.id)} testID={`story-episode-hear-${chip.id}`} />
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {view.notesLine && notesStoryId ? (
          <>
            <Spacer size="lg" />
            <Pressable
              onPress={() => onOpenCultureNotes(notesStoryId)}
              accessibilityRole="button"
              accessibilityLabel={view.notesLine}
              testID="story-episode-notes"
              style={({ pressed }) => ({
                minHeight: touchTarget.min,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                backgroundColor: colors.surface.paper,
                borderRadius: radii.lg,
                borderWidth: borderWidth.base,
                borderColor: pressed ? colors.border.focus : colors.border.subtle,
              })}
            >
              <Body weight="semibold" style={{ flexShrink: 1 }}>
                {view.notesLine}
              </Body>
              <Icon name="arrow-right" size={spacing.xl} color={colors.text.secondary} />
            </Pressable>
          </>
        ) : null}

        {cards.length > 0 ? (
          <>
            <Spacer size="xl" />
            <Heading level="prompt">{messages.learner.episode.cards.heading}</Heading>
            <Spacer size="sm" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }} testID="story-episode-cards">
              {cards.map((c) => (
                <RewardCard key={c.cardId} card={c} onOpen={() => onOpenCard(c.cardId)} />
              ))}
            </View>
          </>
        ) : null}

        {view.storyId ? (
          <>
            <Spacer size="xl" />
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                label={copy.episode.sources.cta}
                tone="ghost"
                size="md"
                onPress={() => onOpenSources(view.storyId as string)}
                testID="story-episode-sources"
              />
            </View>
          </>
        ) : null}
        <Spacer size="xxl" />
      </View>
    </Screen>
  );
}

/** One story of the page: cover, titles, the state in words (stars only when earned) and its buttons. */
function TaleRow({
  row,
  thumb,
  titleKo,
  onHearTitle,
  onAction,
}: {
  row: TaleRowView;
  thumb: number;
  titleKo: EpisodeTitleKorean;
  onHearTitle: (title: EpisodeTitleKorean) => void;
  onAction: (action: TaleRowAction) => void;
}): React.ReactElement {
  const messages = useMessages();
  const id = row.entry.storyId;
  return (
    <View role="listitem" testID={`story-episode-row-${id}`}>
      <Card padding="md" tone="paper">
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
          <StoryScene
            art={row.cover}
            theme={row.theme}
            variant={storyCoverVariant(thumb)}
            width={thumb}
            decorative
            fallback={<CoverFallback ko={row.ko} coverWidth={thumb} />}
          />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Body weight="semibold">{row.titleEn}</Body>
            <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
              <KoreanText
                ko={row.ko}
                romanization={row.romanization}
                romanizationShown={titleKo.romanizationShown}
                size="sm"
                onPress={titleKo.tappable ? () => onHearTitle(titleKo) : undefined}
                accessibilityLabel={messages.a11y.koreanItem({ ko: row.ko, romanization: row.romanization, gloss: row.titleEn })}
                testID={`story-episode-row-ko-${id}`}
              />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
              <Body size="sm" weight="semibold" tone="secondary" testID={`story-episode-state-${id}`}>
                {row.stateLine}
              </Body>
              {row.stars > 0 ? <StarRow stars={row.stars} size={spacing.lg} accessibilityLabel={messages.a11y.stars(row.stars)} /> : null}
            </View>
          </View>
        </View>
        <Spacer size="md" />
        {/* Wraps under the titles on a narrow window or at large text; the primary stays the largest. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {row.actions.map((action) => (
            <View key={action.mode} style={{ flexGrow: action.size === 'hero' ? 1 : 0, minWidth: action.size === 'hero' ? '60%' : undefined }}>
              <Button
                label={action.label}
                accessibilityLabel={action.accessibilityLabel}
                tone={action.tone}
                size={action.size}
                fullWidth={action.size === 'hero'}
                onPress={() => onAction(action)}
                testID={`story-episode-${action.mode}-${id}`}
              />
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

/** An earned card (art, title, Korean, romanization; opens Card detail) or a silhouette with the rarity border and nothing else. */
function RewardCard({ card, onOpen }: { card: EpisodeRewardCard; onOpen: () => void }): React.ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  if (!card.earned) {
    return (
      <View
        accessible
        accessibilityLabel={messages.a11y.cardWaiting}
        testID={`story-episode-card-${card.cardId}`}
        style={{
          width: CARD_SIZE,
          height: CARD_SIZE,
          borderRadius: radii.md,
          backgroundColor: colors.surface.sunken,
          borderWidth: borderWidth.thick,
          borderColor: colors.rarity[card.rarity],
        }}
      />
    );
  }
  const c = localizeCard(card.card, locale);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={messages.a11y.episodeCard(c.titleEn)}
      testID={`story-episode-card-${card.cardId}`}
      style={({ pressed }) => ({
        width: CARD_SIZE + 2 * spacing.sm,
        minHeight: touchTarget.min,
        padding: spacing.sm,
        gap: spacing.xs,
        backgroundColor: colors.surface.paper,
        borderRadius: radii.md,
        borderWidth: borderWidth.thin,
        borderColor: pressed ? colors.border.focus : colors.border.subtle,
      })}
    >
      <CardArt card={card.card} size={CARD_SIZE} accessibilityLabel={messages.a11y.cardArt(c.titleEn)} style={{ borderRadius: radii.sm }} />
      <Body size="sm" weight="semibold">
        {c.titleEn}
      </Body>
      {c.subtitleKo ? <KoreanText ko={c.subtitleKo} romanization={c.romanization ?? ''} size="sm" /> : null}
    </Pressable>
  );
}
