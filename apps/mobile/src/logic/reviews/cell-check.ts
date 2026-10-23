import { CURR_TELEMETRY_PAYLOADS, type ReviewEntry } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import { memoryAnswerOf, sessionResult, type RoundAnswer } from './daily-review';
import { buildCheck, type EngineContext } from './engine';
import { roundFor, type ReviewRound, type RoundInput } from './review-rounds';

/**
 * The Cell Check and its test-out (F-CURR-002 sections 4.4, 4.5 and 11.3, row CM-21; design/wireframes/reviews/
 * cell-check.md): the pure half the memory chunk's `cellCheckApi()` reads. The screen is a chunk of its own.
 *
 * - **Items**: the cell's own (the items whose `cells` names it, with its topic words), met or not, through the
 *   engine's Check selector (`buildCheck`): box first, at least 30% at the produce rung, interleaved.
 * - **Size**: 10 rounds when the cell has them, at least `CELL_CHECK_MIN_ROUNDS` (5); with fewer playable rounds there
 *   is no Check (the wireframe's "too few items" state). An item that cannot be played is left out and the engine is
 *   asked again without it, as the Daily Review does.
 * - **Result**: stars only (F-RVW-001 section 3.1, first try, unhinted). 80% or more right on the first try is the
 *   3-star tier, so "passed" is never shown as anything but 3 stars: never a percentage, an "n of m" or a timer.
 * - **Entry**: one `reviews[]` entry of kind `cell-check` per cell (scope and id the cell), holding the best result. The
 *   kind is gated (`?cap=cell-check`) and never pruned. No `mode` field (`ReviewEntrySchema` would strip it); `testout.finished` carries the test-out.
 */

/** Rounds of a Cell Check when the cell has them (section 4.5: 8-10 items, about 3 minutes). */
export const CELL_CHECK_SIZE = 10;
/** The fewest playable rounds a Cell Check is offered with (the wireframe's floor below 8). */
export const CELL_CHECK_MIN_ROUNDS = 5;
/** First-try right share that latches `cellCheckAt`, or passes a test-out (section 4.4): the 3-star tier. */
export const CELL_CHECK_PASS_SHARE = 80;
/**
 * The largest share of topic words (`vocab:`, percent of the cell's items) a cell may hold and still offer Test out. A
 * topic word is recorded only once it is collected (F-VOC-005 P7), so the memory store can neither place nor derive
 * one a learner skipped; above this share a passed test-out would mark Done a cell most of whose words no review ever
 * brings back. A narrowing of section 4.5 (row CM-21 decision record): today it leaves Test out on Stage 3 up only.
 */
export const TEST_OUT_MAX_TOPIC_SHARE = 30;
/** How many times the engine is asked again without the items that cannot be played. */
const REBUILD_TRIES = 4;

/** `jump`: Stage Jump Ahead (row CM-25), the test-out rule over a whole stage; its `cellId` is the stage key. */
export type CheckMode = 'check' | 'testout' | 'jump';

/** Rounds of a Stage Jump (row CM-25): the Stage Check's length (section 4.5: about 20 items, 6-8 minutes). */
export const STAGE_JUMP_SIZE = 20;
/** The fewest playable rounds a Stage Jump is offered with: a full Cell Check's 10, over the whole stage. */
export const STAGE_JUMP_MIN_ROUNDS = 10;

export interface PlannedCheck {
  /** The cell, or for a Stage Jump the stage key. */
  cellId: string;
  mode: CheckMode;
  rounds: ReviewRound[];
  /** The engine's sound notice (F-AUDIO-004). */
  soundNotice: boolean;
  /** A Stage Jump's cells (the stage's grid cells), each latched `testedOut` on a pass; absent on a cell's own Check. */
  cells?: readonly string[];
}

/** The items a Check of the cell may ask: those the cell teaches (its own `cells`), topic words included. */
export function cellCheckItemIds(index: EngineContext['index'], cellId: string): string[] {
  return index.items.filter((i) => i.cells.includes(cellId) && !index.retired.has(i.id)).map((i) => i.id);
}

/** Plays the engine's Check of the items `idsOf` gives, leaving out those that cannot be played; null below `min` rounds. */
function planRounds(
  ctx: EngineContext,
  idsOf: (skipped: ReadonlySet<string>) => string[],
  size: number,
  min: number,
  rounds: Omit<RoundInput, 'index'>,
  exclude: ReadonlySet<string>,
): ReviewRound[] | null {
  const skipped = new Set<string>(exclude);
  let best: ReviewRound[] = [];
  for (let attempt = 0; attempt < REBUILD_TRIES; attempt += 1) {
    const session = buildCheck(ctx, { itemIds: idsOf(skipped), size });
    if (session.questions.length === 0) break;
    const built = session.questions.map((q) => ({ q, round: roundFor(q, { ...rounds, index: ctx.index }) }));
    best = built.flatMap((b) => (b.round ? [b.round] : []));
    if (best.length === session.questions.length) break;
    for (const b of built) if (b.round === null) skipped.add(b.q.itemId);
  }
  return best.length < min ? null : best;
}

