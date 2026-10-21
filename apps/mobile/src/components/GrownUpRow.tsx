import { Body, Caption, Icon, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, View } from 'react-native';

export interface GrownUpRowProps {
  /** The generic label only: the zone name, Family, Teacher, School, Sign in as a grown-up; never an account name (CS-7). */
  label: string;
  /** The lock glyph: false only where no PIN guards the row (a self-only device without a PIN). */
  locked: boolean;
  /** Offline (web): every use row but the Grown-up area. */
  disabled?: boolean;
  /**
   * A line under the label (the `nopin` caption, Needs the internet): the row's description, never in the name; the
   * accessibility hint on native and `aria-describedby` on the web (react-native-web maps no hint to the DOM).
   */
  caption?: string | null;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}

/**
 * [OA] One grown-up use on "Who is using this?" (component spec `design/components/GrownUpRow/spec.md`,
 * AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 6.1, 12, 14, row OA-4a): visibly secondary to the learner tiles, a lock
 * glyph, the generic label and a chevron, at least `touchTarget.min` high. A disabled row stays in the reading order
 * and says why. The caption is the row's description, so the name is the label (and the PIN) alone.
 */
export function GrownUpRow({ label, locked, disabled = false, caption = null, accessibilityLabel, onPress, testID }: GrownUpRowProps): React.ReactElement {
  const captionId = `grown-up-row-caption${React.useId().replace(/:/g, '-')}`;
  const describedBy = caption ? { 'aria-describedby': captionId } : {};
  return (
    <Pressable
      {...describedBy}
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={caption ?? undefined}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      style={({ pressed }) => ({
        minHeight: touchTarget.min,
        borderRadius: radii.md,
        borderWidth: borderWidth.thin,
        borderColor: disabled ? colors.border.subtle : colors.border.strong,
        backgroundColor: disabled || pressed ? colors.surface.sunken : colors.surface.paper,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      })}
    >
      {locked ? <Icon name="lock" size={24} color={colors.text.secondary} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Body weight="semibold" tone={disabled ? 'muted' : 'primary'}>
          {label}
        </Body>
        {caption ? (
          <View nativeID={captionId} {...{ id: captionId }}>
            <Caption tone="secondary" testID={testID === undefined ? undefined : `${testID}-caption`}>
              {caption}
            </Caption>
          </View>
        ) : null}
      </View>
      {disabled ? null : <Icon name="arrow-right" size={24} color={colors.text.secondary} />}
    </Pressable>
  );
}
