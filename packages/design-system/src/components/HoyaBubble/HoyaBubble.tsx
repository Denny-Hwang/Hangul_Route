import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../../tokens';
import { Body, Caption, Heading } from '../Heading/Heading';
import { Hoya } from '../Hoya/Hoya';
import type { HoyaPose } from '../Hoya/types';
import type { HoyaBubbleProps, HoyaTone } from './types';

const poseFor: Record<HoyaTone, HoyaPose> = {
  idle: 'idle',
  cheering: 'cheering',
  thinking: 'thinking',
};

const toneBg: Record<HoyaTone, string> = {
  idle: colors.surface.paper,
  cheering: colors.feedback.successLight,
  thinking: colors.feedback.nudgeLight, // anti-shame: amber not red
};

const toneBorder: Record<HoyaTone, string> = {
  idle: colors.border.subtle,
  cheering: colors.feedback.success,
  thinking: colors.feedback.nudge,
};

const MIN_DISMISS_MS = 1500;

export function HoyaBubble({
  tone = 'idle',
  message,
  korean,
  romanization,
  ctaInline,
  onDismiss,
  autoDismissMs,
  testID,
}: HoyaBubbleProps): React.ReactElement {
  useEffect(() => {
    if (!onDismiss || !autoDismissMs) return;
    const ms = Math.max(MIN_DISMISS_MS, autoDismissMs);
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [onDismiss, autoDismissMs]);

  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        backgroundColor: toneBg[tone],
        borderRadius: radii.xl,
        borderWidth: 2,
        borderColor: toneBorder[tone],
        padding: spacing.lg,
        ...shadows.card,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Hoya pose={poseFor[tone]} size={72} />
      </View>
      <View style={{ flex: 1 }}>
        <Body weight="semibold" size="lg">
          {message}
        </Body>
        {korean ? (
          <Heading level="prompt" tone="brand" style={{ marginTop: spacing.xs }}>
            {korean}
          </Heading>
        ) : null}
        {romanization ? (
          <Caption tone="secondary" style={{ marginTop: spacing.xxs, fontStyle: 'italic' }}>
            {romanization}
          </Caption>
        ) : null}
        {ctaInline ? <View style={{ marginTop: spacing.sm }}>{ctaInline}</View> : null}
      </View>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close Hoya message"
          hitSlop={spacing.md}
          style={{ paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs }}
        >
          <Caption
            tone="muted"
            weight="bold"
            style={{ fontSize: typography.size.body }}
          >
            ×
          </Caption>
        </Pressable>
      ) : null}
    </View>
  );
}