/** Whether the cell's topic words are few enough for Test out (`TEST_OUT_MAX_TOPIC_SHARE`). */
export function testOutFits(index: EngineContext['index'], cellId: string): boolean {
  const ids = cellCheckItemIds(index, cellId);
  const topic = ids.filter((id) => id.startsWith('vocab:')).length;
  return ids.length > 0 && topic * 100 <= TEST_OUT_MAX_TOPIC_SHARE * ids.length;
}

export interface TestOutCell {
  stage: string;
  /** May the learner start each quest of the cell (F-ENT-003 section 3.4, the same as playing it)? */
  open: readonly boolean[];
  /** Any quest of the cell done, or the cell already tested out. */
  started: boolean;
}

/**
 * May the cell be tested out now (section 4.5; cell-check.md B): not in Stage 1, nobody started it, and every quest is
 * open to the learner. The screen chunk's offer applies the same rules; the session checks them again at its start and
 * before its latch, so a plan that lapsed or a switch turned off meanwhile latches nothing.
 */
export function testOutAllowed(cell: TestOutCell | null): boolean {
  return cell !== null && cell.stage !== 'stage1' && !cell.started && cell.open.length > 0 && cell.open.every(Boolean);
}

/**
 * The Check to play, as rounds; null when the cell has fewer than 5 playable rounds. `exclude` leaves items out from
 * the start (one whose lesson chunk could not load).
 */
export function planCellCheck(
  ctx: EngineContext,
  cellId: string,
  mode: Exclude<CheckMode, 'jump'>,
  rounds: Omit<RoundInput, 'index'>,
  exclude: ReadonlySet<string> = new Set(),
): PlannedCheck | null {
  const all = cellCheckItemIds(ctx.index, cellId);
  const best = planRounds(ctx, (skipped) => all.filter((id) => !skipped.has(id)), CELL_CHECK_SIZE, CELL_CHECK_MIN_ROUNDS, rounds, exclude);
  return best === null ? null : { cellId, mode, rounds: best, soundNotice: best.some((r) => r.question.voiceFallback) };
}

/** The items a Stage Jump of these cells may ask: each cell's own, in the order of `cells`, each item once. */
export function stageJumpItemIds(index: EngineContext['index'], cells: readonly string[]): string[] {
  return [...new Set(cells.flatMap((cell) => cellCheckItemIds(index, cell)))];
}

/**
 * Stage Jump Ahead (F-CURR-002 row CM-25): the test-out rule over a whole stage, one Check over its cells. Each cell's
 * items go through the engine's Check selector on their own (box first), and the stage's 20 are taken round robin from
 * those orders, so every cell is asked when it can be and a cell of many words cannot crowd out a small one; the
 * engine's Check over the 20 then sets the produce share (at least 30%) and interleaves them across the themes. Null
 * with fewer than 10 playable rounds (Stage 5's books teach no review items, so it offers none), when a cell of the stage
 * holds too many topic words for Test out (`testOutFits`, so Stage 2 has none today), or when a cell that teaches review
 * items would not be asked at all.
 */
export function planStageJump(
  ctx: EngineContext,
  stage: string,
  cells: readonly string[],
  rounds: Omit<RoundInput, 'index'>,
  exclude: ReadonlySet<string> = new Set(),
): PlannedCheck | null {
  // CM-21's narrowing 4, cell by cell: a cell whose topic words are more than 30% of its items cannot be tested out, so
  // a stage with one (every Stage 2 cell today) has no jump.
  if (cells.some((cell) => cellCheckItemIds(ctx.index, cell).length > 0 && !testOutFits(ctx.index, cell))) return null;
  const idsOf = (skipped: ReadonlySet<string>): string[] => {
    const orders = cells.map((cell) => buildCheck(ctx, { itemIds: cellCheckItemIds(ctx.index, cell).filter((id) => !skipped.has(id)), size: STAGE_JUMP_SIZE }).questions.map((q) => q.itemId));
    const picked = new Set<string>();
    for (let i = 0; picked.size < STAGE_JUMP_SIZE && orders.some((o) => i < o.length); i += 1) {
      for (const order of orders) if (i < order.length && picked.size < STAGE_JUMP_SIZE) picked.add(order[i] as string);
    }
    return [...picked];
  };
  const best = planRounds(ctx, idsOf, STAGE_JUMP_SIZE, STAGE_JUMP_MIN_ROUNDS, rounds, exclude);
  if (best === null) return null;
  // A pass latches every cell of the stage, so every cell that teaches review items must be asked at least once. One
  // left out (its lesson chunk could not load offline, or none of its rounds can play here) means no jump: a cell is
  // never marked tested out without a question on it.
  const asked = new Set(best.flatMap((r) => ctx.index.byId.get(r.question.itemId)?.cells ?? []));
  if (cells.some((cell) => cellCheckItemIds(ctx.index, cell).length > 0 && !asked.has(cell))) return null;
  return { cellId: stage, mode: 'jump', rounds: best, soundNotice: best.some((r) => r.question.voiceFallback), cells: [...cells] };
}

