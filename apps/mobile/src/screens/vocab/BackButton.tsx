import { Icon, spacing } from '@hangul-route/design-system';
import React from 'react';
import { Pressable } from 'react-native';
import { useMessages } from '../../i18n/use-messages';

/** Back, top-left, the same place on every screen (the Words screens, F-VOC-003 §3.3 and §3.4). */
export function BackButton({ onPress }: { onPress: () => void }): React.ReactElement {
  const messages = useMessages();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={spacing.md}
      accessibilityRole="button"
      accessibilityLabel={messages.a11y.goBack}
      testID="vocab-back"
      style={{ alignSelf: 'flex-start', padding: spacing.xs }}
    >
      <Icon name="arrow-left" size={spacing.xxl} />
    </Pressable>
  );
}
