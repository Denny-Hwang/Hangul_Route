import { Body, Button, Caption, Card, Icon, Spacer, colors, spacing, touchTarget } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { useRouteStore } from '../../store/route-store';

/**
 * The learner's class days and practice days pieces (AMENDMENTS-ROUTE-CLASS-BLEND sections 7 and 8, row BL-7;
 * design/wireframes/journey/route-class-blend.md B1 to B6, mocks design/screens/route-blend/). The screens draw them
 * only while `flags.routeBlendEnabled` is on and the learner is in the Class with practice layer. Neutral facts:
 * no count, no date, no question about going to class, never a to-do.
 */

/** B1: the weekly plan line under the route card; one text node (`weeklyPlanLine`). */
export function BlendPlanLine({ text }: { text: string }): ReactElement {
  return (
    <Body tone="secondary" testID="my-route-blend-line">
      {text}
    </Body>
  );
}

/** B2: one calm line above card (2) on a class day; no button and no question. */
export function ClassTodayLine(): ReactElement {
  return <Body testID="home-class-today">{useMessages().learner.route.blend.classToday}</Body>;
}

/**
 * B3: Refresh in card (2), after the day's lessons or as the day's only step. One tappable row at the hero height,
 * its accessible name "Refresh: look back at what class taught"; no count and no check mark.
 */
export function RefreshCard({ onPress }: { onPress: () => void }): ReactElement {
  const m = useMessages();
  const words = m.learner.route.blend;
  return (
    <Card padding="md" onPress={onPress} accessibilityLabel={m.a11y.route.blend.refresh} testID="home-refresh">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget.min }}>
        <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Icon name="replay" size={32} color={colors.text.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Body weight="semibold" size="lg">
            {words.refresh}
          </Body>
          <Caption tone="muted">{words.refreshLine}</Caption>
        </View>
      </View>
    </Card>
  );
}

/** Home's plan slot while the class plan has practice days and there is no own plan (B6): the line, and Not now. */
export function ProposalInsteadCard({ onNotNow }: { onNotNow: () => void }): ReactElement {
  const m = useMessages();
  return (
    <Card padding="md" tone="sunken" testID="home-plan-instead">
      <Body weight="semibold">{m.learner.route.blend.proposalInstead}</Body>
      <Spacer size="sm" />
      <View style={{ alignItems: 'flex-start' }}>
        <Button label={m.learner.weeklyPlan.homePrompt.notNow.cta} tone="ghost" size="md" onPress={onNotNow} testID="home-plan-instead-not-now" />
      </View>
    </Card>
  );
}

/** "Your own weekly plan is back." once, after the class plan ends (section 8); drawing it marks it seen. */
export function OwnBackLine({ profileId, onOverview }: { profileId: string; onOverview: () => void }): ReactElement {
  const m = useMessages();
  useEffect(() => {
    void useRouteStore.getState().markBackSeen(profileId, new Date().toISOString());
  }, [profileId]);
  return (
    <Card padding="md" tone="sunken" testID="home-plan-back">
      <Body weight="semibold">{m.learner.route.blend.ownBack}</Body>
      <Spacer size="sm" />
      <Button label={m.learner.weeklyPlan.homeMoved.open.cta} tone="ghost" size="md" onPress={onOverview} testID="home-plan-back-open" />
    </Card>
  );
}

/**
 * Profile's weekly plan row words in the Class with practice layer (B5, B6): the resting line with **See it**
 * (the read-only overview), or the proposal line above Make a weekly plan.
 */
export function PlanRowBlendLine({ kind, onSeeIt }: { kind: 'resting' | 'instead'; onSeeIt: () => void }): ReactElement {
  const words = useMessages().learner.route.blend;
  if (kind === 'instead') {
    return (
      <Body tone="secondary" testID="profile-plan-instead">
        {words.proposalInstead}
      </Body>
    );
  }
  return (
    <View style={{ gap: spacing.sm }} testID="profile-plan-resting">
      <Body tone="secondary">{words.ownResting}</Body>
      <View style={{ alignItems: 'flex-start' }}>
        <Button label={words.seeIt} tone="ghost" size="md" onPress={onSeeIt} testID="profile-plan-see-it" />
      </View>
    </View>
  );
}

/**
 * Profile -> weekly plan: the My practice days row (row BL-8, wireframe B7). Always reachable while the class plan
 * with practice days leads; a child's change goes through the grown-up gate on the screen itself.
 */
export function PracticeDaysRow({ onOpen }: { onOpen: () => void }): ReactElement {
  const words = useMessages().learner.route.blend.practiceDays;
  return (
    <Pressable
      testID="profile-practice-days"
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={words.title}
      style={{ minHeight: touchTarget.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}
    >
      <Body weight="semibold" style={{ flex: 1 }}>
        {words.title}
      </Body>
      <Icon name="arrow-right" size={24} color={colors.text.muted} />
    </Pressable>
  );
}
