import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, spacing, touchTarget, typography } from '../../tokens';
import { Icon } from '../Icon';
import { KoreanText } from '../KoreanText';
import { choiceCardStyle } from './style';
import type { ChoiceCardProps } from './types';

/**
 * ChoiceCard — the one option card for "pick one" questions (F-STORY-003 §3.4):
 * a text option, a Korean option (drawn with `KoreanText`) or a picture option.
 * Left-aligned wrapped text, 80 dp minimum height, tokens only. A wrong card is
 * an amber nudge with a "try another" mark, never red and never an X. No copy
 * and no motion: the caller passes `accessibilityLabel` (naming the outcome).
 * Spec: design/components/ChoiceCard/spec.md.
 */
export function ChoiceCard({
  label,
  ko,
  romanization = '',
  gloss,
  art,
  state,
  onPress,
  accessibilityLabel,
  testID,
}: ChoiceCardProps): React.ReactElement {
  const look = choiceCardStyle(state);
  const hasArt = art !== undefined && art !== null && art !== false;
  const hasKorean = ko !== undefined && ko.trim().length > 0;
  const hasLabel = label !== undefined && label.length > 0;

  const content = (borderColor: string): React.ReactElement => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: look.minHeight,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: look.backgroundColor,
        borderColor,
        borderWidth: look.borderWidth,
        borderRadius: look.borderRadius,
      }}
    >
      <View style={{ flex: 1, gap: spacing.sm }}>
        {hasArt ? (
          <View style={{ alignSelf: 'center', minHeight: touchTarget.hero, justifyContent: 'center' }}>{art}</View>
        ) : null}
        {hasKorean ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <KoreanText ko={ko} romanization={romanization} gloss={gloss} size="sm" />
          </View>
        ) : null}
        {hasLabel ? (
          <Text
            style={{
              fontSize: typography.size.body,
              fontWeight: typography.weight.semibold,
              lineHeight: typography.size.body * typography.leading.normal,
              color: look.textColor,
              textAlign: 'left',
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
      {look.mark ? <Icon name={look.mark.icon} size={spacing.xl} color={look.mark.color} /> : null}
    </View>
  );

  return (
    <Pressable
      testID={testID}
      onPress={look.interactive ? onPress : undefined}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: look.disabled, selected: look.selected }}
      hitSlop={spacing.sm}
      // Pressed feedback is the focus-coloured border, instant: no scale or fade, so reduced motion needs nothing.
      style={{ alignSelf: 'stretch' }}
    >
      {({ pressed }) => content(pressed && look.interactive ? colors.border.focus : look.borderColor)}
    </Pressable>
  );
}
