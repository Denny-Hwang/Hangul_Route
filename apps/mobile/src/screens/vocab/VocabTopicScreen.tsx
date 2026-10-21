import { levelOrder, type VocabTopic } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Heading,
  HoyaBubble,
  KoreanText,
  Progress,
  Screen,
  Spacer,
  spacing,
  useLayoutClass,
} from '@hangul-route/design-system';
import { romanizationShown } from '@hangul-route/i18n';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { isContentLocked } from '../../logic/content-access';
import { contentWidth } from '../../logic/layout/pane-sizes';
import { backOrHome } from '../../logic/navigation/screen-exits';
import { lockedStoryGate } from '../../logic/story/story-tile';
import { ACTIVITY_ROUTES, VOCAB_SCREENS, capabilities } from '../../logic/vocab/caps';
import { vocabCopyOf } from '../../logic/vocab/copy';
import { matchPlayable } from '../../logic/vocab/match-board';
import { emptyVocab, vocabOf } from '../../logic/vocab/progress';
import { suggestActivity, type VocabActivity } from '../../logic/vocab/suggest';
import {
  cardsTarget,
  localizedTopic,
  meterVariant,
  optionCountFor,
  topicActivities,
  topicPageAccess,
  wallTileViews,
} from '../../logic/vocab/topic-view';
import { topicState } from '../../logic/vocab/topics';
import type { RootStackParamList } from '../../navigation/types';
import { useAudience } from '../../store/audience';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useAccessTier } from '../../store/tier-store';
import { passGate } from '../../store/gate-telemetry';
import { canRenderPicture, pickerTopic, topicIntroMemory, topicWords } from './topic-data';
import { WordWall } from './WordWall';

type Props = NativeStackScreenProps<RootStackParamList, 'VocabTopic'>;
type Navigation = NativeStackNavigationProp<RootStackParamList, 'VocabTopic'>;

