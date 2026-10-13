import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { itemViewedEvent } from '../../logic/browse/home-view';
import type { BrowseStackParamList } from '../../navigation/browse';
import { CardDetailView } from '../library/CardDetailView';
import { useItemViewed } from './browse-ui';

/**
 * A heritage card in All lessons (F-BROWSE-001 sections 4.2 and 4.7, OD-7):
 * the learner card page in its preview state (BR-5c), front and back as an
 * earned card looks, with no earned date, no earn hint, no share action and
 * no learner read. Every adult may open every card.
 */
type Props = NativeStackScreenProps<BrowseStackParamList, 'CardDetail'>;

export function BrowseCardScreen({ route, navigation }: Props): React.ReactElement {
  const { cardId } = route.params;
  useItemViewed(itemViewedEvent('card', cardId, 'open'));
  const close = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('BrowseHome', { section: 'library' });
  };
  return <CardDetailView cardId={cardId} onClose={close} state="preview" />;
}
