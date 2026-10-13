import { spacing, useLayoutClass, useMediaSize } from '@hangul-route/design-system';
import type { VocabTopic } from '@hangul-route/content-schema';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { askFor, helpAskedEvent, isClassOnly } from '../../logic/access-copy';
import { isContentLocked } from '../../logic/content-access';
import { contentWidth, gridCellWidth, gridRows } from '../../logic/layout/pane-sizes';
import { lockedStoryGate } from '../../logic/story/story-tile';
import { vocabCopyOf } from '../../logic/vocab/copy';
import { emptyVocab, vocabOf } from '../../logic/vocab/progress';
import {
  localizedTopic,
  topicGridColumns,
  topicOpenedEvent,
  topicTileView,
  type TopicOpenSource,
  type TopicTileView,
} from '../../logic/vocab/topic-view';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { useMembershipStore } from '../../store/membership-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useAccessTier } from '../../store/tier-store';
import { topicWords } from './topic-data';
import { TOPIC_TILE_CHROME, TopicTile } from './TopicTile';

const GRID_GAP = spacing.sm;
/** The cover at scale 1 (`touchTarget.hero`); it shrinks to the tile on a narrow column. */
const COVER = 96;

/**
 * The Words topic grid (F-VOC-003 §3.3): one `TopicTile` per topic in topic
 * order, 1 column below 360 dp, 2 to 767, 3 from 768. Shared by the picker
 * screen and the Library's Words section (T1). A tap sends
 * `vocab.topic_opened` and opens the topic page; a locked topic (gating on
 * only, never at launch) takes the route a locked story takes, with the ask by audience as its
 * hint and `access.help_asked` first (F-ENT-003 section 3.7, wireframe library/access-and-plan-tags).
 * Design: design/screens/vocab/topics.md.
 */
export function TopicGrid({
  topics,
  source,
  width: screenWidth,
}: {
  topics: readonly VocabTopic[];
  /** Where the grid is, for `vocab.topic_opened` (section 3.7: the picker and the Library section are both `library`). */
  source: TopicOpenSource;
  /** The width cap of the screen the grid sits in, for the first frame before the grid is measured. */
  width: 'reading' | 'full';
}): React.ReactElement {
  const messages = useMessages();
  const copy = vocabCopyOf(messages);
  const locale = useLocale();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { opensDirectly, audience } = useAudience();
  const profile = useProfileStore(activeProfileSelector);
  const memberships = useMembershipStore((s) => (profile ? s.byLearner[profile.id] : undefined));
  const ask = askFor(audience, isClassOnly(memberships ?? []), messages.learner.access);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const progress = useMemo(() => (snap ? vocabOf(snap) : emptyVocab()), [snap]);
  const romanizationMode = useRomanizationMode();
  // The access tier (F-ENT-003 section 3.4); nothing is locked while the switch is off (D5).
  const tier = useAccessTier(profile?.id ?? '');

  const views: TopicTileView[] = useMemo(
    () =>
      topics.map((topic) =>
        topicTileView({
          topic: localizedTopic(topic, locale),
          items: topicWords(topic.key),
          progress,
          locale,
          romanizationMode,
          locked: isContentLocked({ kind: 'vocab-topic', id: topic.key, tier, gatingEnabled: gatingActive(flags, bundleOs()) }),
          copy,
        }),
      ),
    [topics, locale, progress, romanizationMode, tier, copy],
  );

  const lc = useLayoutClass();
  const columns = topicGridColumns(lc.windowWidth);
  const [measured, setMeasured] = useState<number | null>(null);
  const onGridLayout = (e: LayoutChangeEvent): void => {
    const width = Math.round(e.nativeEvent.layout.width);
    setMeasured((prev) => (prev === width ? prev : width));
  };
  const cover = useMediaSize(COVER);
  const gridWidth = measured ?? contentWidth(lc.windowWidth, lc.gutter, lc.maxWidth[screenWidth]);
  const cellWidth = gridCellWidth(gridWidth, columns, GRID_GAP);
  const artSize = Math.max(0, Math.min(cover, cellWidth - TOPIC_TILE_CHROME));

  const open = (view: TopicTileView): void => {
    if (view.locked) {
      void track(helpAskedEvent(profile?.id, 'library', ask.audience));
      const gate = lockedStoryGate(opensDirectly(false));
      if (gate.route === 'Paywall') navigation.navigate('Paywall', gate.params);
      else navigation.navigate('PinEntry', gate.params);
      return;
    }
    void track({ ...topicOpenedEvent(view.key, source), profileId: profile?.id });
    navigation.navigate('VocabTopic', { topicKey: view.key });
  };

  return (
    <View role="list" style={{ gap: GRID_GAP }} onLayout={onGridLayout} testID="vocab-topic-grid">
      {gridRows(views, columns).map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: GRID_GAP, alignItems: 'stretch' }}>
          {row.map((view, i) =>
            view ? (
              <View key={view.key} role="listitem" style={{ width: cellWidth }}>
                <TopicTile
                  view={view}
                  width={cellWidth}
                  artSize={artSize}
                  onPress={() => open(view)}
                  hint={view.locked ? ask.label : undefined}
                  testID={`vocab-topic-tile-${view.key}`}
                />
              </View>
            ) : (
              <View key={`pad-${i}`} style={{ width: cellWidth }} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}
