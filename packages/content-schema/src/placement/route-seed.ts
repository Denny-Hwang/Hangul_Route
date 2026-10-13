import type { AssessmentResponse } from '../assessment/question';
import type { StageKey, ThemeKey } from '../schemas/heritage-card';
import { ThemeKeySchema } from '../schemas/heritage-card';
import type { GateResult, Motivation, PlacementLevel, PlacementResult } from '../schemas/placement';
import { inRouteOrder, placementLevelRank, placementStageNumber, type TagLookup } from './level-map';
import { modeCeiling, modeOf } from './rungs';
import { rowsPassed } from './scoring';

/**
 * The route seed (F-PLC-001 section 3.7): where this learner starts, derived
 * from stored placement results. Nothing here writes a completion; the set of
 * placed-out quests only ever grows, so a retake cannot move the start back.
 */

/** Structural, so F-PLAN-002's catalog satisfies it. `order` is the global position on the route. */
export interface RouteQuest {
  id: string;
  episodeId: string;
  stage: StageKey;
  theme: ThemeKey;
  order: number;
  teaches: readonly string[];
  playable: boolean;
  grid: boolean;
}
export interface RouteCatalog {
  quests: readonly RouteQuest[];
}

export interface RouteSeed {
  level: PlacementLevel;
  oralStage: StageKey | null;
  startQuestId: string | null;
  startEpisodeId: string | null;
  placedOutQuestIds: string[];
  /** At most 3: 'sym:ㅓ', 'sym:ㄹ/final', 'skill:blending' ... */
  priorityTokens: string[];
  /** Motivation first, then canonical order. */
  themeOrder: ThemeKey[];
  beyondContent: boolean;
  /** Lowest stage the learner is placed at but the tier does not include. */
  needsStage: StageKey | null;
}

export interface RouteOptions {
  isEntitled: (stage: StageKey) => boolean;
  completedQuestIds: ReadonlySet<string>;
}

const MAX_PRIORITY_TOKENS = 3;

const FIRST_THEME: Record<Motivation, ThemeKey> = {
  heritage: 'life',
  friends: 'life',
  kculture: 'rites',
  curious: 'letters',
};

/** Blueprint 04 section 8.1: the motivation's theme first, then the canonical order. */
export const themeOrderFor = (motivation: Motivation | undefined): ThemeKey[] => {
  const canonical = ThemeKeySchema.options as readonly ThemeKey[];
  if (motivation === undefined) return [...canonical];
  const first = FIRST_THEME[motivation];
  return [first, ...canonical.filter((theme) => theme !== first)];
};

/**
 * Up to three tokens: symbols answered wrong, then skipped, then assisted
 * (each symbol once, first seen first), then `skill:blending` when a syllable
 * rung failed after a pass of its sound rung, then `skill:finals` when `syl-cvc` failed.
 * "Failed" means a stored `fail` row with fewer than two correct: Short's strict
 * 3-of-3 `syl-cv` bar turns a 2-of-3 into a fail, but that near-knower does not
 * need blending practice. A Deep rung has two rows; any such row counts.
 */
export const priorityTokensOf = (
  gates: readonly GateResult[],
  responses: readonly AssessmentResponse[],
  tagsOf: TagLookup,
): string[] => {
  const symbolsOf = (outcomes: (r: AssessmentResponse) => boolean): string[] =>
    responses.filter(outcomes).flatMap((r) => tagsOf(r.questionId).filter((tag) => tag.startsWith('sym:')));
  const tokens: string[] = [];
  const add = (token: string): void => {
    if (!tokens.includes(token)) tokens.push(token);
  };
  symbolsOf((r) => r.outcome === 'wrong').forEach(add);
  // A prompt that could not play is no evidence of a gap (section 3.11).
  symbolsOf((r) => r.outcome === 'skipped' && r.noSound !== true).forEach(add);
  symbolsOf((r) => r.assisted).forEach(add);

  const rows = (gate: GateResult['gate']): GateResult[] => gates.filter((g) => g.gate === gate && g.form === 'decode');
  const failed = (gate: GateResult['gate']): boolean => rows(gate).some((g) => g.result === 'fail' && g.correct < 2);
  const passed = (gate: GateResult['gate']): boolean => rowsPassed(rows(gate));
  if ((failed('syl-cv') && passed('sound-basic')) || (failed('syl-cvc') && passed('sound-rest'))) add('skill:blending');
  if (failed('syl-cvc')) add('skill:finals');
  return tokens.slice(0, MAX_PRIORITY_TOKENS);
};

