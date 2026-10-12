import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { CardDetailView } from './CardDetailView';

type Props = NativeStackScreenProps<RootStackParamList, 'CardDetail'>;

export function CardDetailScreen({ route, navigation }: Props): React.ReactElement {
  const { cardId } = route.params;
  const profileId = useProfileStore(activeProfileSelector)?.id;
  const markCardsSeen = useProgressStore((s) => s.markCardsSeen);
  // Opening a card (from the Library, Results or an episode page) clears its New pill (F-STORY-006 §3.3).
  useEffect(() => {
    if (profileId) markCardsSeen(profileId, [cardId]);
  }, [profileId, cardId, markCardsSeen]);
  // A locked card says how it is earned here too (wireframe library/earn-hints F2).
  return <CardDetailView cardId={cardId} onClose={() => navigation.goBack()} showHowToEarn />;
}
