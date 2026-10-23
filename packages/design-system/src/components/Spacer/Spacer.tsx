import type { ReactElement } from 'react';
import { View } from 'react-native';
import { spacing } from '../../tokens';
import type { SpacerProps } from './types';

export function Spacer({ size = 'md', flex = false }: SpacerProps): ReactElement {
  const px = spacing[size];
  return <View style={flex ? { flex: 1 } : { width: px, height: px }} />;
}
