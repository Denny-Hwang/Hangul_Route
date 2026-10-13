import React from 'react';
import { View } from 'react-native';
import { colors, radii, spacing } from '../../tokens';
import { Caption } from '../Heading';
import { TagMark } from './RouteLegend';

export interface RouteTagProps {
  /** `next`: the word only (its shape is the triangle over the row's number, E3-D D6); `inPlan`: the solid ring and the word. */
  kind: 'next' | 'inPlan';
  /** The tag's word in the UI locale (`learner.routeNext.tag.*`). */
  label: string;
  testID?: string;
}

/**
 * The tag chip of an episode row, a Library tile or a Learning Route cell row (F-ENT-003 section
 * 3.7; design/components/RouteMarkers "Tags, captions and tiles"): `TagChip`'s look, a pill with
 * Caption semibold `text.primary`. "Next" sits on `brand.primaryLight` with the word only; "In
 * your plan" on `surface.sunken` with the 16 dp solid ring before the word. Hidden from screen
 * readers: the row's own label reads the tags as words.
 */
export function RouteTag({ kind, label, testID }: RouteTagProps): React.ReactElement {
  return (
    <View
      testID={testID}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radii.pill,
        backgroundColor: kind === 'next' ? colors.brand.primaryLight : colors.surface.sunken,
      }}
    >
      {kind === 'inPlan' ? <TagMark kind="inPlan" /> : null}
      <Caption tone="primary" weight="semibold">
        {label}
      </Caption>
    </View>
  );
}
