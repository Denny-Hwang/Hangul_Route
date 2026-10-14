import type { DurationId, RouteProposal, SelfRoute, StageKey } from '@hangul-route/content-schema';
import { dayKey } from '../logic/homework/mission-builder';
import { draftOfOffer, planChangeAt, planOfferOf, updatedEvent, updatedRouteOf, type PlanOffer } from '../logic/placement/plan-offer';
import type { ProposalContext } from '../logic/route/proposal-flow';
import { activeSelfRoute } from '../logic/route/self-route';
import { track } from '../platform/telemetry';
import { unlockedStagesFor, usePlanStore } from './plan-store';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';
import { useRouteStore } from './route-store';

/**
 * The weekly plan after a level check (F-PLC-001 P-7b): reads the offer for a profile from the
 * stores, makes the plan with one tap (no PIN for the learner's own plan, OD-14; the grown-up
 * is already through the gate on the report) and applies the update after a retake that
 * raised the start (AM-2). The pure rules live in `logic/placement/plan-offer`.
 */

/** `proposeRoute`'s context for a profile now; null without the profile or its snapshot. */
export function proposalContextFor(profileId: string, now: Date): ProposalContext | null {
  const profile = useProfileStore.getState().profiles.find((p) => p.id === profileId);
  const snapshot = useProgressStore.getState().byProfile[profileId];
  if (profile === undefined || snapshot === undefined) return null;
  return {
    placements: snapshot.placements,
    completedQuestIds: snapshot.quests.filter((q) => q.completedAt !== undefined).map((q) => q.questId),
    ageGroup: profile.ageGroup,
    unlockedStages: unlockedStagesFor(now, profileId) as StageKey[],
    today: dayKey(now.toISOString()),
  };
}

/**
 * Where the offer shows. The learner's result strip follows the plan prompt's dismissal (Not now,
 * Just start; AM-6); the grown-up report card has its own Not now, so a learner's skip never hides
 * the grown-up's first look at the plan (AM-1).
 */
export type OfferSurface = 'learner' | 'report';

/**
 * The offer for a profile from what the stores hold now (the marks as last read by `loadUi`):
 * `enabled` is the entry's weekly plan switch, `routeEnabledFor(locale)` (P2-8b).
 */
export function planOfferNow(profileId: string, enabled: boolean, now: Date, surface: OfferSurface = 'learner'): PlanOffer | null {
  if (!enabled) return null;
  const context = proposalContextFor(profileId, now);
  if (context === null) return null;
  const ui = useRouteStore.getState().ui[profileId];
  return planOfferOf({
    enabled,
    context,
    active: activeSelfRoute(useProgressStore.getState().byProfile[profileId]),
    dismissedAt: surface === 'report' ? ui?.reportDismissedAt : ui?.dismissedAt,
    keptFor: ui?.keptFor,
    nowMs: now.getTime(),
  });
}

/** `planOfferNow` after reading the marks from storage. */
export async function loadPlanOffer(profileId: string, enabled: boolean, now: Date, surface: OfferSurface = 'learner'): Promise<PlanOffer | null> {
  if (!enabled) return null;
  await useRouteStore.getState().loadUi(profileId);
  return planOfferNow(profileId, enabled, now, surface);
}

/** Keep my plan / the report's Not now on an update: hidden until the start changes again. */
export async function keepPlan(profileId: string): Promise<void> {
  const changeAt = planChangeAt(useProgressStore.getState().byProfile[profileId]?.placements);
  if (changeAt !== undefined) await useRouteStore.getState().markKept(profileId, changeAt);
}

/** **Use this plan**: the plan exactly as shown (its pace, the suggested length or the one picked); null when nothing was stored. */
export async function acceptPlanOffer(
  profileId: string,
  proposal: RouteProposal,
  opts: { changed: boolean; length?: DurationId },
  now: Date,
): Promise<SelfRoute | null> {
  const draft = draftOfOffer(proposal, opts.length);
  if (draft === null) return null;
  return useRouteStore.getState().create(profileId, draft, { from: 'proposal', changed: opts.changed }, now);
}

/**
 * **Update my plan** / **Update the plan**: the active plan's future follows the newest start (it
 * skips what a check found known, or regains quests a grown-up put back); its length, end date and
 * past days stay. Fires `route.updated` with the counts of the proposal whose input is stored.
 * False when there is nothing to update or it would not be stored.
 */
export async function applyPlanUpdate(profileId: string, now: Date, surface: OfferSurface = 'learner'): Promise<boolean> {
  await useProgressStore.getState().hydrate(profileId);
  const offer = await loadPlanOffer(profileId, true, now, surface);
  const active = activeSelfRoute(useProgressStore.getState().byProfile[profileId]);
  if (offer?.kind !== 'update' || active === null) return false;
  const next = updatedRouteOf(active, offer.input, now.toISOString());
  if (next === null || !useProgressStore.getState().setSelfRoute(profileId, next)) return false;
  // The new future becomes this week's homework now (F-PLAN-002 section 3.6).
  await usePlanStore.getState().rederive(profileId);
  const event = updatedEvent(profileId, offer.source, offer.proposal.diff);
  void track({ name: event.name, profileId, payload: { ...event.payload } });
  return true;
}
