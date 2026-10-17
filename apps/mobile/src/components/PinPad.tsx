import { Icon, colors, radii, spacing, typography, KOREAN_LINE_BREAK, useTypeScale } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { PIN_LENGTH } from '../logic/profiles/pin-hash';
import type { PinPadLayout } from '../logic/profiles/pin-pad-layout';

/** Gap between keys, both axes. Callers pass the same value to `pinPadLayout`. */
export const PIN_PAD_GAP = spacing.sm;

const KEYS: Array<number | 'delete'> = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 'delete'];

interface PinPadProps {
  /** The digits entered so far. Never echoed as text — the caller draws the dots (F-PROF-001 §3.5). */
  value: string;
  onChange: (next: string) => void;
  /** Digit keys stop responding (cooldown, or a hash in flight). Delete also stops when `value` is empty. */
  disabled?: boolean;
  /** From `pinPadLayout` (pin-pad-layout.ts): the caller owns the measuring and the budget. */
  layout: PinPadLayout;
  testID?: string;
}

/**
 * The grown-up PIN key grid, extracted from `PinEntryScreen` (F-LEARN-001 §3.4)
 * so the onboarding card can reuse it. Presentational: the dots, the hint and
 * the Next/Unlock button stay with the caller. Labels `Digit n` and
 * `Delete last digit` are part of the e2e contract (layout.spec.ts).
 * Design reference: design/wireframes/onboarding/all-ages-onboarding.md, section D.
 */
export function PinPad({ value, onChange, disabled = false, layout, testID }: PinPadProps): React.ReactElement {
  const textScale = useTypeScale();
  const m = useMessages().a11y;
  const gridWidth = layout.columns * layout.keySize + (layout.columns - 1) * PIN_PAD_GAP;

  return (
    <View
      testID={testID}
      style={{
        width: gridWidth,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: PIN_PAD_GAP,
        justifyContent: 'center',
      }}
    >
      {KEYS.map((k) =>
        k === 'delete' ? (
          <Pressable
            key={k}
            disabled={value.length === 0 || disabled}
            onPress={() => onChange(value.slice(0, -1))}
            accessibilityRole="button"
            accessibilityLabel={m.pinDelete}
            style={{
              width: layout.keySize,
              height: layout.keySize,
              borderRadius: radii.lg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="arrow-left" size={24} color={colors.text.secondary} />
          </Pressable>
        ) : (
          <Pressable
            key={k}
            disabled={disabled}
            onPress={() => onChange((value + String(k)).slice(0, PIN_LENGTH))}
            accessibilityRole="button"
            accessibilityLabel={m.pinDigit(k)}
            style={{
              width: layout.keySize,
              height: layout.keySize,
              borderRadius: radii.lg,
              backgroundColor: colors.surface.paper,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.border.strong,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.title, fontWeight: '700', color: colors.text.primary }}>{k}</Text>
          </Pressable>
        ),
      )}
    </View>
  );
}
