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
      onBack={() => navigation.goBack()}
    />
  );
}
