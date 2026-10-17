import { Body, Caption, Heading, Icon, Pill, Spacer, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, View } from 'react-native';
import type { NextLessonRowView } from '../../logic/my-route/next-lessons';

/**
 * The Route tab's next lessons (owner decision 2026-10-17; wireframe `design/wireframes/journey/route-tab-collapsed.md`
 * Panel D, as-built notes `design/screens/learning-route/route-tab-collapsed.md` "Revision 2026-10-17"): under the
 * route card, the lesson its button starts and the two after it, in route order. Each row is one button of at least
 * `touchTarget.min` that opens its lesson; its name reads the tag, the title and where it sits. No count of what is
 * left, no ratio, no "Open" word (every row is a lesson the learner can start).
 */
export function NextLessons({ title, rows, onOpen }: { title: string; rows: readonly NextLessonRowView[]; onOpen: (row: NextLessonRowView) => void }): React.ReactElement | null {
  if (rows.length === 0) return null;
  return (
    <View testID="my-route-next-lessons">
      <Heading level="prompt">{title}</Heading>
      <Spacer size="sm" />
      <View role="list" style={{ gap: spacing.sm }}>
        {rows.map((row) => (
          <View key={row.key} role="listitem">
            <Pressable
              onPress={() => onOpen(row)}
              accessibilityRole="button"
              accessibilityLabel={row.a11yLabel}
              testID={`my-route-next-lesson-${row.questId}`}
              style={({ pressed }) => ({
                minHeight: touchTarget.min,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radii.lg,
                borderWidth: borderWidth.base,
                borderColor: row.first ? colors.brand.primary : colors.border.subtle,
                backgroundColor: pressed ? colors.surface.sunken : colors.surface.paper,
              })}
            >
              <View style={{ flex: 1, gap: spacing.xxs }}>
                {row.tag !== null ? (
                  <View style={{ alignSelf: 'flex-start' }}>
                    <Pill label={row.tag} tone={row.first ? 'primary' : 'info'} size="sm" />
                  </View>
                ) : null}
                <Body weight="semibold">{row.title}</Body>
                <Caption tone="muted">{row.where}</Caption>
              </View>
              <Icon name="arrow-right" size={24} color={colors.text.muted} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