/** The dots of the meter (the `Progress` default) and the gap `Progress` draws between them. */
const METER_DOT = 12;
/** Hides a view and everything in it from assistive technology on the web, iOS and Android. */
const HIDDEN = { 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

/**
 * A Words topic page (F-VOC-003 §3.4, wireframe vocab/topic-detail C): the
 * title and Korean title, the collection meter and count, Hoya's line once per
 * topic per session, the activities (each drawn only when its screen is in the
 * build, `VOCAB_SCREENS`) and the word wall. A key the picker does not show is
 * "Topic not found" with a way back (T8); a locked topic (gating on only, D5)
 * goes through the grown-up gate here too, whichever screen opened it. Writes nothing.
 * Design: design/screens/vocab/topic.md.
 */
export function VocabTopicScreen({ route, navigation }: Props): React.ReactElement {
  const topic = pickerTopic(route.params.topicKey);
  const profile = useProfileStore(activeProfileSelector);
  // The access tier (F-ENT-003 section 3.4); nothing is locked while the switch is off (D5).
  const tier = useAccessTier(profile?.id ?? '');
  const { opensDirectly } = useAudience();
  const access = topicPageAccess({
    found: topic !== undefined,
    locked: topic !== undefined && isContentLocked({ kind: 'vocab-topic', id: topic.key, tier, gatingEnabled: gatingActive(flags, bundleOs()) }),
  });
  // A locked topic takes the route a locked tile takes (TopicGrid), in place of this page.
  const gated = useRef(false);
  useEffect(() => {
    if (access !== 'locked' || gated.current) return;
    gated.current = true;
    const gate = lockedStoryGate(passGate('Paywall', opensDirectly(false)));
    if (gate.route === 'Paywall') navigation.replace('Paywall', gate.params);
    else navigation.replace('PinEntry', gate.params);
  }, [access, navigation, opensDirectly]);
  // With no history (a reload), Back lands on the Library's Words section (Cards when Words is not offered).
  const back = (): void => backOrHome(navigation, () => navigation.navigate('Main', { screen: 'Library', params: { section: 'theme-packs' } }));
  if (access === 'locked') return <Screen tone="canvas" testID="vocab-topic-gate">{null}</Screen>;
  // Keyed by topic: a navigate to another topic over this one starts a fresh page (Hoya's memory, the reveal).
  return topic && access === 'open' ? (
    <TopicPage key={topic.key} source={topic} navigation={navigation} />
  ) : (
    <TopicNotFound onBack={back} />
  );
}

function TopicNotFound({ onBack }: { onBack: () => void }): React.ReactElement {
  const copy = vocabCopyOf(useMessages());
  return (
    <Screen tone="canvas" testID="vocab-topic-not-found">
      <Body>{copy.topic.notFound}</Body>
      <Spacer size="lg" />
      <Button label={copy.topic.back} tone="secondary" size="md" onPress={onBack} />
    </Screen>
  );
}

function TopicPage({ source, navigation }: { source: VocabTopic; navigation: Navigation }): React.ReactElement {
  const messages = useMessages();
  const copy = vocabCopyOf(messages);
  const locale = useLocale();
  const topic = useMemo(() => localizedTopic(source, locale), [source, locale]);
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  // Not hydrated or unreadable: the page as for nothing collected (§3.4); this page writes nothing.
  const progress = useMemo(() => (snap ? vocabOf(snap) : emptyVocab()), [snap]);
  const romanizationMode = useRomanizationMode();
  const [revealed, setRevealed] = useState(false);
  const titleShown = romanizationShown(romanizationMode, revealed);

  // File order (the wall's); the chunks sort by level themselves (`chunksFor`).
  const items = topicWords(topic.key);
  const counts = useMemo(() => topicState(topic.key, items.map((item) => item.id), progress), [topic.key, items, progress]);
  const level = profile ? levelOrder(profile.ageGroup) : null;
  const optionCount = optionCountFor(level);
  const activities = useMemo(
    () =>
      topicActivities({
        collected: counts.collected,
        suggestion: suggestActivity(topic.key, progress, new Date(), { wordIds: items.map((item) => item.id), optionCount }),
        optionCount,
        picWordMatch: capabilities.picWordMatch,
        matchPlayable: VOCAB_SCREENS.match && matchPlayable(items, progress, canRenderPicture),
        screens: VOCAB_SCREENS,
        copy,
      }),
    [counts.collected, topic.key, progress, items, optionCount, copy],
  );
  const tiles = useMemo(
    () => wallTileViews(items, progress, { locale, romanizationMode, copy, koreanItem: messages.a11y.koreanItem, revealed }),
    [items, progress, locale, romanizationMode, copy, messages.a11y.koreanItem, revealed],
  );

  // Hoya's line once per topic per learner per app session: decided when the page opens, remembered once shown.
  const learner = profile?.id ?? '';
  const [intro] = useState(() => topicIntroMemory.due(learner, topic.key));
  useEffect(() => {
    topicIntroMemory.mark(learner, topic.key);
  }, [learner, topic.key]);

  const lc = useLayoutClass();
  const meter = meterVariant(counts.total, contentWidth(lc.windowWidth, lc.gutter, lc.maxWidth.reading), METER_DOT, spacing.sm);

  const open = (activity: VocabActivity): void => {
    const topicKey = topic.key;
    if (activity === 'learn') navigation.navigate(ACTIVITY_ROUTES.learn, { topicKey });
    else if (activity === 'speed') navigation.navigate(ACTIVITY_ROUTES.speed, { topicKey });
    else navigation.navigate(ACTIVITY_ROUTES.match, { topicKey });
  };
  const openWord = (id: string): void => {
    const target = cardsTarget(topic, items, level, id);
    if (target) navigation.navigate(ACTIVITY_ROUTES.learn, target);
  };

  return (
    <Screen tone="canvas" scrollable testID="vocab-topic">
      <Heading level="display" testID="vocab-topic-title">
        {topic.titleEn}
      </Heading>
      <Spacer size="xs" />
      <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
        <KoreanText
          ko={topic.titleKo.ko}
          romanization={topic.titleKo.romanization}
          romanizationShown={titleShown}
          size="sm"
          accessibilityLabel={messages.a11y.koreanItem({ ko: topic.titleKo.ko, romanization: topic.titleKo.romanization, gloss: topic.titleEn })}
          testID="vocab-topic-ko"
        />
      </View>
      {titleShown ? null : (
        <View style={{ alignSelf: 'flex-start' }}>
          <Spacer size="xs" />
          <Button label={copy.cards.showSound} tone="ghost" size="md" onPress={() => setRevealed(true)} testID="vocab-topic-reveal" />
        </View>
      )}

      <Spacer size="md" />
      <View {...HIDDEN}>
        <Progress variant={meter} value={counts.collected} max={Math.max(counts.total, 1)} height={meter === 'dots' ? METER_DOT : spacing.sm} />
      </View>
      <Spacer size="xs" />
      <Body weight="semibold" testID="vocab-topic-count">
        {copy.topic.collected(counts.collected)}
      </Body>

      {intro && topic.hoyaIntroEn.trim() !== '' ? (
        <>
          <Spacer size="lg" />
          <HoyaBubble tone="idle" message={topic.hoyaIntroEn} testID="vocab-topic-hoya" />
        </>
      ) : null}

      {activities.length > 0 ? (
        <View style={{ gap: spacing.md }} testID="vocab-topic-activities">
          <Spacer size="xs" />
          {activities.map((a) => (
            <View key={a.kind} style={{ gap: spacing.xs }}>
              <Button
                label={a.label}
                tone={a.primary ? 'primary' : 'secondary'}
                size="lg"
                fullWidth
                onPress={() => open(a.opens)}
                testID={`vocab-activity-${a.kind}`}
              />
              <Body tone="secondary">
                {a.line}
              </Body>
            </View>
          ))}
        </View>
      ) : null}

      <Spacer size="lg" />
      <WordWall tiles={tiles} onOpen={VOCAB_SCREENS.learn ? openWord : undefined} />
      <Spacer size="xl" />
    </Screen>
  );
}
