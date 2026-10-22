import { Button, Card, Heading, Spacer, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { DAILY_TIERS, type DailyGoal } from '../../logic/goals/points';
import { tierLabelOf } from '../../logic/goals/strip-view';

/**
 * The first choice (F-CURR-002 section 7.4, row CM-17; design/wireframes/home/goal-ring-weekly-dots.md D): once,
 * on Home, after the first finished activity and never on the visit the weekly plan prompt shows. It asks only the
 * daily time (the plan asks the days). A choice saves the goals and sends `goal.set`; Not now keeps Light (the
 * default) without asking again. Either way it goes away for good.
 */
export interface GoalFirstChoiceProps {
  onChoose: (daily: DailyGoal) => void;
  onLater: () => void;
}

export function GoalFirstChoice({ onChoose, onLater }: GoalFirstChoiceProps): React.ReactElement {
  const g = useMessages().learner.goals;
  return (
    <Card padding="md" tone="sunken" testID="home-goal-first">
      <Heading level="prompt">{g.first.title}</Heading>
      <Spacer size="sm" />
      <View style={{ gap: spacing.sm }}>
        {DAILY_TIERS.map(({ tier, points }) => (
          <Button key={tier} label={tierLabelOf(tier, g)} tone="secondary" size="md" fullWidth onPress={() => onChoose(points)} testID={`goal-first-${tier}`} />
        ))}
        <Button label={g.first.later.cta} tone="ghost" size="md" fullWidth onPress={onLater} testID="goal-first-later" />
      </View>
    </Card>
  );
}
