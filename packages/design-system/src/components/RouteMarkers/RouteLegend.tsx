import React from 'react';
import { Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { colors, spacing, typography } from '../../tokens';
import { PipParts } from '../PipRow/Pip';
import { ROUTE_MARK_ORDER, TAG_MARK_SIZE, tagMarkParts, type RouteMarkKind } from './geometry';

export interface TagMarkProps {
  kind: RouteMarkKind;
  testID?: string;
}

/** One 16 dp mark (the legend, and the chips of later rows). Decorative: its word sits next to it. */
export function TagMark({ kind, testID }: TagMarkProps): React.ReactElement {
  return (
    <View
      testID={testID}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      style={{ width: TAG_MARK_SIZE, height: TAG_MARK_SIZE }}
    >
      <Svg width={TAG_MARK_SIZE} height={TAG_MARK_SIZE} viewBox={`0 0 ${TAG_MARK_SIZE} ${TAG_MARK_SIZE}`}>
        <PipParts parts={tagMarkParts(kind)} accent={colors.border.shape} />
      </Svg>
    </View>
  );
}

export interface RouteLegendItem {
  kind: RouteMarkKind;
  /** The mark's word in the UI locale (the app passes its messages). */
  label: string;
}

export interface RouteLegendProps {
  /** The marks the grid draws now; empty draws nothing. */
  items: readonly RouteLegendItem[];
  testID?: string;
}

/**
 * The Journey legend line (F-ENT-003 section 3.7, E3-D D4): each mark the grid draws with its
 * word, in the order Next, In your plan, Not open yet, so the words are on the page. Not a
 * control and no background. Hidden from screen readers, because every cell label carries them.
 */
export function RouteLegend({ items, testID }: RouteLegendProps): React.ReactElement | null {
  if (items.length === 0) return null;
  const ordered = [...items].sort((a, b) => ROUTE_MARK_ORDER.indexOf(a.kind) - ROUTE_MARK_ORDER.indexOf(b.kind));
  return (
    <View
      testID={testID}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs, marginBottom: spacing.md }}
    >
      {ordered.map((item) => (
        <View key={item.kind} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <TagMark kind={item.kind} />
          <Text
            style={{
              fontSize: typography.size.bodySm,
              lineHeight: typography.size.bodySm * typography.leading.normal,
              fontWeight: typography.weight.semibold,
              color: colors.text.secondary,
            }}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
