import { Body, Caption, Card, Icon, PipRow, Spacer, StageSegments, colors, spacing, touchTarget, typography, useTypeScale } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import type { HomeStripView } from '../../logic/my-route/home-strip';

/**
 * The Home route strip (F-ROUTE-001 R-4b, section 3.1 entry 2; amendment
 * LR-A6). One tappable card in place of the old "Stage 1 progress" bar:
 * the title Learning Route with a chevron, where the learner is, the goal
 * line when a goal exists, the `here` stage's pips, the seven-segment overview
 * of the whole journey (`StageSegments`), and the weekly plan week when a plan runs. Wireframes: `design/wireframes/journey/learning-route.md` H,
 * `design/wireframes/journey/my-route-overview.md` D; the pips:
 * `design/components/PipRow/spec.md`. The card reads as one button; the drawn
 * pips and segments are hidden from screen readers (the label carries the words,
 * including the here stage's progress caption).
 */
export function RouteStrip({ view, onPress }: { view: HomeStripView; onPress: () => void }): React.ReactElement {
  const textScale = useTypeScale();
  const segments = view.segments.map((s) => ({ key: s.stage, state: s.state, here: s.here, accent: colors.stage[s.stage] }));
  return (
    <Card padding="md" tone="paper" onPress={onPress} accessibilityLabel={view.a11yLabel} testID="home-route-strip">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget.min }}>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xxs }}>
          {/* Not a Heading: a header role inside the button would hide it from heading navigation. */}
          <Body weight="bold" style={{ fontSize: textScale.size.prompt, lineHeight: textScale.size.prompt * typography.leading.tight }}>
            {view.title}
          </Body>
          <Body weight="semibold">{view.here}</Body>
          {view.goal !== null ? <Body tone="secondary">{view.goal}</Body> : null}
        </View>
        <Icon name="arrow-right" size={24} color={colors.text.muted} />
      </View>
      {view.groups.length > 0 ? (
        <>
          <Spacer size="sm" />
          <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <PipRow groups={view.groups} context="stage" accent={colors.stage[view.stage]} testID="home-route-strip-pips" />
          </View>
        </>
      ) : null}
      <Spacer size="md" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: spacing.sm, rowGap: spacing.xxs }}>
        <StageSegments segments={segments} testID="home-route-strip-segments" />
        <Caption tone="muted">{view.segmentsLabel}</Caption>
      </View>
      {view.week !== null ? (
        <>
          <Spacer size="sm" />
          <Caption tone="muted">{view.week}</Caption>
        </>
      ) : null}
    </Card>
  );
}
