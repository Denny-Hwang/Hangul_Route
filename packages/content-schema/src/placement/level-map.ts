import type { AssessmentResponse } from '../assessment/question';
import { StageKeySchema, type StageKey } from '../schemas/heritage-card';
import type { GateResult, PlacementLevel } from '../schemas/placement';
import { RUNG_SYMBOLS } from './rungs';
import { gatePassed } from './scoring';
import type { RouteCatalog, RouteQuest } from './route-seed';

/**
 * Covered symbols and the mapping onto the quest list (F-PLC-001 section 3.6).
 * "Placed out" is a route concept: nothing here completes a quest, awards a
 * star or a card, or closes homework.
 */

/** 1 to 7 (`stage1` is 1). Named for placement so it cannot clash with F-STORY-005's own helper. */
export const placementStageNumber = (stage: StageKey): number => StageKeySchema.options.indexOf(stage) + 1;

/** Tags (`sym:<key>`) of a question id; the run keeps them for the questions it asked. */
export type TagLookup = (questionId: string) => readonly string[];

/**
 * A symbol key is covered when the rung that owns it passed and no response on a
 * template tagged with it was wrong, skipped or assisted. Symbols no question
 * touched are covered by their rung's pass (the check samples, it does not
 * census: spec 3.6, decision P13). The result carries no tags, so the lookup is
 * an argument.
 */
export const coveredSymbols = (
  evidence: { gates: readonly GateResult[]; responses: readonly AssessmentResponse[] },
  tagsOf: TagLookup,
): Set<string> => {
  const owned: string[] = [];
  if (gatePassed(evidence.gates, 'sound-basic', 'decode') && gatePassed(evidence.gates, 'syl-cv', 'decode')) {
    owned.push(...RUNG_SYMBOLS.basic);
  }
  if (gatePassed(evidence.gates, 'sound-rest', 'decode')) owned.push(...RUNG_SYMBOLS.rest);
  if (gatePassed(evidence.gates, 'syl-cvc', 'decode')) owned.push(...RUNG_SYMBOLS.finals);

  const doubtful = new Set<string>();
  for (const response of evidence.responses) {
    if (response.outcome === 'correct' && !response.assisted) continue;
    for (const tag of tagsOf(response.questionId)) {
      if (tag.startsWith('sym:')) doubtful.add(tag.slice(4));
    }
  }
  return new Set(owned.filter((key) => !doubtful.has(key)));
};

/** Quests in route order (`order`, ties keep catalog order). */
export const inRouteOrder = (catalog: RouteCatalog): RouteQuest[] =>
  catalog.quests
    .map((quest, index) => ({ quest, index }))
    .sort((a, b) => a.quest.order - b.quest.order || a.index - b.index)
    .map((entry) => entry.quest);

/**
 * The grid quests a level places out, in route order. A grid quest is placed out
 * when its stage is lower than the level's stage, or it is a Stage 1 quest that
 * teaches something and every key it teaches is covered. (Spec rule 3, a
 * consolidation quest with empty `teaches` from stage2 band 0, is exactly the
 * stage-lower rule, so it needs no code of its own.)
 */
export const placedOutQuestIds = (
  level: PlacementLevel,
  covered: ReadonlySet<string>,
  catalog: RouteCatalog,
): string[] =>
  inRouteOrder(catalog)
    .filter(
      (quest) =>
        quest.grid &&
        (placementStageNumber(quest.stage) < placementStageNumber(level.stage) ||
          (quest.stage === 'stage1' && quest.teaches.length > 0 && quest.teaches.every((key) => covered.has(key)))),
    )
    .map((quest) => quest.id);

/** The symbols a level covers when only the level is known (a grown-up chose a starting point). */
const coarseCovered = (level: PlacementLevel): Set<string> => {
  const keys: string[] = [];
  if (placementStageNumber(level.stage) >= 2 || level.band >= 1) keys.push(...RUNG_SYMBOLS.basic);
  if (placementStageNumber(level.stage) >= 2 || level.band >= 2) keys.push(...RUNG_SYMBOLS.rest);
  if (placementStageNumber(level.stage) >= 2 || level.band >= 3) keys.push(...RUNG_SYMBOLS.finals);
  return new Set(keys);
};

/**
 * The coarse mapping without evidence (used by F-PLAN-002): exactly the "Placed
 * out" column of the spec table for the level.
 */
export const questsPlacedOutAtLevel = (level: PlacementLevel, catalog: RouteCatalog): string[] =>
  placedOutQuestIds(level, coarseCovered(level), catalog);
