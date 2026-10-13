import {
  CATALOG,
  LENGTH_PRESETS,
  SelfRouteSchema,
  generateCurriculum,
  placementLevelRank,
  questsPlacedOutAtLevel,
  regenerateFrom,
  routeCatalogOf,
  toMeta,
  toPlanItems,
  type CurriculumDraft,
  type DurationId,
  type PaceId,
  type PlacementLevel,
  type PlacementResult,
  type ProposeInput,
  type RouteCatalog,
  type RouteProposal,
  type SelfRoute,
} from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import {
  PACE_IDS,
  newestResultAt,
  planPromptHidden,
  proposalInputOf,
  safePropose,
  type ProposalContext,
} from '../route/proposal-flow';

/**
 * The weekly plan offered after a level check (F-PLC-001 section 3.1 step 7 and section 3.9,
 * AM-1, AM-2, AM-5, AM-10; wireframe journey/my-route-overview.md J1, K2, K3): the learner's
 * result strip and the grown-up report's "Suggested weekly plan" card read the same offer.
 * Pure: the screens pass the snapshot, the plan, the dismissal and the clock. Codes and counts
 * only; every word comes from the messages of the screen's language.
 */

/**
 * `new`: no plan yet; one proposal per pace chip, `pace` the pre-selected chip (OD-13).
 * `update`: a plan exists and its future no longer matches the start: a check found a later
 * place to start (`retake`, K3), or a grown-up override put quests back or chose another start
 * (`override`, AM-2). `input` is what the proposal was made from; the update stores exactly it.
 */
export type PlanOffer =
  | { kind: 'new'; pace: PaceId; byPace: Partial<Record<PaceId, RouteProposal>> }
  | { kind: 'update'; proposal: RouteProposal; source: UpdateSource; input: ProposeInput };

export type UpdateSource = 'retake' | 'override';

export interface PlanOfferInput {
  /** `flags.routeEnabled`. */
  enabled: boolean;
  context: ProposalContext;
  /** The profile's active own plan (`activeSelfRoute`), or null. */
  active: SelfRoute | null;
  /** The surface's dismissal: `route-ui:<profileId>.dismissedAt` (learner) or `.reportDismissedAt` (report). */
  dismissedAt: string | undefined;
  /** `route-ui:<profileId>.keptFor`: Keep my plan / Not now on an update, for the change it answered. */
  keptFor?: string | undefined;
  nowMs: number;
}

type SeedShape = { level: PlacementLevel; placedOutQuestIds: readonly string[] };
type StoredShape = { level: PlacementLevel; placedOutQuestIds?: readonly string[] | undefined };

/**
 * The start moved later than the plan's: the seed keeps every quest the plan skips and adds
 * more, or keeps the same set at a higher level. A grown-up override that puts quests back
 * (an earlier start) is never "a later place to start" (AM-2).
 */
export function startRaised(seed: SeedShape | null, stored: StoredShape, catalog: RouteCatalog): boolean {
  if (seed === null) return false;
  const storedSet = stored.placedOutQuestIds ?? questsPlacedOutAtLevel(stored.level, catalog);
  const seedSet = new Set(seed.placedOutQuestIds);
  if (!storedSet.every((id) => seedSet.has(id))) return false;
  return seedSet.size > new Set(storedSet).size || placementLevelRank(seed.level) > placementLevelRank(stored.level);
}

/**
 * The plan's future would gain quests: the seed no longer skips some quest the plan skips. Only a
 * grown-up override removes ids from the placed-out set (`route-seed.ts`), so this is an override
 * that put quests back or chose another start (AM-2: "the put-back quests then return to the plan's
 * future queue").
 */
export function startPutBack(seed: SeedShape | null, stored: StoredShape, catalog: RouteCatalog): boolean {
  if (seed === null) return false;
  const storedSet = stored.placedOutQuestIds ?? questsPlacedOutAtLevel(stored.level, catalog);
  const seedSet = new Set(seed.placedOutQuestIds);
  return storedSet.some((id) => !seedSet.has(id));
}

/** The newest change to the start: a result's time or an override's, whichever is later (the key `keptFor` answers). */
export function planChangeAt(placements: readonly PlacementResult[] | undefined): string | undefined {
  let top: string | undefined;
  for (const r of placements ?? []) {
    for (const at of [r.completedAt, r.override?.at]) if (at !== undefined && (top === undefined || at > top)) top = at;
  }
  return top;
}

/** `proposeRoute`'s input for an existing plan (its own rhythm, minutes, goals and tier). */
const updateInputOf = (context: ProposalContext, active: SelfRoute): ProposeInput => ({
  ...proposalInputOf(context),
  existing: { meta: active.meta, items: active.items },
});

/** Which change the update follows: a grown-up override on the newest result, else a retake. */
export function planUpdateSource(placements: readonly PlacementResult[] | undefined): UpdateSource {
  if (placements === undefined || placements.length === 0) return 'retake';
  const newest = placements.reduce((top, r) => (r.completedAt > top.completedAt ? r : top), placements[0] as PlacementResult);
  return newest.override === undefined ? 'retake' : 'override';
}

