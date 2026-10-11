import { Body, Button, Card, Spacer, borderWidth, colors, radii, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import type { PrereqSheet as PrereqSheetModel } from '../logic/quest-flow/soft-prereq';

/**
 * One-line "Start there?" sheet — F-QUEST-002 §3.5, wireframe episode/detail
 * (soft prerequisite). Pinned to the bottom with no backdrop, so the page
 * stays tappable underneath; nothing is locked and both answers always work.
 */
export interface PrereqSheetProps {
  sheet: PrereqSheetModel;
  onStartThere: () => void;
  onPlayAnyway: () => void;
}

export function PrereqSheet({ sheet, onStartThere, onPlayAnyway }: PrereqSheetProps): React.ReactElement {
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md }}
      testID="prereq-sheet"
    >
      <Card
        padding="md"
        tone="paper"
        style={{ borderWidth: borderWidth.thin, borderColor: colors.border.subtle, borderRadius: radii.xl }}
      >
        <View accessibilityLiveRegion="polite">
          <Body weight="semibold">{sheet.message}</Body>
        </View>
        <Spacer size="md" />
        <Button label={sheet.startThereLabel} tone="primary" size="md" fullWidth onPress={onStartThere} />
        <Spacer size="sm" />
        <Button label={sheet.playAnywayLabel} tone="ghost" size="md" fullWidth onPress={onPlayAnyway} />
      </Card>
    </View>
  );
}
