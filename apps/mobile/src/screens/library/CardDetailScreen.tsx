import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import type { RootStackParamList } from '../../navigation/types';
import { CardDetailView } from './CardDetailView';

type Props = NativeStackScreenProps<RootStackParamList, 'CardDetail'>;

export function CardDetailScreen({ route, navigation }: Props): React.ReactElement {
  return <CardDetailView cardId={route.params.cardId} onClose={() => navigation.goBack()} />;
}