interface SeedInput {
  level: PlacementLevel;
  oralStage: StageKey | null;
  placedOut: readonly string[];
  priorityTokens: readonly string[];
  motivation: Motivation | undefined;
}

const buildSeed = (input: SeedInput, catalog: RouteCatalog, opts: RouteOptions): RouteSeed => {
  const placedOut = new Set(input.placedOut);
  const remaining = inRouteOrder(catalog).filter(
    (quest) => quest.grid && quest.playable && !placedOut.has(quest.id) && !opts.completedQuestIds.has(quest.id),
  );
  const start = remaining.find((quest) => opts.isEntitled(quest.stage)) ?? null;
  let needsStage: StageKey | null = null;
  if (!opts.isEntitled(input.level.stage)) needsStage = input.level.stage;
  else if (start === null && remaining.length > 0) needsStage = (remaining[0] as RouteQuest).stage;
  return {
    level: input.level,
    oralStage: input.oralStage,
    startQuestId: start === null ? null : start.id,
    startEpisodeId: start === null ? null : start.episodeId,
    placedOutQuestIds: [...input.placedOut],
    priorityTokens: [...input.priorityTokens],
    themeOrder: themeOrderFor(input.motivation),
    beyondContent: placementStageNumber(input.level.stage) >= 3,
    needsStage,
  };
};

/**
 * The seed of one stored result, against today's catalog, tier and progress: the
 * start is "the first playable grid quest that is not placed out, not done and
 * entitled", never "the first quest after a prefix".
 */
export const seedRoute = (result: PlacementResult, catalog: RouteCatalog, opts: RouteOptions): RouteSeed =>
  buildSeed(
    {
      level: result.level,
      oralStage: result.oralStage,
      placedOut: result.placedOutQuestIds,
      priorityTokens: result.priorityTokens,
      motivation: result.motivation,
    },
    catalog,
    opts,
  );

const rank = placementLevelRank;
const higher = (a: PlacementLevel, b: PlacementLevel): PlacementLevel => (rank(b) > rank(a) ? b : a);

/**
 * The route in force, folded from every stored result in `completedAt` order.
 * The placed-out set is the union of all results (results never remove an id)
 * and the level is the highest reached, so a lower retake changes nothing but
 * the priority tokens. Results combine by the maximum, never by the "more
 * careful" mode. Priority tokens come from the newest result that could still
 * move the route when it was taken (its mode's ceiling was above the level
 * already reached): a Short taken at band 1 or higher does not replace tokens
 * from rungs it never asks. The listening level is the highest any result
 * measured (listening is reported, never lowered by a run that did not ask it).
 * A parent override
 * on the newest result that carries one places out every grid quest before the
 * chosen one and puts back the chosen one and all after it; later retakes cannot
 * re-place them. Returns null when there is no result.
 */
export const effectiveRoute = (
  placements: readonly PlacementResult[],
  catalog: RouteCatalog,
  opts: RouteOptions,
): RouteSeed | null => {
  if (placements.length === 0) return null;
  const sorted = [...placements].sort((a, b) => (a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : 0));
  const newestFirst = [...sorted].reverse();

  const placedOut = new Set<string>();
  for (const result of sorted) for (const id of result.placedOutQuestIds) placedOut.add(id);

  const override = newestFirst.find((r) => r.override !== undefined)?.override;
  if (override !== undefined) {
    const grid = inRouteOrder(catalog).filter((quest) => quest.grid);
    const chosen = grid.findIndex((quest) => quest.id === override.startQuestId);
    if (chosen >= 0) {
      grid.forEach((quest, index) => {
        if (index < chosen) placedOut.add(quest.id);
        else placedOut.delete(quest.id);
      });
    }
  }

  let reached: PlacementLevel | null = null;
  let priorityTokens: readonly string[] = [];
  for (const result of sorted) {
    if (reached === null || rank(modeCeiling(modeOf(result))) > rank(reached)) priorityTokens = result.priorityTokens;
    reached = reached === null ? result.level : higher(reached, result.level);
  }
  const heard = sorted.map((r) => r.oralStage).filter((s): s is StageKey => s !== null);
  const oralStage = heard.length === 0 ? null : heard.reduce((a, b) => (placementStageNumber(b) > placementStageNumber(a) ? b : a));

  return buildSeed(
    {
      level: reached as PlacementLevel,
      oralStage,
      placedOut: [...placedOut],
      priorityTokens,
      motivation: newestFirst.find((r) => r.motivation !== undefined)?.motivation,
    },
    catalog,
    opts,
  );
};
