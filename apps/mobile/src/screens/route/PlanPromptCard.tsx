import { Body, Button, Card, Spacer, spacing } from '@hangul-route/design-system';
import type { InboxPlan, Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { questsDoneOf } from '../../logic/placement/entry';
import { hasPlanNow } from '../../logic/plan-free-lines';
import { effectiveLearnerType } from '../../logic/profiles/learner-type';
import { newestResultAt, planPromptEligible, proposalSkippedEvent } from '../../logic/route/proposal-flow';
import { track } from '../../platform/telemetry';
import { usePlanStore } from '../../store/plan-store';
import { useRouteStore } from '../../store/route-store';
import { LinkButton } from '../placement/parts';

/**
 * Whether Home's quiet slot may show the weekly-plan prompt (F-PLC-001 AM-6, F-PLAN-002
 * section 3.9): the flag, a self profile, no plan yet (inbox or own), a finished quest or a
 * placement result, and no Not now in the last 14 days unless a result came after it (OD-16).
 * Reads `route-ui:<profileId>` and the cached plans on focus; false until both are known, so
 * the prompt never flashes in front of a plan that is still loading.
 */
export function usePlanPrompt(
  profile: Profile | null,
  snapshot: ProgressSnapshot | undefined,
  plans: readonly InboxPlan[] | undefined,
): boolean {
  const profileId = profile?.id ?? null;
  const ui = useRouteStore((s) => (profileId === null ? undefined : s.ui[profileId]));
  useFocusEffect(
    useCallback(() => {
      if (!flags.routeEnabled || profileId === null) return undefined;
      void useRouteStore.getState().loadUi(profileId);
      void usePlanStore.getState().hydrate(profileId);
      return undefined;
    }, [profileId]),
  );
  if (!flags.routeEnabled || profile === null || ui === undefined || plans === undefined || snapshot === undefined) return false;
  return planPromptEligible({
    enabled: flags.routeEnabled,
    learnerType: effectiveLearnerType(profile),
    hasPlan: hasPlanNow(plans, snapshot),
    questsDone: questsDoneOf(snapshot.quests),
    newestResultAt: newestResultAt(snapshot.placements),
    dismissedAt: ui.dismissedAt,
    nowMs: Date.now(),
  });
}

/**
 * The quiet card "Hoya can make a weekly plan for you" with **Make my plan** and **Not now**
 * (AM-6; wireframe journey/my-route-overview.md D and FP-B13: the prompt only, no week dots).
 */
export function PlanPromptCard({ profileId, onOpen }: { profileId: string; onOpen: () => void }): React.ReactElement {
  const t = useMessages().learner.weeklyPlan.homePrompt;
  return (
    <Card padding="md" tone="sunken" testID="home-plan-prompt">
      <Body weight="semibold">{t.line}</Body>
      <Spacer size="sm" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Button label={t.make.cta} tone="ghost" size="md" onPress={onOpen} testID="home-plan-prompt-open" />
        <LinkButton
          label={t.notNow.cta}
          onPress={() => {
            void useRouteStore.getState().markDismissed(profileId, new Date().toISOString());
            const event = proposalSkippedEvent(profileId, 'home');
            void track({ name: event.name, profileId, payload: { ...event.payload } });
          }}
          testID="home-plan-prompt-not-now"
        />
      </View>
    </Card>
  );
}
