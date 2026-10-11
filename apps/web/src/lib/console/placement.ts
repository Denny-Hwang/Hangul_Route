import {
  CATALOG,
  PlacementLevelSchema,
  placementStageNumber,
  questsPlacedOutAtLevel,
  routeCatalogOf,
  type Catalog,
  type PlacementLevel,
  type PlanItem,
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

/** Plan titles hold at most 60 UTF-16 units (`PlanUpsertSchema`). */
const PLAN_TITLE_MAX = 60;

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

/** "Starting spot: Stage 1 · Letters and sounds · Oct 9"; null without a readable placement. */
export function startingSpotLine(summary: PlacementOf, locale: UiLocale = DEFAULT_LOCALE): string | null {
  const placement = summary?.placement;
  if (!placement) return null;
  const band = placementBandLabel(placement.level, locale);
  const date = formatDate(locale, placement.takenAt, 'monthDay');
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
 * 3.7 item 6), or the first one of the route without a level. Beyond the content it is the
 * last playable grid quest, so the builder still opens with one item; null only when the
 * catalogue has no playable lesson. The grown-up swaps it for the start they suggest.
 */
export function suggestedStartQuestId(level: PlacementLevel | null, source: Catalog = CATALOG): string | null {
  const route = routeCatalogOf(source);
  const playable = route.quests.filter((quest) => quest.grid && quest.playable);
  const placedOut = new Set(level ? questsPlacedOutAtLevel(level, route) : []);
  return (playable.find((quest) => !placedOut.has(quest.id)) ?? playable[playable.length - 1])?.id ?? null;
}

export interface SuggestedStart {
  title: string;
  items: PlanItem[];
  /** Always exactly this learner: the plan reaches no one else. */
  targets: string[];
}

/** Cut to `max` UTF-16 units without splitting a character. */
function capUnits(text: string, max: number): string {
  let out = '';
  for (const char of text) {
    if (out.length + char.length > max) break;
    out += char;
  }
  return out;
}

/** The plan builder's prefill: one quest item with the note "Try this next", for this learner only. */
export function suggestedStart(
  learner: Pick<RosterLearner, 'id' | 'displayName' | 'summary'>,
  locale: UiLocale = DEFAULT_LOCALE,
  source: Catalog = CATALOG,
): SuggestedStart {
  const words = getMessages(locale).console.placement;
  const level = learner.summary?.placement?.level ?? null;
  const questId = suggestedStartQuestId(level && PlacementLevelSchema.safeParse(level).success ? level : null, source);
  return {
    title: capUnits(words.suggestTitle(learner.displayName.trim()), PLAN_TITLE_MAX),
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

/** `/teach/space/plan?id=<space>&suggest=<learner>`. */
export function suggestStartHref(spaceId: string, learnerId: string): string {
  return `${ROUTES.spacePlan(spaceId)}&${SUGGEST_PARAM}=${encodeURIComponent(learnerId)}`;
}

/** The learner id of `?suggest=`, or null. */
export function suggestFrom(params: { get(name: string): string | null } | null): string | null {
  const id = params?.get(SUGGEST_PARAM)?.trim();
  return id ? id : null;
}
