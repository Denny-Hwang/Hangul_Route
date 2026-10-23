import type { CellLevel, Episode } from '@hangul-route/content-schema';
import { playableEpisodes } from '../next-quest';

/**
 * What a cell's page offers (F-CURR-002 sections 4.4, 4.5, 11.4 and 12.2, row CM-21; design/wireframes/reviews/
 * cell-check.md A, A2 and B, journey/mastery-ring.md E). Pure; read by the Cell Check's screen chunk only, never by
 * the memory chunk, so the two share no module.
 *
 * - **The Cell Check** (block A): once the cell's first volume is done (every quest has stars) or it was tested out,
 *   with `cellCheck` (and `memoryRecord`) on and 5 or more playable rounds. Its button is the page's one primary while
 *   every quest is done and no Check has latched yet; after a 3-star Check (`cellCheckAt`, A2) it is "Take it again",
 *   secondary, under "Cell Check done", and secondary on a tested-out cell (its quests keep their own buttons).
 * - **Test out** (line B): on a cell nobody started (no quest done, not tested out), not in Stage 1 (placement covers
 *   Stage 1, and its prize and Hangul Check need its quests), with every quest of the cell open to the learner
 *   (F-ENT-003: the same access as playing it; a locked cell offers none), in E3's offered arm, with 5 or more rounds
 *   and topic words at most 30% of the cell's items (the memory store can schedule the rest; Stage 3 up today).
 * - **The mastery block** (E): the latched level (`cellBest`) from Done up, while `mastery` is on; one hint line for the
 *   next level, levels 1 and 2 only ("Take the Cell Check" only while the Check is on and not yet passed).
 * - **`cellCheck` off** (section 12.2): no Check button and no Test out line; "Cell Check done" and the levels are
 *   latched and show again when it is back on. "Tested out" stays drawn on the quests whatever the switch, because
 *   `routeNext` keeps skipping the cell (the cell page draws it, not this chunk).
 */

/** Experiment E3 (section 11.4, row CM-71): Test out offered against hidden. Until CM-71 assigns arms, every learner is offered it. */
export type TestOutArm = 'offered' | 'hidden';

/** The E3 hook: the learner's arm. Row CM-71 assigns it; until then every learner is in the offered arm. */
export function testOutArmFor(_profileId: string | null): TestOutArm {
  return 'offered';
}

export interface CellOfferInput {
  stage: string;
  /** Stars of each quest of the cell's first volume, in order (0 when not done). */
  stars: readonly number[];
  /** May the learner start each quest (`useQuestAccess`, F-ENT-003 section 3.4)? */
  open: readonly boolean[];
  testedOut: boolean;
  checkPassed: boolean;
  level: CellLevel;
  checkOn: boolean;
  masteryOn: boolean;
  arm: TestOutArm;
  /** The cell has 5 or more playable rounds (unknown while the plan is read: nothing is offered yet). */
  playable: boolean;
  /** The cell's topic words are few enough for Test out (`testOutFits`, section 4.5 decision record CM-21). */
  testOutFits: boolean;
}

export type HintKey = 'practiced' | 'check' | 'mastered';

export interface CellOffer {
  /** The Cell Check button: its tone, or null when there is none. */
  check: { tone: 'primary' | 'secondary'; again: boolean } | null;
  /** "Cell Check done" (a 3-star Check latched), shown while the Check is on. */
  done: boolean;
  testOut: boolean;
  /** The mastery block's level (1 to 3), or null when the block shows no ring. */
  level: Exclude<CellLevel, 0> | null;
  hint: HintKey | null;
  /** Whether block A is drawn at all. */
  block: boolean;
}

