import { colors } from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { itemViewedEvent } from '../../logic/browse/home-view';
import type { BrowseStackParamList } from '../../navigation/browse';
import { onEscape } from '../../platform/browse-env';
import { CardDetailView } from '../library/CardDetailView';
import { useItemViewed } from './browse-ui';

/**
 * A heritage card in All lessons (F-BROWSE-001 sections 4.2, 4.7 and 7, OD-7):
 * the learner card page in its preview state (BR-5c), front and back as an
 * earned card looks, with no earned date, no earn hint, no share action and no
 * learner read. Every adult may open every card. The way back is the route's
 * ScreenHeader Close in the one fixed top-left position (AMENDMENTS-DISPLAY-NAV
 * section 7.1); Escape closes it too.
 */
type Props = NativeStackScreenProps<BrowseStackParamList, 'CardDetail'>;

export function BrowseCardScreen({ route, navigation }: Props): React.ReactElement {
  const { cardId } = route.params;
  useItemViewed(itemViewedEvent('card', cardId, 'open'));
  const close = React.useCallback((): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('BrowseHome', { section: 'library' });
  }, [navigation]);
  useEffect(() => onEscape(close), [close]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.canvas }} testID="browse-card-screen">
      <View style={{ flex: 1 }}>
        <CardDetailView cardId={cardId} state="preview" />
      </View>
    </View>
  );
}
