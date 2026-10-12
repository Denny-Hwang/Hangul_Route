import {
  Body,
  Button,
  Card,
  Icon,
  KoreanText,
  Pill,
  Screen,
  borderWidth,
  colors,
  radii,
  spacing,
  supportedCardIds,
  touchTarget,
} from '@hangul-route/design-system';
import type { RomanizationMode } from '@hangul-route/i18n';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { CardArt } from '../../components/CardArt';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { cardById, themeByKey } from '../../content';
import { storiesAll } from '../../content/stories';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeCard, localizeStory, localizeTheme } from '../../logic/content-locale';
import { foundNotes, type FoundNote } from '../../logic/story/culture-notes';
import {
  CULTURE_NOTES_AUDIO_SOURCE,
  cultureNotesScreenView,
  noteCardArtId,
  noteTermChip,
  noteTermSpeech,
  noteViewedPayload,
} from '../../logic/story/culture-notes-view';
import { shelfCopy } from '../../logic/story/shelf-copy';
import { defaultStoryIndex } from '../../logic/story/story-index';
import type { RootStackParamList } from '../../navigation/types';
import { playPrompt, stop } from '../../platform/audio';
import { track } from '../../platform/telemetry';
import { useLocaleStore } from '../../store/locale-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { SpeakerButton } from './ReaderParts';
import { Disclosure, SourcesHeading } from './SourcesParts';

type Props = NativeStackScreenProps<RootStackParamList, 'CultureNotes'>;

/** Card art beside a note (the `HeritageCardArt` size of the episode page). */
const CARD_SIZE = touchTarget.hero;
const drawable = (cardId: string): boolean => supportedCardIds.includes(cardId) && cardById(cardId) !== undefined;

/**
 * Culture notes — `CultureNotes { storyId?, noteId? }` (F-STORY-004 §3.5;
 * wireframe design/wireframes/story/culture-notes.md D, brief
 * design/brief/screens/24-culture-notes.md). Every note the learner has found
 * (a note is found when a quest of its story is finished, so it follows them
 * through sync), under the five theme headings. Notes not found are neither
 * listed nor counted. Each card: title, body, the term with a speaker, the
 * story it came from (its episode page), the card art when the note names a
 * card, and a collapsed "Where this comes from" with the sources as plain text
 * (no links: the learner surface never leaves the app). `storyId` shows only
 * that story's notes; `noteId` scrolls to that note, opens its sources and
 * sends `culture.note.viewed`, as opening a note's sources does.
 */
