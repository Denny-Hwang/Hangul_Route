import { Body, Button, Card, Spacer, spacing } from '@hangul-route/design-system';
import type { InboxPlan, Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { View } from 'react-native';
import { flags, routeEnabledFor } from '../../config/flags';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { questsDoneOf } from '../../logic/placement/entry';
import { selfRouteResting, sourcesOf } from '../../logic/homework/plan-derivation';
import { hasPlanNow } from '../../logic/plan-free-lines';
import { effectiveLearnerType } from '../../logic/profiles/learner-type';
import { movedLineVisible, planSlotOf, type PlanSlot } from '../../logic/route/home-slot';
import { layerOf, ownPlanBackShows } from '../../logic/route/layer';
import { newestResultAt, planPromptEligible, proposalSkippedEvent } from '../../logic/route/proposal-flow';
import { activeSelfRoute } from '../../logic/route/self-route';
import { track } from '../../platform/telemetry';
import { usePlanStore } from '../../store/plan-store';
import { useProgressStore } from '../../store/progress-store';
import { useRouteStore } from '../../store/route-store';
import { LinkButton } from '../../components/LinkButton';
import { CheckInCard, useCheckInOffer, useShownOffer } from './CheckInCard';
import { OwnBackLine, ProposalInsteadCard } from './BlendParts';
import { usePlanChangesOpen } from './use-plan-gate';
import { useToday } from './use-today';

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
): { prompt: boolean; instead: boolean } {
  const profileId = profile?.id ?? null;
  // P2-8b: the flag and a UI locale whose weekly plan words are reviewed (en only for now).
  const enabled = routeEnabledFor(useLocale());
  const ui = useRouteStore((s) => (profileId === null ? undefined : s.ui[profileId]));
  const today = useToday();
  useFocusEffect(
    useCallback(() => {
      if (!enabled || profileId === null) return undefined;
      void useRouteStore.getState().loadUi(profileId);
      void usePlanStore.getState().hydrate(profileId);
      return undefined;
    }, [enabled, profileId]),
  );
  if (!enabled || profile === null || ui === undefined || plans === undefined || snapshot === undefined) return NO_PROMPT;
  const input = {
    enabled,
    learnerType: effectiveLearnerType(profile),
    hasPlan: hasPlanNow(plans, snapshot),
    questsDone: questsDoneOf(snapshot.quests),
    newestResultAt: newestResultAt(snapshot.placements),
    dismissedAt: ui.dismissedAt,
    nowMs: Date.now(),
  };
  // No proposal while the class plan has practice days (AMENDMENTS-ROUTE-CLASS-BLEND section 8); with the switch on
  // (row BL-7) its line says so instead, where the prompt would have been.
  const layer = layerOf(sourcesOf(plans, null), today);
  const prompt = planPromptEligible({ ...input, layer });
  const instead = flags.routeBlendEnabled && layer === 'class-with-practice' && planPromptEligible({ ...input, layer: 'solo' });
  return { prompt, instead };
}

const NO_PROMPT = { prompt: false, instead: false } as const;

/** Not now on Home's prompt (or its class-plan line): hidden for 14 days or until the next result (OD-16). */
function notNow(profileId: string): void {
  void useRouteStore.getState().markDismissed(profileId, new Date().toISOString());
  const event = proposalSkippedEvent(profileId, 'home');
  void track({ name: event.name, profileId, payload: { ...event.payload } });
}

/**
 * The quiet card "Hoya can make a weekly plan for you" with **Make my plan** and **Not now**
 * (AM-6; wireframe journey/my-route-overview.md D and FP-B13: the prompt only, no week dots).
 */
export function PlanPromptCard({ profileId, onOpen }: { profileId: string; onOpen: () => void }): ReactElement {
  const t = useMessages().learner.weeklyPlan.homePrompt;
  return (
    <Card padding="md" tone="sunken" testID="home-plan-prompt">
      <Body weight="semibold">{t.line}</Body>
      <Spacer size="sm" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Button label={t.make.cta} tone="ghost" size="md" onPress={onOpen} testID="home-plan-prompt-open" />
        <LinkButton
          label={t.notNow.cta}
          onPress={() => notNow(profileId)}
          testID="home-plan-prompt-not-now"
        />
      </View>
    </Card>
  );
}

/** Home's plan slot: the card it holds, and how a check-in card is put away (Not now, or answered). */
export interface PlanSlotState {
  slot: PlanSlot | null;
  closeCheckIn: () => void;
}

