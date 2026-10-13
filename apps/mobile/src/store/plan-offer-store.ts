import type { DurationId, RouteProposal, SelfRoute, StageKey } from '@hangul-route/content-schema';
import { dayKey } from '../logic/homework/mission-builder';
import { draftOfOffer, planOfferOf, updatedEvent, updatedRouteOf, type PlanOffer } from '../logic/placement/plan-offer';
import { proposalInputOf, type ProposalContext } from '../logic/route/proposal-flow';
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
 * The offer for a profile from what the stores hold now (the plan prompt's dismissal as last
 * read by `loadUi`): `enabled` is `flags.routeEnabled`.
 */
export function planOfferNow(profileId: string, enabled: boolean, now: Date): PlanOffer | null {
  if (!enabled) return null;
  const context = proposalContextFor(profileId, now);
  if (context === null) return null;
  return planOfferOf({
    enabled,
    context,
    active: activeSelfRoute(useProgressStore.getState().byProfile[profileId]),
    dismissedAt: useRouteStore.getState().ui[profileId]?.dismissedAt,
    nowMs: now.getTime(),
  });
}

/** `planOfferNow` after reading the plan prompt's dismissal from storage. */
export async function loadPlanOffer(profileId: string, enabled: boolean, now: Date): Promise<PlanOffer | null> {
  if (!enabled) return null;
  await useRouteStore.getState().loadUi(profileId);
  return planOfferNow(profileId, enabled, now);
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
 * **Update my plan** / **Update the plan**: the active plan's future skips what the newest check
 * found known; its length, end date and past days stay. Fires `route.updated`. False when there
 * is nothing to update (no plan, no later start) or it would not be stored.
 */
export async function applyPlanUpdate(profileId: string, now: Date): Promise<boolean> {
  await useProgressStore.getState().hydrate(profileId);
  const offer = await loadPlanOffer(profileId, true, now);
  const active = activeSelfRoute(useProgressStore.getState().byProfile[profileId]);
  const context = proposalContextFor(profileId, now);
  if (offer?.kind !== 'update' || active === null || context === null) return false;
  const next = updatedRouteOf(active, proposalInputOf(context), now.toISOString());
  if (next === null || !useProgressStore.getState().setSelfRoute(profileId, next)) return false;
  // The new future becomes this week's homework now (F-PLAN-002 section 3.6).
  await usePlanStore.getState().rederive(profileId);
  const event = updatedEvent(profileId, offer.source, offer.proposal.diff);
  void track({ name: event.name, profileId, payload: { ...event.payload } });
  return true;
}
