import type { CellLevel } from '@hangul-route/content-schema';

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
 *   (F-ENT-003: the same access as playing it; a locked cell offers none), in E3's offered arm, with 5 or more rounds.
 * - **The mastery block** (E): the latched level (`cellBest`) from Done up, while `mastery` is on; one hint line for the
 *   next level, levels 1 and 2 only ("Take the Cell Check" only while the Check is on and not yet passed).
 * - **`cellCheck` off** (section 12.2): no Check button and no Test out line; "Cell Check done", "Tested out" and the
 *   levels are latched and show again when it is back on.
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
    i.checkOn && i.playable && !started && i.stage !== 'stage1' && i.open.length > 0 && i.open.every(Boolean) && i.arm === 'offered';
  const level = i.masteryOn && i.level >= 1 ? (i.level as Exclude<CellLevel, 0>) : null;
  let hint: HintKey | null = null;
  if (level === 1) hint = 'practiced';
  else if (level === 2) hint = i.checkOn && !i.checkPassed ? 'check' : 'mastered';
  return { check, done, testOut, level, hint, block: level !== null || check !== null || done };
}