export function CultureNotesScreen({ route, navigation }: Props): React.ReactElement {
  const storyId = route.params?.storyId;
  const noteId = route.params?.noteId;
  const messages = useMessages();
  const copy = shelfCopy(messages);
  const c = copy.cultureNotes;
  const locale = useLocale();
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const romanizationMode = useLocaleStore((s) => (profile ? (s.byProfile[profile.id]?.romanizationMode ?? 'always') : 'always'));

  // Note text in the UI language (F-CNT-002 overlay); the taught term never changes.
  const stories = useMemo(() => storiesAll.map((s) => localizeStory(s, locale)), [locale]);
  const notes = useMemo(() => foundNotes(defaultStoryIndex(), stories, snap), [stories, snap]);
  const view = useMemo(() => cultureNotesScreenView({ notes, storyId, noteId }), [notes, storyId, noteId]);

  const [open, setOpen] = useState<ReadonlySet<string>>(() => (view.targetNoteId ? new Set([view.targetNoteId]) : new Set()));
  const viewed = useCallback(
    (n: FoundNote): void => {
      void track({ name: 'culture.note.viewed', profileId: profile?.id, payload: noteViewedPayload(n) });
    },
    [profile?.id],
  );
  // A deep link to a note counts as viewing it, once per arrival.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !view.targetNoteId) return;
    const target = notes.find((n) => n.note.id === view.targetNoteId);
    if (!target) return;
    deepLinked.current = true;
    viewed(target);
  }, [view.targetNoteId, notes, viewed]);

  const toggle = (n: FoundNote): void => {
    const id = n.note.id;
    if (!open.has(id)) viewed(n);
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // The term speakers (the card-detail pattern: the term is printed, so the panel only explains a silence).
  const slot = usePromptSlot({ source: CULTURE_NOTES_AUDIO_SOURCE, textOnScreen: true });
  useEffect(() => () => stop(), []);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const hear = (n: FoundNote): void => {
    void slot.play(() => playPrompt(noteTermSpeech(n)));
    // Hearing the term shows how to say it (hide-until-tap, D2).
    setRevealed((r) => (r.has(n.note.id) ? r : new Set([...r, n.note.id])));
  };

  // Scrolling to a deep-linked note: group offsets in the scroll content, note offsets in their group.
  const scrollRef = useRef<ScrollView | null>(null);
  const groupY = useRef<Record<string, number>>({});
  const noteY = useRef<Record<string, { group: string; y: number }>>({});
  const scrolled = useRef(false);
  const tryScroll = (): void => {
    if (scrolled.current || !view.targetNoteId) return;
    const at = noteY.current[view.targetNoteId];
    const top = at === undefined ? undefined : groupY.current[at.group];
    if (at === undefined || top === undefined) return;
    scrolled.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, top + at.y - spacing.md), animated: false });
  };
  const onGroupLayout = (group: string) => (e: LayoutChangeEvent) => {
    groupY.current[group] = e.nativeEvent.layout.y;
    tryScroll();
  };
  const onNoteLayout = (group: string, id: string) => (e: LayoutChangeEvent) => {
    noteY.current[id] = { group, y: e.nativeEvent.layout.y };
    tryScroll();
  };

  const back = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'Library', params: { section: 'culture' } });
  };

  return (
    <Screen tone="canvas" scrollable={false} testID="culture-notes">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget.min }}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel={messages.a11y.goBack}
          testID="culture-notes-back"
          style={({ pressed }) => ({
            width: touchTarget.min,
            height: touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.pill,
            backgroundColor: pressed ? colors.surface.sunken : 'transparent',
          })}
        >
          <Icon name="arrow-left" size={spacing.xxl} color={colors.text.secondary} />
        </Pressable>
        <View style={{ flexShrink: 1 }}>
          <SourcesHeading level={1} testID="culture-notes-title">
            {c.title}
          </SourcesHeading>
        </View>
      </View>
      {/* A count of what was found, never a fraction; under the title so a long title never pushes it off. */}
      {view.count > 0 ? (
        <View style={{ alignSelf: 'flex-start', marginLeft: touchTarget.min + spacing.sm, marginBottom: spacing.sm }}>
          <Pill tone="neutral" size="sm" label={c.found.pill(view.count)} testID="culture-notes-count" />
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
        testID="culture-notes-scroll"
      >
        {view.count === 0 ? (
          <Card padding="md" tone="paper" testID="culture-notes-empty">
            <Body>{c.empty.line}</Body>
            <View style={{ height: spacing.lg }} />
            <Button
              label={c.empty.toStoryTime.cta}
              tone="primary"
              size="lg"
              fullWidth
              onPress={() => navigation.navigate('Main', { screen: 'Library', params: { section: 'story-time' } })}
              testID="culture-notes-to-story-time"
            />
          </Card>
        ) : (
          view.groups.map((group) => {
            const themeDef = themeByKey(group.theme);
            const themeTitle = themeDef ? localizeTheme(themeDef, locale).titleEn : group.theme;
            return (
              <View key={group.theme} onLayout={onGroupLayout(group.theme)} style={{ gap: spacing.md }} testID={`culture-notes-group-${group.theme}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  {/* The accent only decorates: the heading words are the cue. */}
                  <View style={{ width: spacing.xs, alignSelf: 'stretch', borderRadius: radii.pill, backgroundColor: colors.theme[group.theme] }} />
                  <SourcesHeading level={2}>{themeTitle}</SourcesHeading>
                </View>
                <View role="list" aria-label={c.listLabel(themeTitle)} style={{ gap: spacing.md }}>
                  {group.notes.map((n) => (
                    <View key={n.note.id} role="listitem" onLayout={onNoteLayout(group.theme, n.note.id)}>
                      <NoteCard
                        note={n}
                        open={open.has(n.note.id)}
                        highlighted={n.note.id === view.targetNoteId}
                        romanizationMode={romanizationMode}
                        revealed={revealed}
                        onToggle={() => toggle(n)}
                        onHear={() => hear(n)}
                        onOpenStory={() => navigation.navigate('EpisodeDetail', { episodeId: n.episodeId })}
                      />
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function NoteCard({
  note: n,
  open,
  highlighted,
  romanizationMode,
  revealed,
  onToggle,
  onHear,
  onOpenStory,
}: {
  note: FoundNote;
  open: boolean;
  highlighted: boolean;
  romanizationMode: RomanizationMode;
  revealed: ReadonlySet<string>;
  onToggle: () => void;
  onHear: () => void;
  onOpenStory: () => void;
}): React.ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  const c = shelfCopy(messages).cultureNotes;
  const id = n.note.id;
  const chip = noteTermChip(n, { romanizationMode, revealed }, shelfCopy(messages), messages.a11y.koreanItem);
  const cardId = noteCardArtId(n, drawable);
  const card = cardId ? cardById(cardId) : undefined;
  const cardTitle = card ? localizeCard(card, locale).titleEn : '';
  return (
    <View
      testID={`culture-note-${id}`}
      style={{
        padding: spacing.lg,
        gap: spacing.md,
        backgroundColor: colors.surface.paper,
        borderRadius: radii.lg,
        borderWidth: highlighted ? borderWidth.thick : borderWidth.thin,
        borderColor: highlighted ? colors.border.focus : colors.border.subtle,
      }}
    >
      <SourcesHeading level={3}>{n.note.titleEn}</SourcesHeading>
      <Body>{n.note.bodyEn}</Body>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md }}>
        <View style={{ flexShrink: 1 }}>
          <KoreanText ko={chip.ko} romanization={chip.romanization} gloss={chip.gloss} size="sm" accessibilityLabel={chip.accessibilityLabel} />
        </View>
        <SpeakerButton label={chip.hearLabel} onPress={onHear} testID={`culture-note-hear-${id}`} />
      </View>
      {card ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <CardArt card={card} size={CARD_SIZE} accessibilityLabel={messages.a11y.cardArt(cardTitle)} style={{ borderRadius: radii.sm }} />
          <Body size="sm" weight="semibold" style={{ flexShrink: 1 }}>
            {cardTitle}
          </Body>
        </View>
      ) : null}
      <Pressable
        onPress={onOpenStory}
        accessibilityRole="button"
        testID={`culture-note-story-${id}`}
        style={({ pressed }) => ({
          minHeight: touchTarget.min,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          paddingHorizontal: spacing.md,
          borderRadius: radii.md,
          backgroundColor: pressed ? colors.surface.sunken : colors.surface.canvas,
        })}
      >
        <Body weight="semibold" style={{ flexShrink: 1 }}>
          {c.fromStory(n.storyTitle.en)}
        </Body>
        <Icon name="arrow-right" size={spacing.xl} color={colors.text.secondary} />
      </Pressable>
      <Disclosure label={c.whereFrom} open={open} onToggle={onToggle} testID={`culture-note-sources-${id}`}>
        <View
          style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.sunken }}
          testID={`culture-note-source-list-${id}`}
        >
          {n.sources.map((s) => (
            <Body key={`${s.title}\u0000${s.publisher}`} size="sm" tone="secondary">
              {c.source(s.title, s.publisher)}
            </Body>
          ))}
        </View>
      </Disclosure>
    </View>
  );
}
