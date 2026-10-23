import { Body, Card, Hoya, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import type { GoalMoment } from '../../store/goals';

/**
 * A goal moment on the Results of the activity that reached it (F-CURR-002 section 7.4, row CM-17;
 * design/wireframes/home/goal-ring-weekly-dots.md E): one line each, Hoya cheering. Not a target; the telemetry is
 * sent by the points logic, never by the banner. A week that latched through a sync or a goal change has none.
 */
export function GoalMomentBanner({ moment }: { moment: GoalMoment | null }): React.ReactElement | null {
  const messages = useMessages();
  const g = messages.learner.goals.banner;
  if (moment === null || (!moment.dayMet && moment.weekMet === null)) return null;
  return (
    <Card padding="md" tone="success" testID="results-goal-moment">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }} accessibilityLiveRegion="polite">
        <Hoya pose="cheering" size={spacing.xxxl} accessibilityLabel={messages.a11y.hoya('cheering')} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          {moment.dayMet ? <Body weight="semibold">{g.dayMet}</Body> : null}
          {moment.weekMet !== null ? <Body weight="semibold">{g.weekMet(moment.weekMet)}</Body> : null}
        </View>
      </View>
    </Card>
  );
}
