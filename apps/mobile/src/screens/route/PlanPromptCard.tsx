import { Body, Button, Card, Spacer, spacing } from '@hangul-route/design-system';
import type { InboxPlan, Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { dayKey } from '../../logic/homework/mission-builder';
import { questsDoneOf } from '../../logic/placement/entry';
import { hasPlanNow } from '../../logic/plan-free-lines';
import { effectiveLearnerType } from '../../logic/profiles/learner-type';
import { movedLineVisible, planSlotOf, type PlanSlot } from '../../logic/route/home-slot';
import { newestResultAt, planPromptEligible, proposalSkippedEvent } from '../../logic/route/proposal-flow';
import { checkInOffer } from '../../logic/route/repace';
import { activeSelfRoute } from '../../logic/route/self-route';
import { track } from '../../platform/telemetry';
import { usePlanStore } from '../../store/plan-store';
import { useRouteStore } from '../../store/route-store';
import { LinkButton } from '../placement/parts';
import { CheckInCard, useShownOffer } from './CheckInCard';

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

/**
 * Home's one quiet card for the weekly plan (F-PLAN-002 sections 3.7 and 3.9): the prompt before a
 * plan exists; with a plan, the Hoya check-in of week 5 (FP-B14) or, once after an automatic
 * re-pace, "Hoya moved your plan along". A card that appeared stays for this visit while it is
 * answered or read; the moved line is marked seen when it first shows.
 */
export function usePlanSlot(
  profile: Profile | null,
  snapshot: ProgressSnapshot | undefined,
  plans: readonly InboxPlan[] | undefined,
): PlanSlot | null {
  const prompt = usePlanPrompt(profile, snapshot, plans);
  const profileId = profile?.id ?? null;
  const ui = useRouteStore((s) => (profileId === null ? undefined : s.ui[profileId]));
  const today = useMemo(() => dayKey(new Date().toISOString()), []);
  const active = flags.routeEnabled ? activeSelfRoute(snapshot) : null;
  const offer =
    active === null || ui === undefined || snapshot === undefined
      ? null
      : checkInOffer({ route: active, completedQuestIds: snapshot.quests.filter((q) => q.completedAt !== undefined).map((q) => q.questId), today, answeredFor: ui.checkInFor });
  const [shownOffer] = useShownOffer(offer);
  const [moved, setMoved] = useState(false);
  const movedNow = active !== null && ui !== undefined && movedLineVisible(ui);
  useEffect(() => {
    if (!movedNow || profileId === null) return;
    setMoved(true);
    void useRouteStore.getState().markMovedSeen(profileId, new Date().toISOString());
  }, [movedNow, profileId]);
  return planSlotOf({ prompt, offer: shownOffer, moved: moved && active !== null });
}

/** The card of Home's plan slot. */
export function PlanSlotCard({
  slot,
  profileId,
  onOpen,
  onOverview,
}: {
  slot: PlanSlot;
  profileId: string;
  /** The proposal (Make my plan). */
  onOpen: () => void;
  /** The overview (See my plan). */
  onOverview: () => void;
}): React.ReactElement | null {
  const t = useMessages().learner.weeklyPlan.homeMoved;
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  if (slot.kind === 'prompt') return <PlanPromptCard profileId={profileId} onOpen={onOpen} />;
  if (slot.kind === 'check-in') return <CheckInCard profileId={profileId} offer={slot.offer} onClose={() => setClosed(true)} testID="home-plan-check-in" />;
  return (
    <Card padding="md" tone="sunken" testID="home-plan-moved">
      <Body weight="semibold">{t.line}</Body>
      <Spacer size="sm" />
      <Button label={t.open.cta} tone="ghost" size="md" onPress={onOverview} testID="home-plan-moved-open" />
    </Card>
  );
}
