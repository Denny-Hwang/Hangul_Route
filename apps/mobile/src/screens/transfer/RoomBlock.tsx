import { Body, Icon, borderWidth, colors, radii, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';

/** The room block of a move waiting for room (F-SPACE-002 4.12): amber nudge, never red, as on the console requests page. */
export function RoomBlock({ text }: { text: string }): React.ReactElement {
  return (
    <View
      testID="transfer-room"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.feedback.nudgeLight,
        borderLeftWidth: borderWidth.thick,
        borderLeftColor: colors.feedback.nudge,
        borderRadius: radii.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
      }}
    >
      <Icon name="pause" size={20} color={colors.text.primary} />
      <View style={{ flex: 1 }}>
        <Body>{text}</Body>
      </View>
    </View>
  );
}

