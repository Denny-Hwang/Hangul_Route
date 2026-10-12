import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { EpisodeDetailView } from './EpisodeDetailView';

type Props = NativeStackScreenProps<RootStackParamList, 'EpisodeDetail'>;

export function EpisodeDetailScreen({ route, navigation }: Props): React.ReactElement {
  return (
    <EpisodeDetailView
      episodeId={route.params.episodeId}
      onStartQuest={(questId, episodeId) => navigation.navigate('QuestPlayer', { questId, episodeId })}
      onOpenCard={(cardId) => navigation.navigate('CardDetail', { cardId })}
      onOpenStory={(t) => (t.route === 'StoryReader' ? navigation.navigate('StoryReader', t.params) : navigation.navigate('QuestPlayer', t.params))}
      onOpenSources={(storyId) => navigation.navigate('StorySources', { storyId, from: 'episode' })}
      onOpenCultureNotes={(storyId) => navigation.push('CultureNotes', { storyId })}
      onOpenCellStories={(stage, theme, source) => navigation.navigate('CellStories', { stage, theme, source })}
      onBack={() => navigation.goBack()}
    />
  );
}
