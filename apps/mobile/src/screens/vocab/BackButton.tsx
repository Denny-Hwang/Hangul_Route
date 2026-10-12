import { Icon, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable } from 'react-native';
import { useMessages } from '../../i18n/use-messages';

/**
 * Back, top-left, the same place on every screen (the Words screens, F-VOC-003 §3.3 and §3.4).
 * The target itself is `touchTarget.min` square: `hitSlop` alone does not grow it on the web.
 */
export function BackButton({ onPress }: { onPress: () => void }): React.ReactElement {
  const messages = useMessages();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={spacing.md}
      accessibilityRole="button"
      accessibilityLabel={messages.a11y.goBack}
      testID="vocab-back"
      style={{
        alignSelf: 'flex-start',
        minWidth: touchTarget.min,
        minHeight: touchTarget.min,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="arrow-left" size={spacing.xxl} />
    </Pressable>
  );
}
