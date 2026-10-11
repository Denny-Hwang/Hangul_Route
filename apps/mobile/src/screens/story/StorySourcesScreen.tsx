import { Body, Caption, KoreanText, Pill, Screen, spacing } from '@hangul-route/design-system';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { storyById } from '../../content/stories';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeStory } from '../../logic/content-locale';
import { gateOpensDirectly } from '../../logic/profiles/gate-route';
import { isParentSessionValid } from '../../logic/profiles/session';
import {
  findSourceLink,
  linkOpenedPayload,
  openLinkNote,
  openLinkStep,
  pendingLinkStep,
  sourcesOpenedPayload,
  sourcesTarget,
  type SourceLink,
} from '../../logic/story/source-link';
import { buildSourcesView, type SourceView } from '../../logic/story/sources-view';
import type { RootStackParamList } from '../../navigation/types';
import { HAND_OFF_NEEDS_TAP, openExternalUrl } from '../../platform/external-link';
import { copyText } from '../../platform/pwa';
import { track } from '../../platform/telemetry';
import { useAccountStore } from '../../store/account-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useUiStore } from '../../store/ui-store';
import { CitationText, CorrectionsList, Disclosure, FactCard, SeeFactRow, SourcesHeader, SourcesHeading } from './SourcesParts';

type Props = NativeStackScreenProps<RootStackParamList, 'StorySources'>;

/** Whether a grown-up action skips the PIN screen right now, read fresh from the stores (F-LEARN-001 L7). */
function gateOpenNow(): boolean {
  const openedAt = useUiStore.getState().parentGateOpenedAt;
  return gateOpensDirectly({
    profiles: useProfileStore.getState().profiles,
    parentPinHash: useAccountStore.getState().parentPinHash,
    sessionOpen: isParentSessionValid(openedAt === null ? null : { openedAt, profileId: 'family' }, Date.now()),
  });
}

/**
 * Sources — `StorySources { storyId, factId?, sceneIndex?, from }`
 * (F-STORY-002 §3.8, screen spec design/components/StorySourcesScreen/spec.md):
 * every fact of a story with the citations behind it, the corrections, how it
 * was checked and the note for grown-ups, all built by `buildSourcesView` from
 * the story JSON. Fully offline (text). Copy link needs no gate; Open link is a
 * grown-up action: `PinEntry { next: 'ExternalLink', url }` unless the gate
 * opens directly, and only for an https link the story itself cites.
 */
