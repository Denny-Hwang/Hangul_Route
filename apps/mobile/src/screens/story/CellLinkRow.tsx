import { Body, Icon, borderWidth, colors, radii, spacing, touchTarget, type IconName } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, View } from 'react-native';

/**
 * A quiet secondary row that leads to one place (F-STORY-005 §3.6): the lesson page's "Heritage stories
 * for this cell" row (wireframe design/wireframes/episode/detail-cell-stories-row.md C) and the cell
 * page's lesson row (design/wireframes/story/cell-stories.md B). Paper, a subtle border, >= 64 tall,
 * an optional plain count and a chevron; never the page's primary action.
 */
export function CellLinkRow({
  label,
  accessibilityLabel,
  count,
  icon,
  onPress,
  testID,
}: {
  label: string;
  /** The whole row's label when it says more than `label` (the count). */
  accessibilityLabel?: string;
  /** A plain number, never "N of M". */
  count?: string;
  icon?: IconName;
  onPress: () => void;
  testID?: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={{
        minHeight: touchTarget.min,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface.paper,
        borderRadius: radii.lg,
        borderWidth: borderWidth.thin,
        borderColor: colors.border.subtle,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {icon ? <Icon name={icon} size={spacing.xl} color={colors.text.secondary} /> : null}
        <View style={{ flex: 1 }}>
          <Body weight="semibold">{label}</Body>
        </View>
        {count !== undefined ? <Body weight="bold">{count}</Body> : null}
        <Icon name="arrow-right" size={spacing.xl} color={colors.text.secondary} />
      </View>
    </Pressable>
  );
}
