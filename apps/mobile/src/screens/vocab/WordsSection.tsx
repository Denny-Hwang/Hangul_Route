import { Body, Spacer } from '@hangul-route/design-system';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { vocabCopyOf } from '../../logic/vocab/copy';
import { emptyVocab, vocabOf } from '../../logic/vocab/progress';
import { wordsCollected } from '../../logic/vocab/topic-view';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { pickerTopics, topicWords } from './topic-data';
import { TopicGrid } from './TopicGrid';

/**
 * The Library's Words section (F-VOC-003 T1, the `theme-packs` slot): one
 * line, the words collected so far as a plain count, and the topic grid of
 * the picker, inline. The Library offers the section only with
 * `flags.vocabTopicsEnabled` and a topic to show. Design:
 * design/screens/vocab/topics.md.
 */
export function WordsSection(): React.ReactElement {
  const copy = vocabCopyOf(useMessages());
  const profile = useProfileStore(activeProfileSelector);
  const snap = useProgressStore((s) => (profile ? s.byProfile[profile.id] : undefined));
  const topics = pickerTopics();
  const collected = useMemo(() => wordsCollected(topics, topicWords, snap ? vocabOf(snap) : emptyVocab()), [topics, snap]);

  return (
    <View testID="library-words">
      <Body tone="secondary">{copy.library.line}</Body>
      {/* The count waits for the first word: never "0 collected" (owner request 2026-10-16, item 8). */}
      {collected > 0 ? (
        <>
          <Spacer size="xs" />
          <Body weight="semibold" testID="library-words-count">
            {copy.library.collected(collected)}
          </Body>
        </>
      ) : null}
      <Spacer size="lg" />
      <TopicGrid topics={topics} source="library" width="full" />
    </View>
  );
}
