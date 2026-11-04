import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { colors, radii, shadows, spacing, touchTarget } from '../../tokens';
import { GuardedPressable } from '../TapBoard/GuardedPressable';
import { useTypeScale } from '../TextSize';
import { hoyaDismissLabel } from '../../labels';
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
  dismissLabel,
  autoDismissMs,
  testID,
}: HoyaBubbleProps): ReactElement {
  const textScale = useTypeScale();
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
          // Korean on the bubble tints uses ink, not brand orange (UX-10: 2.62:1 on nudgeLight).
          <Heading level="prompt" tone="primary" style={{ marginTop: spacing.xs }}>
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
        // AMENDMENTS-TOUCH 6.9 (row KT-9): guarded, and closing the bubble moves what is under it, so it sets the lock.
        <GuardedPressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={hoyaDismissLabel(dismissLabel)}
          // The hit area is the Pressable itself, at least touchTarget.min each way (react-native-web drops hitSlop). It
          // reaches into the bubble's own top and right padding, so the × keeps its size and corner (KT-9, 6.9).
          style={{
            minWidth: touchTarget.min,
            minHeight: touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -spacing.lg,
            marginRight: -spacing.lg,
          }}
        >
          <Caption
            tone="muted"
            weight="bold"
            style={{ fontSize: textScale.size.body }}
          >
            ×
          </Caption>
        </GuardedPressable>
      ) : null}
    </View>
  );
}