export function cellOffer(i: CellOfferInput): CellOffer {
  const allDone = i.stars.length > 0 && i.stars.every((s) => s > 0);
  const started = i.testedOut || i.stars.some((s) => s > 0);
  const checkable = i.checkOn && i.playable && (allDone || i.testedOut);
  const check = checkable ? { tone: allDone && !i.checkPassed ? ('primary' as const) : ('secondary' as const), again: i.checkPassed } : null;
  const done = i.checkOn && i.checkPassed;
  const testOut =
    i.checkOn && i.playable && i.testOutFits && !started && i.stage !== 'stage1' && i.open.length > 0 && i.open.every(Boolean) && i.arm === 'offered';
  const level = i.masteryOn && i.level >= 1 ? (i.level as Exclude<CellLevel, 0>) : null;
  let hint: HintKey | null = null;
  if (level === 1) hint = 'practiced';
  else if (level === 2) hint = i.checkOn && !i.checkPassed ? 'check' : 'mastered';
  return { check, done, testOut, level, hint, block: level !== null || check !== null || done };
}

/** The stages a Stage Jump is offered on (row CM-25): every stage after Stage 1, as `STAGE_JUMP_STAGES` of F-PLC-001. */
const JUMP_STAGES: readonly string[] = ['stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];

/** A grid cell as the jump offer reads it: its stage, its quests and, for the stage's own cells, their stars and access. */
export interface JumpCell {
  id: string;
  stage: string;
  questIds: readonly string[];
}

/** The route's grid cells a jump reads: the playable grid episodes with quests (a preview placeholder is not one). */
export function jumpCells(episodes: readonly Episode[]): JumpCell[] {
  return playableEpisodes(episodes)
    .filter((e) => e.questIds.length > 0)
    .map((e) => ({ id: e.id, stage: e.stage, questIds: e.questIds }));
}

export interface StageJumpOfferInput {
  stage: string;
  /** Every grid cell of the route (`gridEpisodes`), any stage. */
  cells: readonly JumpCell[];
  /** The learner's done quests. */
  done: ReadonlySet<string>;
  /** The quests the level check placed out (`placedOutSkipSet`). */
  placedOut: ReadonlySet<string> | undefined;
  testedOut: Readonly<Record<string, string>> | undefined;
  /** May the learner start this quest (`useQuestAccess`, F-ENT-003 section 3.4)? */
  open: (questId: string) => boolean;
  checkOn: boolean;
  arm: TestOutArm;
  /** The stage has 10 or more playable rounds (unknown while the plan is read: nothing is offered yet). */
  playable: boolean;
}

const stageNumber = (stage: string): number => Number(stage.replace('stage', ''));

/**
 * Stage Jump Ahead (F-CURR-002 row CM-25): the Test out rule of a cell, over a whole stage. Offered on the Journey stage
 * header of the stage the route has reached, before it is started:
 * - a stage after Stage 1 (placement covers Stage 1, and its prize and Hangul Check need its quests), not jumped yet;
 * - every quest of every stage before it done, placed out or in a tested-out cell, so the level a jump stands for
 *   (the next stage's band 0, F-PLC-001 section 3.6 as amended) never claims a stage the learner has not covered;
 * - nobody started it: no quest of the stage done and no cell of it tested out;
 * - the route has not passed it: not every quest of it placed out by the level check;
 * - every quest of the stage open to the learner (F-ENT-003: the same access as playing them; a locked stage offers no
 *   jump), in E3's offered arm, with `cellCheck` (and `memoryRecord`) on and 10 or more playable rounds.
 */
export function stageJumpOffer(i: StageJumpOfferInput): boolean {
  if (!i.checkOn || !i.playable || i.arm !== 'offered' || !JUMP_STAGES.includes(i.stage) || i.testedOut?.[i.stage] !== undefined) return false;
  const tested = (cell: JumpCell): boolean => i.testedOut?.[cell.id] !== undefined;
  const own = i.cells.filter((c) => c.stage === i.stage);
  const quests = own.flatMap((c) => c.questIds);
  if (own.length === 0 || quests.length === 0 || own.some(tested) || quests.some((q) => i.done.has(q) || !i.open(q))) return false;
  // The route is already past a stage the level check placed out whole (a `stage3` band 0 result places out Stages 1
  // and 2): a jump there would raise nothing, so only the stage the route has reached shows the line.
  if (quests.every((q) => i.placedOut?.has(q) === true)) return false;
  return i.cells
    .filter((c) => stageNumber(c.stage) < stageNumber(i.stage))
    .every((c) => tested(c) || c.questIds.every((q) => i.done.has(q) || i.placedOut?.has(q) === true));
}
