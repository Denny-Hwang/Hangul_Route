import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { borderWidth, colors, radii, spacing, touchTarget, typography } from '../../tokens';
import { KOREAN_LANGUAGE, koreanTextView } from '../../korean-text';
import { Icon } from '../Icon';
import type { KoreanTextProps } from './types';
import { KOREAN_LINE_BREAK } from '../../line-break';

// Speech language for assistive tech: iOS reads the label with the Korean voice;
// react-native-web forwards `lang` to the DOM (verify on device). Spread so the
// web-only prop does not need a type the native Text props lack.
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

/**
 * KoreanText — the one renderer for taught Korean (F-I18N-001 §3.5).
 * A target chip (Hangul on a sky-blue tint with a border), the romanization
 * line, and the gloss line; a speaker icon when it is pressable. Identical in
 * every UI locale so the pattern is learned once. No copy and no i18n
 * dependency: the caller passes `accessibilityLabel` and `romanizationShown`.
 * Spec: design/components/KoreanText/spec.md.
 */
export function KoreanText({
  ko,
  romanization,
  gloss,
  size = 'md',
  romanizationShown = true,
  onPress,
  accessibilityLabel,
  testID,
}: KoreanTextProps): React.ReactElement {
  const view = koreanTextView({
    ko,
    romanization,
    gloss,
    size,
    romanizationShown,
    pressable: onPress !== undefined,
    accessibilityLabel,
  });

  const speaker = view.showSpeaker ? (
    <Icon name="speaker" size={spacing.xl} color={colors.brand.secondaryDark} />
  ) : null;

  const inner = (
    <>
      <View
        style={{
          backgroundColor: colors.brand.secondaryLight,
          borderColor: colors.brand.secondary,
          borderWidth: borderWidth.base,
          borderRadius: radii.lg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Text {...KOREAN_LINE_BREAK}
          {...koreanSpeech}
          style={{
            fontFamily: typography.family.sansKr,
            fontSize: view.hangulSize,
            fontWeight: typography.weight.bold,
            color: colors.text.primary,
            lineHeight: view.hangulSize * typography.leading.normal,
            textAlign: 'center',
          }}
        >
          {ko}
        </Text>
      </View>
      {view.showRomanization || speaker ? (
        <View
          style={{
            marginTop: spacing.xs,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
          }}
        >
          {view.showRomanization ? (
            <Text {...KOREAN_LINE_BREAK}
              style={{
                fontSize: view.romanizationSize,
                fontWeight: typography.weight.medium,
                fontStyle: 'italic',
                color: colors.text.secondary,
              }}
            >
              {romanization}
            </Text>
          ) : null}
          {speaker}
        </View>
      ) : null}
      {view.showGloss ? (
        <Text {...KOREAN_LINE_BREAK}
          style={{
            marginTop: spacing.xxs,
            fontSize: typography.size.body,
            color: colors.text.secondary,
            textAlign: 'center',
          }}
        >
          {gloss}
        </Text>
      ) : null}
    </>
  );

  if (!view.pressable) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={view.label}
        accessibilityLanguage={KOREAN_LANGUAGE}
        style={{ alignItems: 'center' }}
      >
        {inner}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={view.label}
      accessibilityLanguage={KOREAN_LANGUAGE}
      hitSlop={spacing.sm}
      style={({ pressed }) => ({
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: touchTarget.min,
        minWidth: touchTarget.min,
        transform: [{ scale: pressed ? 1.04 : 1 }],
      })}
    >
      {inner}
    </Pressable>
  );
}
