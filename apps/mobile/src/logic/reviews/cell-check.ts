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
 * - **Entry**: one `reviews[]` entry of kind `cell-check`, scope the cell id. The kind is gated (`?cap=cell-check`) and
 *   never pruned. No `mode` field (`ReviewEntrySchema` would strip it); `testout.finished` carries the test-out.
 */

/** Rounds of a Cell Check when the cell has them (section 4.5: 8-10 items, about 3 minutes). */
export const CELL_CHECK_SIZE = 10;
/** The fewest playable rounds a Cell Check is offered with (the wireframe's floor below 8). */
export const CELL_CHECK_MIN_ROUNDS = 5;
/** First-try right share that latches `cellCheckAt`, or passes a test-out (section 4.4): the 3-star tier. */
export const CELL_CHECK_PASS_SHARE = 80;
/** How many times the engine is asked again without the items that cannot be played. */
const REBUILD_TRIES = 4;

export type CheckMode = 'check' | 'testout';

export interface PlannedCheck {
  cellId: string;
  mode: CheckMode;
  rounds: ReviewRound[];
  /** The engine's sound notice (F-AUDIO-004). */
  soundNotice: boolean;
}

/** The items a Check of the cell may ask: those the cell teaches (its own `cells`), topic words included. */
export function cellCheckItemIds(index: EngineContext['index'], cellId: string): string[] {
  return index.items.filter((i) => i.cells.includes(cellId) && !index.retired.has(i.id)).map((i) => i.id);
}

/**
 * The Check to play, as rounds; null when the cell has fewer than 5 playable rounds. `exclude` leaves items out from
 * the start (one whose lesson chunk could not load).
 */
export function planCellCheck(
  ctx: EngineContext,
  cellId: string,
  mode: CheckMode,
  rounds: Omit<RoundInput, 'index'>,
  exclude: ReadonlySet<string> = new Set(),
): PlannedCheck | null {
  const all = cellCheckItemIds(ctx.index, cellId);
  const skipped = new Set<string>(exclude);
  let best: ReviewRound[] = [];
  for (let attempt = 0; attempt < REBUILD_TRIES; attempt += 1) {
    const session = buildCheck(ctx, { itemIds: all.filter((id) => !skipped.has(id)), size: CELL_CHECK_SIZE });
    if (session.questions.length === 0) break;
    const built = session.questions.map((q) => ({ q, round: roundFor(q, { ...rounds, index: ctx.index }) }));
    best = built.flatMap((b) => (b.round ? [b.round] : []));
    if (best.length === session.questions.length) break;
    for (const b of built) if (b.round === null) skipped.add(b.q.itemId);
  }
  if (best.length < CELL_CHECK_MIN_ROUNDS) return null;
  return { cellId, mode, rounds: best, soundNotice: best.some((r) => r.question.voiceFallback) };
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

/** The `reviews[]` entry of a finished Check: kind `cell-check`, scope the cell. A random id: never a profile id or a name. */
export function cellCheckEntry(input: { cellId: string; result: CheckResult; day: string; now: Date; nonce: string }): ReviewEntry {
  return {
    id: `cell-check:${input.day}:${input.nonce}`,
    kind: 'cell-check',
    generatedAt: input.now.toISOString(),
    scope: input.cellId,
    itemIds: input.result.itemIds,
    resultStars: input.result.stars,
    missedItemIds: input.result.missedItemIds,
  };
}

/**
 * The latches a finished Check writes (section 4.4, cell-check.md States): a passed Cell Check `cellCheckAt` (toward
 * Mastered); a passed test-out `testedOut` only (Done), never `cellCheckAt`, so "Cell Check done" keeps one meaning.
 */
export function checkLatch(mode: CheckMode, result: Pick<CheckResult, 'passed'>): 'cellCheckAt' | 'testedOut' | null {
  if (!result.passed) return null;
  return mode === 'testout' ? 'testedOut' : 'cellCheckAt';
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