/**
 * Home's one quiet card for the weekly plan (F-PLAN-002 sections 3.7 and 3.9): the prompt before a
 * plan exists; with a plan, the Hoya check-in of week 5 (FP-B14) or, once after an automatic
 * re-pace, "Hoya moved your plan along". A child's check-in shows only while the grown-up gate is
 * open (section 3.9). Home stays mounted, so the slot is looked at again each
 * time Home comes into focus: a check-in answered here (its "now N days a week" line) or on the
 * overview leaves, and a moved line that was drawn and marked seen does not come back.
 */
export function usePlanSlot(
  profile: Profile | null,
  snapshot: ProgressSnapshot | undefined,
  plans: readonly InboxPlan[] | undefined,
): PlanSlotState {
  const { prompt, instead } = usePlanPrompt(profile, snapshot, plans);
  const profileId = profile?.id ?? null;
  const ui = useRouteStore((s) => (profileId === null ? undefined : s.ui[profileId]));
  const today = useToday();
  const active = routeEnabledFor(useLocale()) ? activeSelfRoute(snapshot) : null;
  // A child's check-in waits for the grown-up gate (section 3.9): yes changes the plan a grown-up set.
  const changesOpen = usePlanChangesOpen(profile);
  const resting = selfRouteResting(plans ?? [], active, today);
  const offer = useCheckInOffer({ route: active, quests: snapshot?.quests, today, ready: ui !== undefined && snapshot !== undefined, answeredFor: ui?.checkInFor, changesOpen, resting });
  const [shownOffer, closeOffer] = useShownOffer(offer, `${profileId ?? ''}|${active?.id ?? ''}`);
  const [moved, setMoved] = useState(false);
  const movedNow = active !== null && ui !== undefined && movedLineVisible(ui);
  // Kept for this visit; it is marked seen only by the card that draws it (`MovedLine`), so a line the
  // check-in or the level check kept off the slot still shows later.
  useEffect(() => {
    if (movedNow) setMoved(true);
  }, [movedNow]);
  // Back on Home: put away a check-in that is answered (here or on the overview) and a moved line already seen.
  useFocusEffect(
    useCallback(() => {
      if (profileId === null) return undefined;
      const stored = useRouteStore.getState().ui[profileId];
      const current = activeSelfRoute(useProgressStore.getState().byProfile[profileId]);
      if (stored !== undefined && current !== null && stored.checkInFor === current.id) closeOffer();
      if (stored === undefined || !movedLineVisible(stored)) setMoved(false);
      return undefined;
    }, [profileId, closeOffer]),
  );
  // "Your own weekly plan is back." once after the rested plan comes back (section 8, row BL-7).
  const back = flags.routeBlendEnabled && active !== null && ui !== undefined && ownPlanBackShows(ui);
  return { slot: planSlotOf({ prompt, instead, offer: shownOffer, back, moved: moved && active !== null }), closeCheckIn: closeOffer };
}

/** The card of Home's plan slot. */
export function PlanSlotCard({
  slot,
  profileId,
  onOpen,
  onOverview,
  onCloseCheckIn,
}: {
  slot: PlanSlot;
  profileId: string;
  /** The proposal (Make my plan). */
  onOpen: () => void;
  /** The overview (See my plan). */
  onOverview: () => void;
  /** Not now on the check-in, or an answer that came too late: the slot lets the card go. */
  onCloseCheckIn: () => void;
}): ReactElement | null {
  if (slot.kind === 'prompt') return <PlanPromptCard profileId={profileId} onOpen={onOpen} />;
  if (slot.kind === 'instead') return <ProposalInsteadCard onNotNow={() => notNow(profileId)} />;
  if (slot.kind === 'back') return <OwnBackLine profileId={profileId} onOverview={onOverview} />;
  if (slot.kind === 'check-in') return <CheckInCard key={profileId} profileId={profileId} offer={slot.offer} onClose={onCloseCheckIn} testID="home-plan-check-in" />;
  return <MovedLine profileId={profileId} onOverview={onOverview} />;
}

/** "Hoya moved your plan along" with See my plan; drawing it marks the line seen (section 3.7). */
function MovedLine({ profileId, onOverview }: { profileId: string; onOverview: () => void }): ReactElement {
  const t = useMessages().learner.weeklyPlan.homeMoved;
  useEffect(() => {
    void useRouteStore.getState().markMovedSeen(profileId, new Date().toISOString());
  }, [profileId]);
  return (
    <Card padding="md" tone="sunken" testID="home-plan-moved">
      <Body weight="semibold">{t.line}</Body>
      <Spacer size="sm" />
      <Button label={t.open.cta} tone="ghost" size="md" onPress={onOverview} testID="home-plan-moved-open" />
    </Card>
  );
}