export function planOfferOf(i: PlanOfferInput): PlanOffer | null {
  if (!i.enabled) return null;
  if (i.active !== null) {
    const input = updateInputOf(i.context, i.active);
    const proposal = safePropose(input);
    if (proposal === null || proposal.kind !== 'update') return null;
    const catalog = routeCatalogOf(i.context.catalog ?? CATALOG);
    // Nothing in the plan's future would change (a level that rose alone): no update.
    if (proposal.diff !== undefined && proposal.diff.itemsRemoved === 0 && proposal.diff.itemsAdded === 0) return null;
    const changeAt = planChangeAt(i.context.placements);
    if (changeAt !== undefined && i.keptFor === changeAt) return null;
    if (startPutBack(input.seed, i.active.meta.params, catalog)) return { kind: 'update', proposal, source: 'override', input };
    if (!startRaised(input.seed, i.active.meta.params, catalog)) return null;
    return { kind: 'update', proposal, source: planUpdateSource(i.context.placements), input };
  }
  if (planPromptHidden(i.dismissedAt, newestResultAt(i.context.placements), i.nowMs)) return null;
  const first = safePropose(proposalInputOf(i.context));
  if (first === null) return null;
  const pace = first.pace ?? 'steady';
  const byPace: Partial<Record<PaceId, RouteProposal>> = {};
  for (const id of PACE_IDS) {
    const proposal = id === pace ? first : safePropose(proposalInputOf({ ...i.context, pace: id }));
    if (proposal !== null) byPace[id] = proposal;
  }
  return { kind: 'new', pace, byPace };
}

/** The strip's line in words: "4 weeks, 3 days a week, about 15 minutes a day". */
export function stripLineOf(proposal: RouteProposal): { length: DurationId; days: number; minutes: number } {
  return { length: proposal.defaultId, days: proposal.params.sessionsPerWeek, minutes: proposal.params.minutesPerSession };
}

/** The plan exactly as shown: the proposal at its suggested length, or the length picked; null when it would not lay out. */
export function draftOfOffer(proposal: RouteProposal, length: DurationId = proposal.defaultId, catalog = CATALOG): CurriculumDraft | null {
  try {
    return generateCurriculum({ ...proposal.params, weeks: LENGTH_PRESETS[length].weeks }, catalog);
  } catch {
    return null;
  }
}

/** A grown-up warning in plain words (no price, no plan name): which message, with its number. */
export type GrownUpWarning =
  | { code: 'notIncluded'; count: number }
  | { code: 'notReleased'; count: number }
  | { code: 'runsOut'; week: number }
  | { code: 'didNotFit'; count: number };

/** The draft's warnings a grown-up reads on the card (AM-5); the others are console detail. */
export function grownUpWarnings(draft: Pick<CurriculumDraft, 'warnings'> | null): GrownUpWarning[] {
  if (draft === null) return [];
  return draft.warnings.flatMap((w): GrownUpWarning[] => {
    switch (w.code) {
      case 'premium-needed':
        return [{ code: 'notIncluded', count: w.count ?? 0 }];
      case 'coming-soon-included':
        return [{ code: 'notReleased', count: w.count ?? 0 }];
      case 'content-runs-out':
        return [{ code: 'runsOut', week: w.week ?? 0 }];
      case 'fewer-sessions-than-units':
        return [{ code: 'didNotFit', count: w.count ?? 0 }];
      default:
        return [];
    }
  });
}

/** A warning's sentence for the grown-up, in the screen's language. */
export function grownUpWarningText(m: Messages, w: GrownUpWarning): string {
  const words = m.caregiver.placementReport.plan.warning;
  switch (w.code) {
    case 'notIncluded':
      return words.notIncluded(w.count);
    case 'notReleased':
      return words.notReleased(w.count);
    case 'runsOut':
      return words.runsOut(w.week);
    case 'didNotFit':
      return words.didNotFit(w.count);
  }
}

/**
 * Update my plan / Update the plan (AM-2): the future skips what is now known, the length and
 * the end date stay, days already past keep their items. Same id and creation time; null when
 * there is no seed or the result would not parse (nothing is stored then).
 */
export function updatedRouteOf(active: SelfRoute, input: ProposeInput, nowIso: string, catalog = CATALOG): SelfRoute | null {
  if (input.seed === null) return null;
  try {
    const draft = regenerateFrom(active, input.today, catalog, {
      mode: 'reseed',
      paramsPatch: { level: input.seed.level, placedOutQuestIds: [...input.seed.placedOutQuestIds] },
      completedQuestIds: [...input.completedQuestIds],
    });
    return SelfRouteSchema.parse({ ...active, updatedAt: nowIso, meta: toMeta(draft), items: toPlanItems(draft) });
  } catch {
    return null;
  }
}

/** `route.updated` `{ source, itemsRemoved, itemsAdded }` (FP-B7): counts only. */
export function updatedEvent(
  profileId: string,
  source: UpdateSource,
  diff: RouteProposal['diff'],
): { name: 'route.updated'; profileId: string; payload: { source: UpdateSource; itemsRemoved: number; itemsAdded: number } } {
  return {
    name: 'route.updated',
    profileId,
    payload: { source, itemsRemoved: diff?.itemsRemoved ?? 0, itemsAdded: diff?.itemsAdded ?? 0 },
  };
}
