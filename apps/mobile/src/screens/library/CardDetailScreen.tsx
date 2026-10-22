import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { useActiveLearnerId } from '../../store/active-learner';
import { useProgressStore } from '../../store/progress-store';
import { CardDetailView } from './CardDetailView';

type Props = NativeStackScreenProps<RootStackParamList, 'CardDetail'>;

export function CardDetailScreen({ route }: Props): React.ReactElement {
  const { cardId } = route.params;
  // [GU] The active learner: the guest's id in a guest run (AMENDMENTS-GUEST-FIRST-LESSON 5.3, row GU-3), no profile record needed.
  const profileId = useActiveLearnerId();
  const markCardsSeen = useProgressStore((s) => s.markCardsSeen);
  // Opening a card (from the Library, Results or an episode page) clears its New pill (F-STORY-006 §3.3).
  useEffect(() => {
    if (profileId) markCardsSeen(profileId, [cardId]);
  }, [profileId, cardId, markCardsSeen]);
  // A locked card says how it is earned here too (wireframe library/earn-hints F2).
  // Close is the route's ScreenHeader (AMENDMENTS-DISPLAY-NAV section 7.1).
  return <CardDetailView cardId={cardId} showHowToEarn />;
}