export interface CheckResult {
  stars: 1 | 2 | 3;
  itemIds: string[];
  missedItemIds: string[];
  firstTryCorrect: number;
  /** 80% or more right on the first try over every round of the Check (a Check is finished only when all are answered). */
  passed: boolean;
}

/** The result of a finished Check: the stars, and whether it passed (the same 3-star tier, in whole numbers). */
export function checkResult(rounds: readonly ReviewRound[], answers: ReadonlyMap<number, RoundAnswer>): CheckResult {
  const r = sessionResult(rounds, answers);
  const asked = r.itemIds.length;
  const firstTryCorrect = asked - r.missedItemIds.length;
  const passed = asked >= CELL_CHECK_MIN_ROUNDS && asked === rounds.length && firstTryCorrect * 100 >= CELL_CHECK_PASS_SHARE * asked;
  return { ...r, firstTryCorrect, passed };
}

/** The answers of a Check as the memory store records them, in round order. */
export function checkAnswers(rounds: readonly ReviewRound[], answers: ReadonlyMap<number, RoundAnswer>): ReturnType<typeof memoryAnswerOf>[] {
  return rounds.flatMap((round, i) => {
    const a = answers.get(i);
    return a === undefined ? [] : [memoryAnswerOf(round, a)];
  });
}

/**
 * The `reviews[]` entry of a finished Check: kind `cell-check`, scope the cell, one per cell (`cell-check:<cell id>`,
 * never a profile id or a name). Retakes merge into it (`mergeReview`: the best stars, then the earliest time at that
 * best), so the kind, which is never pruned, holds at most one entry per cell however often a Check is taken.
 */
export function cellCheckEntry(input: { cellId: string; result: CheckResult; at: string }): ReviewEntry {
  return {
    id: `cell-check:${input.cellId}`,
    kind: 'cell-check',
    generatedAt: input.at,
    scope: input.cellId,
    itemIds: input.result.itemIds,
    resultStars: input.result.stars,
    missedItemIds: input.result.missedItemIds,
  };
}

/**
 * The latches a finished Check writes (section 4.4, cell-check.md States): a passed Cell Check `cellCheckAt` (toward
 * Mastered); a passed test-out or Stage Jump `testedOut` only (Done), never `cellCheckAt`, so "Cell Check done" keeps
 * one meaning.
 */
export function checkLatch(mode: CheckMode, result: Pick<CheckResult, 'passed'>): 'cellCheckAt' | 'testedOut' | null {
  if (!result.passed) return null;
  return mode === 'check' ? 'cellCheckAt' : 'testedOut';
}

/**
 * The `testedOut` keys a passed test-out writes: its cell; for a Stage Jump (row CM-25) every cell of the stage and the
 * stage key, the latch F-PLC-001's `effectiveRoute` reads as the jump (section 3.6 as amended).
 */
export function testedOutKeys(plan: Pick<PlannedCheck, 'cellId' | 'mode' | 'cells'>): string[] {
  return plan.mode === 'jump' ? [...(plan.cells ?? []), plan.cellId] : [plan.cellId];
}

// ---- telemetry (section 11.3) ----------------------------------------------------------------------------

/** `review.start { kind: 'cell-check' }`. No item, no text. */
export function cellCheckStartEvent(profileId: string): TelemetryEvent {
  return { name: 'review.start', profileId, payload: { kind: 'cell-check' } };
}

/** `review.complete { kind: 'cell-check', stars }`: stars only. */
export function cellCheckCompleteEvent(profileId: string, stars: 1 | 2 | 3): TelemetryEvent {
  return { name: 'review.complete', profileId, payload: { kind: 'cell-check', stars } };
}

/** `testout.finished { cellId, passed, items, firstTryCorrect }`, parsed before it is sent; null when it does not parse. */
export function testOutFinishedEvent(profileId: string, cellId: string, result: Pick<CheckResult, 'passed' | 'itemIds' | 'firstTryCorrect'>): TelemetryEvent | null {
  const payload = CURR_TELEMETRY_PAYLOADS['testout.finished'].safeParse({ cellId, passed: result.passed, items: result.itemIds.length, firstTryCorrect: result.firstTryCorrect });
  return payload.success ? { name: 'testout.finished', profileId, payload: payload.data } : null;
}
