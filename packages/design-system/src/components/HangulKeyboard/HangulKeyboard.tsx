import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { borderWidth, colors, radii, spacing, typography } from '../../tokens';
import { Icon } from '../Icon';
import { keyboardLayout, keyFace, pressLetter, type KeyboardKey } from './layout';
import type { HangulKeyboardProps } from './types';
import { KOREAN_LINE_BREAK } from '../../line-break';

/**
 * HangulKeyboard: the in-app two-set (dubeolsik, KS X 5002) Korean keyboard
 * (F-CURR-001 §3.7, OD-10; design/screens/minigame-writing/keyboard.md). It draws
 * the keys `keyboardLayout` places and reports presses; it holds no text and composes
 * nothing (`composeTyped` in content-schema does). Shift is one-shot and lives here.
 * No copy: the caller passes the localised names. No key sound, no haptic per key.
 */
export function HangulKeyboard({
  onKey,
  onDelete,
  onSpace,
  width,
  layoutClass,
  soundOf,
  speakSound = (sound) => sound,
  labels,
  disabled = false,
  testID,
}: HangulKeyboardProps): React.ReactElement {
  const [shift, setShift] = useState(false);
  const kb = keyboardLayout(width, layoutClass);
  const tablet = layoutClass.mediaScale > 1;
  const glyphSize = tablet ? typography.size.display : typography.size.title;
  const soundSize = tablet ? typography.size.bodySm : typography.size.caption;
  const edgeToEdge = layoutClass.width === 'compact' || layoutClass.short;

  const press = (key: KeyboardKey): void => {
    if (disabled) return;
    if (key.kind === 'shift') {
      setShift((on) => !on);
      return;
    }
    if (key.kind === 'delete') {
      onDelete();
      return;
    }
    if (key.kind === 'space') {
      onSpace();
      return;
    }
    const { jamo, shift: next } = pressLetter(key.base ?? '', shift);
    setShift(next);
    onKey(jamo);
  };

  const renderFace = (key: KeyboardKey): React.ReactElement => {
    if (key.kind === 'shift') {
      return <Icon name={shift ? 'shift-on' : 'shift'} size={spacing.xl} color={shift ? colors.brand.secondaryDark : colors.text.primary} />;
    }
    if (key.kind === 'delete') return <Icon name="backspace" size={spacing.xl} color={colors.text.primary} />;
    if (key.kind === 'space') {
      return (
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.bodySm, fontWeight: typography.weight.semibold, color: colors.text.primary, textAlign: 'center' }}>
          {labels.space}
        </Text>
      );
    }
    const face = keyFace(key.base ?? '', shift);
    const shifted = face !== key.base;
    return (
      <>
        <Text {...KOREAN_LINE_BREAK}
          style={{
            fontSize: glyphSize,
            lineHeight: Math.round(glyphSize * 1.1),
            fontWeight: typography.weight.semibold,
            color: shifted ? colors.brand.secondaryDark : colors.text.primary,
          }}
        >
          {face}
        </Text>
        <Text {...KOREAN_LINE_BREAK}
          numberOfLines={1}
          style={{ fontSize: soundSize, color: colors.text.secondary, letterSpacing: typography.tracking.tight }}
        >
          {soundOf(face)}
        </Text>
      </>
    );
  };

  const nameOf = (key: KeyboardKey): string => {
    if (key.kind === 'shift') return labels.shift;
    if (key.kind === 'delete') return labels.delete;
    if (key.kind === 'space') return labels.space;
    const face = keyFace(key.base ?? '', shift);
    return labels.key(face, speakSound(soundOf(face)));
  };

  return (
    <View
      testID={testID}
      style={{
        width: kb.width,
        height: kb.height + (edgeToEdge ? borderWidth.thin : 0),
        backgroundColor: colors.surface.canvas,
        borderTopWidth: edgeToEdge ? borderWidth.thin : 0,
        borderTopColor: colors.border.subtle,
        alignSelf: 'center',
      }}
    >
      {kb.keys.map((key) => {
        const action = key.kind !== 'letter';
        const shiftOn = key.kind === 'shift' && shift;
        const fill = shiftOn
          ? colors.brand.secondaryLight
          : key.half === 'vowel'
            ? colors.surface.sunken
            : colors.surface.paper;
        return (
          <Pressable
            key={key.id}
            testID={testID ? `${testID}-${key.id}` : undefined}
            onPress={() => press(key)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={nameOf(key)}
            accessibilityState={key.kind === 'shift' ? { selected: shift, disabled } : { disabled }}
            aria-pressed={key.kind === 'shift' ? shift : undefined}
            style={{ position: 'absolute', left: key.x, top: key.y, width: key.width, height: key.height, padding: spacing.xxs }}
          >
            {({ pressed }) => (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radii.sm,
                  backgroundColor: pressed && !disabled ? colors.brand.primaryLight : fill,
                  borderWidth: shiftOn ? borderWidth.thick : action ? borderWidth.base : borderWidth.thin,
                  borderColor: shiftOn ? colors.brand.secondaryDark : action ? colors.border.strong : colors.border.subtle,
                }}
              >
                {renderFace(key)}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
