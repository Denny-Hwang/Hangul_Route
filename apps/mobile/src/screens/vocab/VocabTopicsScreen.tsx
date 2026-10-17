import { Body, Button, Card, Heading, Screen, Spacer } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { useMessages } from '../../i18n/use-messages';
import { backOrHome } from '../../logic/navigation/screen-exits';
import { vocabCopyOf } from '../../logic/vocab/copy';
import type { RootStackParamList } from '../../navigation/types';
import { pickerTopics } from './topic-data';
import { TopicGrid } from './TopicGrid';

type Props = NativeStackScreenProps<RootStackParamList, 'VocabTopics'>;

/**
 * The Words topic picker (F-VOC-003 §3.3, wireframe vocab/topics B): the
 * title, one line and the topic grid; the Library's Words section draws the
 * same grid inline (T1). No topic to show (dev builds only) -> "Words are on
 * their way." with a way back. Design: design/screens/vocab/topics.md.
 */
export function VocabTopicsScreen({ navigation }: Props): React.ReactElement {
  const copy = vocabCopyOf(useMessages());
  const topics = pickerTopics();
  // With no history (a reload), Back lands on the Library's Words section (Cards when Words is not offered).
  const back = (): void => backOrHome(navigation, () => navigation.navigate('Main', { screen: 'Library', params: { section: 'theme-packs' } }));

  return (
    <Screen tone="canvas" scrollable testID="vocab-topics">
      <Heading level="title">{copy.topics.title}</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">{copy.topics.line}</Body>
      <Spacer size="lg" />
      {topics.length > 0 ? (
        <TopicGrid topics={topics} source="library" width="reading" />
      ) : (
        <Card padding="md" tone="paper" testID="vocab-topics-empty">
          <Body>{copy.topics.empty}</Body>
          <Spacer size="md" />
          <Button label={copy.topics.back} tone="secondary" size="md" onPress={back} />
        </Card>
      )}
      <Spacer size="xl" />
    </Screen>
  );
}