export function StorySourcesScreen({ route, navigation }: Props): React.ReactElement {
  const { storyId, factId, sceneIndex, from } = route.params;
  const messages = useMessages();
  const copy = messages.learner.story.sources;
  const locale = useLocale();
  const profile = useProfileStore(activeProfileSelector);
  const profileId = profile?.id ?? null;

  const story = useMemo(() => {
    const found = storyById(storyId);
    return found ? localizeStory(found, locale) : undefined;
  }, [storyId, locale]);
  const view = useMemo(() => (story ? buildSourcesView(story, copy) : null), [story, copy]);

  const [checkedOpen, setCheckedOpen] = useState(false);
  const [koreanOpen, setKoreanOpen] = useState<ReadonlySet<string>>(new Set());
  const [notes, setNotes] = useState<Readonly<Record<string, string>>>({});
  const initialTarget = useMemo(() => (view ? sourcesTarget(view, { factId, sceneIndex }) : null), [view, factId, sceneIndex]);
  const [highlight, setHighlight] = useState<string | null>(initialTarget?.highlightFactId ?? null);

  // Telemetry: once per mount (§3.12).
  const openedSent = useRef(false);
  useEffect(() => {
    if (openedSent.current || !story) return;
    openedSent.current = true;
    void track({
      name: 'story.sources.opened',
      ...(profileId === null ? {} : { profileId }),
      payload: { ...sourcesOpenedPayload(story.id, from, factId) },
    });
  }, [story, profileId, from, factId]);

  // Scrolling: section and card offsets inside the scroll content.
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionY = useRef<Record<number, number>>({});
  const cardY = useRef<Record<string, { section: number; y: number }>>({});
  const scrolledToTarget = useRef(false);

  const scrollToFact = useCallback((id: string): boolean => {
    const card = cardY.current[id];
    const top = card === undefined ? undefined : sectionY.current[card.section];
    if (card === undefined || top === undefined) return false;
    scrollRef.current?.scrollTo({ y: Math.max(0, top + card.y - spacing.md), animated: false });
    return true;
  }, []);

  const tryInitialScroll = useCallback((): void => {
    if (scrolledToTarget.current || !initialTarget) return;
    if (initialTarget.highlightFactId !== null) {
      if (scrollToFact(initialTarget.highlightFactId)) scrolledToTarget.current = true;
      return;
    }
    const top = sectionY.current[initialTarget.section];
    if (top === undefined) return;
    scrolledToTarget.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, top - spacing.md), animated: false });
  }, [initialTarget, scrollToFact]);

  const onSectionLayout = (section: number) => (e: LayoutChangeEvent) => {
    sectionY.current[section] = e.nativeEvent.layout.y;
    tryInitialScroll();
  };
  const onCardLayout = (section: number, id: string) => (e: LayoutChangeEvent) => {
    cardY.current[id] = { section, y: e.nativeEvent.layout.y };
    tryInitialScroll();
  };

  // Links: one outcome line per source block. The web reads it from the block's live region;
  // iOS has no live regions, so native screen readers are told directly.
  const setNote = useCallback((key: string, note: string | null): void => {
    setNotes((prev) => {
      const next = { ...prev };
      if (note === null) delete next[key];
      else next[key] = note;
      return next;
    });
    if (note !== null && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(note);
  }, []);

  const handOff = useCallback(
    async (link: SourceLink, key: string): Promise<void> => {
      const outcome = await openExternalUrl(link.url);
      setNote(key, openLinkNote(outcome, link.url, copy));
      if (outcome === 'opened' && story) {
        void track({
          name: 'story.sources.link_opened',
          ...(profileId === null ? {} : { profileId }),
          payload: { ...linkOpenedPayload(story.id, link.factId) },
        });
      }
    },
    [copy, story, profileId, setNote],
  );

  // A link waiting on the grown-up gate, back on Sources: native opens it once the gate is
  // through; the web asks for one more tap (a tab opened outside a tap may be blocked), and with
  // the grown-up session now open that tap opens it directly. A cancelled gate drops it.
  const pending = useRef<{ link: SourceLink; key: string } | null>(null);
  useFocusEffect(
    useCallback(() => {
      const waiting = pending.current;
      const step = pendingLinkStep(waiting?.link ?? null, gateOpenNow(), HAND_OFF_NEEDS_TAP);
      pending.current = null;
      if (!waiting) return;
      if (step === 'open') void handOff(waiting.link, waiting.key);
      else if (step === 'tap-again') setNote(waiting.key, copy.gateDone);
    }, [handOff, setNote, copy]),
  );

  const onOpen = (source: SourceView, key: string): void => {
    const link = findSourceLink(story, source.url);
    if (!link) {
      setNote(key, copy.openFailed(source.url));
      return;
    }
    if (openLinkStep(gateOpenNow()) === 'open') {
      // Called straight from the press so the web hand-off keeps the tap (pop-up rules).
      void handOff(link, key);
      return;
    }
    setNote(key, null);
    pending.current = { link, key };
    navigation.navigate('PinEntry', { next: 'ExternalLink', url: link.url });
  };

  const onCopy = (source: SourceView, key: string): void => {
    void copyText(source.url).then((ok) => setNote(key, ok ? copy.linkCopied : copy.copyUnavailable));
  };

  const back = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'Home' });
  };

  const jumpTo = (id: string): void => {
    setHighlight(id);
    scrollToFact(id);
  };

  if (!view) {
    return (
      <Screen tone="canvas" testID="story-sources">
        <SourcesHeader copy={copy} onBack={back} />
        <Body testID="story-sources-empty">{copy.noSources}</Body>
      </Screen>
    );
  }

  return (
    <Screen tone="canvas" scrollable={false} testID="story-sources">
      <SourcesHeader copy={copy} onBack={back} />
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        testID="story-sources-scroll"
      >
        <View style={{ gap: spacing.sm }}>
          <View style={{ alignItems: 'flex-start' }}>
            <KoreanText
              ko={view.title.ko}
              romanization={view.title.romanization}
              gloss={view.title.en}
              size="md"
              accessibilityLabel={messages.a11y.koreanItem({ ko: view.title.ko, romanization: view.title.romanization, gloss: view.title.en })}
              testID="story-sources-story-title"
            />
          </View>
          {view.traditional ? (
            <View style={{ gap: spacing.xs }} testID="story-sources-traditional">
              <View style={{ alignItems: 'flex-start' }}>
                <Pill label={copy.traditionalTale.pill} tone="secondary" size="md" />
              </View>
              {view.originNoteEn !== null ? <Body tone="secondary">{view.originNoteEn}</Body> : null}
              <Body tone="secondary">{view.retellingNoteEn ?? copy.traditionalNote}</Body>
            </View>
          ) : null}
          <CitationText text={view.referenceDisplay} testID="story-sources-reference" />
          <Caption tone="secondary" testID="story-sources-checked">
            {view.checked.label}
          </Caption>
          {view.checked.clusterNote !== null ? <Caption tone="muted">{view.checked.clusterNote}</Caption> : null}
          <Disclosure label={copy.howChecked.cta} open={checkedOpen} onToggle={() => setCheckedOpen((o) => !o)} testID="story-sources-how-checked">
            <CitationText text={view.checked.notes} size="sm" tone="secondary" testID="story-sources-checked-notes" />
          </Disclosure>
          {view.advisoryNoteEn !== null ? (
            <View style={{ gap: spacing.xxs }} testID="story-sources-advisory">
              <SourcesHeading level={2}>{copy.advisoryHeading}</SourcesHeading>
              <Body>{view.advisoryNoteEn}</Body>
            </View>
          ) : null}
        </View>

        {view.corrections.length > 0 ? <CorrectionsList copy={copy} corrections={view.corrections} /> : null}

        <Caption tone="secondary" testID="story-sources-counts">
          {view.counts.label}
        </Caption>

        {view.empty ? <Body testID="story-sources-empty">{view.emptyLabel}</Body> : null}

        {view.sections.map((section, s) => (
          <View
            key={section.kind === 'scene' ? `scene-${section.sceneIndex}` : 'used'}
            onLayout={onSectionLayout(s)}
            style={{ gap: spacing.md }}
            testID={section.kind === 'scene' ? `story-sources-scene-${section.sceneIndex}` : 'story-sources-used'}
          >
            <View style={{ gap: spacing.xxs }}>
              <SourcesHeading level={2}>{section.heading}</SourcesHeading>
              {section.kind === 'scene' && section.caption !== '' ? <Body tone="secondary">{section.caption}</Body> : null}
            </View>
            {section.items.map((item) =>
              item.type === 'see' ? (
                <SeeFactRow
                  key={`see-${item.factId}`}
                  label={item.label}
                  onPress={() => jumpTo(item.factId)}
                  testID={`story-sources-see-${item.factId}-${s}`}
                />
              ) : (
                <FactCard
                  key={item.fact.id}
                  copy={copy}
                  fact={item.fact}
                  highlighted={highlight === item.fact.id}
                  koreanOpen={koreanOpen.has(item.fact.id)}
                  onToggleKorean={() =>
                    setKoreanOpen((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.fact.id)) next.delete(item.fact.id);
                      else next.add(item.fact.id);
                      return next;
                    })
                  }
                  noteFor={(i) => notes[`${item.fact.id}:${i}`] ?? null}
                  onCopy={(source, i) => onCopy(source, `${item.fact.id}:${i}`)}
                  onOpen={(source, i) => onOpen(source, `${item.fact.id}:${i}`)}
                  onLayout={onCardLayout(s, item.fact.id)}
                />
              ),
            )}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
