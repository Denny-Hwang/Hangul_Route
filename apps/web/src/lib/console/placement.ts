import {
  CATALOG,
  PlacementLevelSchema,
  placementStageNumber,
  questsPlacedOutAtLevel,
  routeCatalogOf,
  type Catalog,
  type PlacementLevel,
  type PlanItem,
  type SpaceKind,
} from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { RosterLearner, RosterSummary } from './api';
import { ROUTES } from './routing';

/**
 * The console side of the level check (F-PLC-001 section 3.9, P-9; wireframe placement K):
 * the starting-spot line on a student or child card and the advisory "Suggest a different
 * start" hand-off. Summary only: nothing here averages, counts or sorts learners by level,
 * and the hand-off is an ordinary F-PLAN-001 plan that never edits the learner's check,
 * placed-out set or progress (decision P6).
 */

type PlacementOf = Pick<RosterSummary, 'placement'> | null | undefined;

/**
 * The band label of a level, from the same words the learner saw (`learner.placement.band`).
 * Null for a level this build does not know: the roster is not validated at runtime, and the
 * check measures Stage 1 to Stage 3 only.
 */
export function placementBandLabel(level: PlacementLevel, locale: UiLocale = DEFAULT_LOCALE): string | null {
  const parsed = PlacementLevelSchema.safeParse(level);
  if (!parsed.success) return null;
  const b = getMessages(locale).learner.placement.band;
  const { stage, band } = parsed.data;
  // The schema bounds `band` to 0..3, so the index always names a label.
  if (stage === 'stage1') return [b.beginning, b.lettersAndSounds, b.everyLetter, b.readingWords][band] as string;
  if (stage === 'stage2') return b.firstWords;
  if (stage === 'stage3') return b.firstSentences;
  return null;
}

/**
 * "Starting spot: Stage 1 · Letters and sounds · Oct 9"; null without a readable placement. `dateOf` lets a caller
 * date the check its own way (the report uses the learner-local day, OD-12); it returns '' for an unreadable time.
 */
export function startingSpotLine(
  summary: PlacementOf,
  locale: UiLocale = DEFAULT_LOCALE,
  dateOf: (takenAt: string) => string = (takenAt) => formatDate(locale, takenAt, 'monthDay'),
): string | null {
  const placement = summary?.placement;
  if (!placement) return null;
  const band = placementBandLabel(placement.level, locale);
  const date = dateOf(placement.takenAt);
  if (band === null || date === '') return null;
  return getMessages(locale).console.placement.startingSpot(placementStageNumber(placement.level.stage), band, date);
}

/** "Changed by a grown-up" under the line, only when the start was changed and the line shows. */
export function startingSpotChanged(summary: PlacementOf, locale: UiLocale = DEFAULT_LOCALE): string | null {
  if (summary?.placement?.overridden !== true || startingSpotLine(summary, locale) === null) return null;
  return getMessages(locale).console.placement.overridden;
}

/**
 * The quest the advisory plan opens with: the first playable grid quest the level does not
 * place out (`questsPlacedOutAtLevel`, the coarse mapping when only a level is known, section
 * 3.7 item 6), or the first one of the route without a level. Null when the catalogue has no
 * playable lesson or the level places out every one of them: a quest the learner already
 * placed out would contradict the starting-spot line next to it, so the builder then opens
 * with no item and the grown-up picks one. The grown-up can always swap the pre-filled quest.
 */
export function suggestedStartQuestId(level: PlacementLevel | null, source: Catalog = CATALOG): string | null {
  const route = routeCatalogOf(source);
  const placedOut = new Set(level ? questsPlacedOutAtLevel(level, route) : []);
  return route.quests.find((quest) => quest.grid && quest.playable && !placedOut.has(quest.id))?.id ?? null;
}

export interface SuggestedStart {
  title: string;
  items: PlanItem[];
  /** Always exactly this learner: the plan reaches no one else. */
  targets: string[];
}

/**
 * The plan builder's prefill: one quest item with the note "Try this next", for this learner
 * only. The title names no learner (it is stored with the plan); the name lives only in the
 * builder's notice, which is never saved.
 */
export function suggestedStart(
  learner: Pick<RosterLearner, 'id' | 'summary'>,
  locale: UiLocale = DEFAULT_LOCALE,
  source: Catalog = CATALOG,
): SuggestedStart {
  const words = getMessages(locale).console.placement;
  const level = learner.summary?.placement?.level ?? null;
  const questId = suggestedStartQuestId(level && PlacementLevelSchema.safeParse(level).success ? level : null, source);
  return {
    title: words.suggestTitle,
    items: questId ? [{ kind: 'quest', id: questId, note: words.suggestNote }] : [],
    targets: [learner.id],
  };
}

/** The prefill and the builder's one-line notice for `learnerId`; null when the learner is not on this roster. */
export function suggestionFor(
  learners: readonly RosterLearner[],
  learnerId: string | null,
  locale: UiLocale = DEFAULT_LOCALE,
  source: Catalog = CATALOG,
): { draft: SuggestedStart; notice: string } | null {
  const learner = learnerId ? learners.find((l) => l.id === learnerId) : undefined;
  if (!learner) return null;
  return { draft: suggestedStart(learner, locale, source), notice: getMessages(locale).console.placement.suggestFor(learner.displayName.trim()) };
}

/** The query key the roster sets on the existing plan builder (no new route). */
export const SUGGEST_PARAM = 'suggest';

/** `/teach/space/plan?id=<space>&suggest=<learner>` (`/parent/space/plan…` for a family, F-APP-001 A-5b). */
export function suggestStartHref(spaceId: string, learnerId: string, kind?: SpaceKind): string {
  return `${ROUTES.spacePlan(spaceId, undefined, kind)}&${SUGGEST_PARAM}=${encodeURIComponent(learnerId)}`;
}

/** The learner id of `?suggest=`, or null. */
export function suggestFrom(params: { get(name: string): string | null } | null): string | null {
  const id = params?.get(SUGGEST_PARAM)?.trim();
  return id ? id : null;
}

/**
 * What a (re)load of the plan builder does with the draft. `keep` while a never-saved
 * suggestion is open, so a re-run (a new session object, StrictMode, "Try again") never
 * replaces it; `suggestion` the first time `?suggest=` names a learner on this roster;
 * otherwise `stored`, the builder's ordinary opening (the selected plan's draft, or a new one).
 */
export function builderOnLoad(state: { suggestionApplied: boolean; suggestionOpen: boolean; suggestionFound: boolean }): 'keep' | 'suggestion' | 'stored' {
  if (state.suggestionOpen) return 'keep';
  if (!state.suggestionApplied && state.suggestionFound) return 'suggestion';
  return 'stored';
}

/**
 * The builder's suggestion notice names the learner, so it shows only while the unsaved draft
 * still reaches exactly that learner; picking more learners or everyone hides it.
 */
export function suggestionNoticeShown(draft: { id?: string; targets: readonly string[] | null }, suggestedFor: string | null): boolean {
  return suggestedFor !== null && draft.id === undefined && draft.targets?.length === 1 && draft.targets[0] === suggestedFor;
}
